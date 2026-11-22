use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::Booking;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboxEntry {
    pub id: String,
    pub idempotency_key: String,
    pub workspace_id: String,
    pub entity: String,
    pub entity_id: String,
    pub operation: String,
    pub version: i64,
    pub payload: Option<String>,
    pub status: String,
    pub attempts: i64,
    pub created_at: String,
    pub next_attempt_at: String,
    pub last_error: Option<String>,
    pub base_server_version: i64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct OutboxStats {
    pub pending: u64,
    pub failed: u64,
    pub conflict: u64,
    pub synced: u64,
}

pub struct PmsDatabase {
    connection: Connection,
}

impl PmsDatabase {
    pub fn open(path: impl AsRef<std::path::Path>) -> rusqlite::Result<Self> {
        let connection = Connection::open(path)?;
        Self::from_connection(connection)
    }

    pub fn in_memory() -> rusqlite::Result<Self> {
        Self::from_connection(Connection::open_in_memory()?)
    }

    fn from_connection(connection: Connection) -> rusqlite::Result<Self> {
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.busy_timeout(std::time::Duration::from_secs(5))?;
        let db = Self { connection };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> rusqlite::Result<()> {
        self.connection.execute_batch(
            "BEGIN IMMEDIATE;
             CREATE TABLE IF NOT EXISTS schema_migrations (
               version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE IF NOT EXISTS workspaces (
               id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL, name TEXT NOT NULL,
               created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
             );
             CREATE TABLE IF NOT EXISTS bookings (
               workspace_id TEXT NOT NULL, id TEXT NOT NULL, resource_id TEXT NOT NULL,
               payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
               updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
               PRIMARY KEY(workspace_id, id),
               FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
             );
             CREATE INDEX IF NOT EXISTS idx_bookings_workspace_start
               ON bookings(workspace_id, json_extract(payload, '$.start_date'));
             CREATE TABLE IF NOT EXISTS outbox (
               id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE,
               workspace_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
               operation TEXT NOT NULL CHECK(operation IN ('upsert','delete')),
               version INTEGER NOT NULL, payload TEXT, status TEXT NOT NULL DEFAULT 'pending'
                 CHECK(status IN ('pending','synced','failed')),
               attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
               next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_error TEXT,
               FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
             );
             CREATE INDEX IF NOT EXISTS idx_outbox_due
               ON outbox(status, next_attempt_at, created_at);
             CREATE INDEX IF NOT EXISTS idx_outbox_workspace
               ON outbox(workspace_id, created_at);
             CREATE TABLE IF NOT EXISTS tombstones (
               workspace_id TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL,
               version INTEGER NOT NULL, deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
               PRIMARY KEY(workspace_id, entity, entity_id),
               FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
             );
             INSERT OR IGNORE INTO schema_migrations(version) VALUES (1);
             COMMIT;"
        )?;

        // Version 2 indexes canonical camelCase payloads while retaining
        // compatibility with rows written by the original snake_case slice.
        let has_v2: bool = self.connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = 2)",
            [],
            |row| row.get(0),
        )?;
        if !has_v2 {
            self.connection.execute_batch(
                "BEGIN IMMEDIATE;
                 DROP INDEX IF EXISTS idx_bookings_workspace_start;
                 CREATE INDEX idx_bookings_workspace_start
                   ON bookings(workspace_id,
                     COALESCE(json_extract(payload, '$.startDate'),
                              json_extract(payload, '$.start_date')));
                 INSERT OR IGNORE INTO schema_migrations(version) VALUES (2);
                 COMMIT;",
            )?;
        }
        let has_v3: bool = self.connection.query_row(
            "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = 3)",
            [],
            |row| row.get(0),
        )?;
        if !has_v3 {
            self.connection.execute_batch(
                "BEGIN IMMEDIATE;
                 ALTER TABLE bookings ADD COLUMN server_version INTEGER NOT NULL DEFAULT 0;
                 ALTER TABLE tombstones ADD COLUMN server_version INTEGER NOT NULL DEFAULT 0;
                 CREATE TABLE outbox_v3 (
                   id TEXT PRIMARY KEY,
                   idempotency_key TEXT NOT NULL UNIQUE,
                   workspace_id TEXT NOT NULL,
                   entity TEXT NOT NULL,
                   entity_id TEXT NOT NULL,
                   operation TEXT NOT NULL CHECK(operation IN ('upsert','delete')),
                   version INTEGER NOT NULL,
                   base_server_version INTEGER NOT NULL DEFAULT 0,
                   payload TEXT,
                   status TEXT NOT NULL DEFAULT 'pending'
                     CHECK(status IN ('pending','synced','failed','conflict')),
                   attempts INTEGER NOT NULL DEFAULT 0,
                   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   last_error TEXT,
                   FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
                 );
                 INSERT INTO outbox_v3 (
                   id,idempotency_key,workspace_id,entity,entity_id,operation,version,
                   base_server_version,payload,status,attempts,created_at,next_attempt_at,last_error
                 )
                 SELECT
                   id,idempotency_key,workspace_id,entity,entity_id,operation,version,
                   0,payload,status,attempts,created_at,next_attempt_at,last_error
                 FROM outbox;
                 DROP TABLE outbox;
                 ALTER TABLE outbox_v3 RENAME TO outbox;
                 CREATE INDEX idx_outbox_due
                   ON outbox(status, next_attempt_at, created_at);
                 CREATE INDEX idx_outbox_workspace
                   ON outbox(workspace_id, created_at);
                 INSERT OR IGNORE INTO schema_migrations(version) VALUES (3);
                 COMMIT;"
            )?;
        }
        Ok(())
    }

    pub fn ensure_workspace(
        &self,
        workspace_id: &str,
        owner_user_id: &str,
        name: &str,
    ) -> rusqlite::Result<()> {
        self.connection.execute(
            "INSERT INTO workspaces(id, owner_user_id, name) VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO NOTHING",
            params![workspace_id, owner_user_id, name],
        )?;
        Ok(())
    }

    pub fn upsert_booking(
        &mut self,
        workspace_id: &str,
        booking: &Booking,
        idempotency_key: &str,
    ) -> Result<(), String> {
        let mut normalized_booking = booking.clone();
        normalized_booking.normalize_occupants();
        normalized_booking.validate()?;
        if idempotency_key.trim().is_empty() {
            return Err("idempotency_key is required".into());
        }
        let payload = serde_json::to_string(&normalized_booking).map_err(|e| e.to_string())?;
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        ensure_workspace_exists(&tx, workspace_id)?;
        if check_idempotency(
            &tx,
            idempotency_key,
            workspace_id,
            "booking",
            &normalized_booking.id,
            "upsert",
            Some(&payload),
        )? {
            tx.commit().map_err(|e| e.to_string())?;
            return Ok(());
        }
        let version: i64 = tx.query_row(
            "SELECT COALESCE(MAX(version), 0) + 1 FROM (
               SELECT version FROM bookings WHERE workspace_id=?1 AND id=?2
               UNION ALL
               SELECT version FROM tombstones WHERE workspace_id=?1 AND entity='booking' AND entity_id=?2
             )",
            params![workspace_id, normalized_booking.id], |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        let base_server_version: i64 = tx.query_row(
            "SELECT COALESCE(MAX(server_version), 0) FROM (
               SELECT server_version FROM bookings WHERE workspace_id=?1 AND id=?2
               UNION ALL
               SELECT server_version FROM tombstones WHERE workspace_id=?1 AND entity='booking' AND entity_id=?2
             )",
            params![workspace_id, normalized_booking.id],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO bookings(workspace_id,id,resource_id,payload,version,updated_at)
             VALUES (?1,?2,?3,?4,?5,CURRENT_TIMESTAMP)
             ON CONFLICT(workspace_id,id) DO UPDATE SET resource_id=excluded.resource_id,
             payload=excluded.payload, version=excluded.version, updated_at=CURRENT_TIMESTAMP",
            params![
                workspace_id,
                normalized_booking.id,
                normalized_booking.resource_id,
                payload,
                version
            ],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "DELETE FROM tombstones WHERE workspace_id=?1 AND entity='booking' AND entity_id=?2",
            params![workspace_id, normalized_booking.id],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO outbox(id,idempotency_key,workspace_id,entity,entity_id,operation,version,base_server_version,payload)
             VALUES (?1,?2,?3,'booking',?4,'upsert',?5,?6,?7)",
            params![Uuid::new_v4().to_string(), idempotency_key, workspace_id, normalized_booking.id, version, base_server_version, payload],
        ).map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())
    }

    pub fn delete_booking(
        &mut self,
        workspace_id: &str,
        booking_id: &str,
        idempotency_key: &str,
    ) -> Result<bool, String> {
        if idempotency_key.trim().is_empty() {
            return Err("idempotency_key is required".into());
        }
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        if check_idempotency(
            &tx,
            idempotency_key,
            workspace_id,
            "booking",
            booking_id,
            "delete",
            None,
        )? {
            tx.commit().map_err(|e| e.to_string())?;
            return Ok(true);
        }
        let existing: Option<(i64, i64)> = tx
            .query_row(
                "SELECT version + 1, server_version FROM bookings WHERE workspace_id=?1 AND id=?2",
                params![workspace_id, booking_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        let Some((version, base_server_version)) = existing else {
            tx.commit().map_err(|e| e.to_string())?;
            return Ok(false);
        };
        tx.execute(
            "DELETE FROM bookings WHERE workspace_id=?1 AND id=?2",
            params![workspace_id, booking_id],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO tombstones(workspace_id,entity,entity_id,version,server_version) VALUES (?1,'booking',?2,?3,?4)
             ON CONFLICT(workspace_id,entity,entity_id) DO UPDATE SET version=excluded.version, server_version=excluded.server_version, deleted_at=CURRENT_TIMESTAMP",
            params![workspace_id, booking_id, version, base_server_version],
        ).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO outbox(id,idempotency_key,workspace_id,entity,entity_id,operation,version,base_server_version,payload)
             VALUES (?1,?2,?3,'booking',?4,'delete',?5,?6,NULL)",
            params![Uuid::new_v4().to_string(), idempotency_key, workspace_id, booking_id, version, base_server_version],
        ).map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(true)
    }

    pub fn get_booking(
        &self,
        workspace_id: &str,
        booking_id: &str,
    ) -> rusqlite::Result<Option<Booking>> {
        let payload: Option<String> = self
            .connection
            .query_row(
                "SELECT payload FROM bookings WHERE workspace_id=?1 AND id=?2",
                params![workspace_id, booking_id],
                |row| row.get(0),
            )
            .optional()?;
        payload
            .map(|value| {
                serde_json::from_str(&value).map_err(|e| {
                    rusqlite::Error::FromSqlConversionFailure(
                        0,
                        rusqlite::types::Type::Text,
                        Box::new(e),
                    )
                })
            })
            .transpose()
    }

    pub fn list_bookings(
        &self,
        workspace_id: &str,
        offset: u32,
        limit: u32,
    ) -> rusqlite::Result<Vec<Booking>> {
        let mut statement = self.connection.prepare(
            "SELECT payload FROM bookings WHERE workspace_id=?1 ORDER BY COALESCE(json_extract(payload, '$.startDate'), json_extract(payload, '$.start_date')), id LIMIT ?2 OFFSET ?3"
        )?;
        let rows = statement.query_map(params![workspace_id, limit.min(500), offset], |row| {
            let payload: String = row.get(0)?;
            serde_json::from_str(&payload).map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })
        })?;
        rows.collect()
    }

    pub fn mark_outbox_synced(
        &self,
        workspace_id: &str,
        outbox_id: &str,
    ) -> rusqlite::Result<bool> {
        let changed = self.connection.execute(
            "UPDATE outbox SET status='synced', last_error=NULL WHERE workspace_id=?1 AND id=?2 AND status IN ('pending','failed')",
            params![workspace_id, outbox_id],
        )?;
        Ok(changed == 1)
    }

    pub fn mark_outbox_failed(
        &self,
        workspace_id: &str,
        outbox_id: &str,
        error: &str,
    ) -> rusqlite::Result<bool> {
        let safe_error: String = error.chars().take(1024).collect();
        let changed = self.connection.execute(
            "UPDATE outbox SET status='failed', attempts=attempts+1, last_error=?3,
             next_attempt_at=datetime('now', '+' || MIN(21600, (30 * (1 << MIN(attempts, 10)))) || ' seconds')
             WHERE workspace_id=?1 AND id=?2 AND status IN ('pending','failed')",
            params![workspace_id, outbox_id, safe_error],
        )?;
        Ok(changed == 1)
    }

    pub fn mark_outbox_conflict(
        &self,
        workspace_id: &str,
        outbox_id: &str,
        reason: &str,
    ) -> rusqlite::Result<bool> {
        let changed = self.connection.execute(
            "UPDATE outbox SET status='conflict', last_error=?3
             WHERE workspace_id=?1 AND id=?2 AND status IN ('pending','failed')",
            params![workspace_id, outbox_id, reason.chars().take(1024).collect::<String>()],
        )?;
        Ok(changed == 1)
    }

    /// Commits a local acknowledgement only after the caller has validated a server response.
    /// Newer queued mutations for the same entity are rebased onto this server version.
    pub fn acknowledge_outbox(
        &self,
        workspace_id: &str,
        outbox_id: &str,
        server_version: i64,
    ) -> rusqlite::Result<bool> {
        if server_version < 0 {
            return Err(rusqlite::Error::InvalidParameterName(
                "server_version cannot be negative".into(),
            ));
        }
        let tx = self.connection.unchecked_transaction()?;
        let entry: Option<(String, String, i64)> = tx
            .query_row(
                "SELECT entity,entity_id,version FROM outbox
                 WHERE workspace_id=?1 AND id=?2 AND status IN ('pending','failed')",
                params![workspace_id, outbox_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .optional()?;
        let Some((entity, entity_id, local_version)) = entry else {
            tx.rollback()?;
            return Ok(false);
        };
        let changed = tx.execute(
            "UPDATE outbox SET status='synced', last_error=NULL
             WHERE workspace_id=?1 AND id=?2 AND status IN ('pending','failed')",
            params![workspace_id, outbox_id],
        )?;
        if changed != 1 {
            tx.rollback()?;
            return Ok(false);
        }
        if entity == "booking" {
            tx.execute(
                "UPDATE bookings SET server_version=?3
                 WHERE workspace_id=?1 AND id=?2",
                params![workspace_id, entity_id, server_version],
            )?;
            tx.execute(
                "UPDATE tombstones SET server_version=?3
                 WHERE workspace_id=?1 AND entity='booking' AND entity_id=?2",
                params![workspace_id, entity_id, server_version],
            )?;
            tx.execute(
                "UPDATE outbox SET base_server_version=?4
                 WHERE workspace_id=?1 AND entity='booking' AND entity_id=?2
                   AND version>?3 AND status IN ('pending','failed')",
                params![workspace_id, entity_id, local_version, server_version],
            )?;
        }
        tx.commit()?;
        Ok(true)
    }

    pub fn retry_outbox(&self, workspace_id: &str, outbox_id: &str) -> rusqlite::Result<bool> {
        let changed = self.connection.execute(
            "UPDATE outbox SET status='pending', next_attempt_at=CURRENT_TIMESTAMP, last_error=NULL
             WHERE workspace_id=?1 AND id=?2 AND status='failed'",
            params![workspace_id, outbox_id],
        )?;
        Ok(changed == 1)
    }

    pub fn pending_outbox(
        &self,
        workspace_id: &str,
        limit: u32,
    ) -> rusqlite::Result<Vec<OutboxEntry>> {
        let mut statement = self.connection.prepare(
            "SELECT id,idempotency_key,workspace_id,entity,entity_id,operation,version,payload,status,attempts,created_at,next_attempt_at,last_error,base_server_version
             FROM outbox
             WHERE workspace_id=?1
               AND status IN ('pending','failed')
               AND next_attempt_at<=CURRENT_TIMESTAMP
             ORDER BY rowid
             LIMIT ?2"
        )?;
        let rows = statement.query_map(params![workspace_id, limit.min(500)], |row| {
            Ok(OutboxEntry {
                id: row.get(0)?,
                idempotency_key: row.get(1)?,
                workspace_id: row.get(2)?,
                entity: row.get(3)?,
                entity_id: row.get(4)?,
                operation: row.get(5)?,
                version: row.get(6)?,
                payload: row.get(7)?,
                status: row.get(8)?,
                attempts: row.get(9)?,
                created_at: row.get(10)?,
                next_attempt_at: row.get(11)?,
                last_error: row.get(12)?,
                base_server_version: row.get(13)?,
            })
        })?;
        rows.collect()
    }

    pub fn outbox_stats(&self, workspace_id: &str) -> rusqlite::Result<OutboxStats> {
        let (pending, failed, conflict, synced): (u64, u64, u64, u64) = self.connection.query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN status='conflict' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN status='synced' THEN 1 ELSE 0 END), 0)
             FROM outbox WHERE workspace_id=?1",
            params![workspace_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )?;
        Ok(OutboxStats {
            pending,
            failed,
            conflict,
            synced,
        })
    }
}

fn check_idempotency(
    tx: &Transaction<'_>,
    key: &str,
    workspace_id: &str,
    entity: &str,
    entity_id: &str,
    operation: &str,
    payload: Option<&str>,
) -> Result<bool, String> {
    let existing: Option<(String, String, String, String, Option<String>)> = tx.query_row(
        "SELECT workspace_id,entity,entity_id,operation,payload FROM outbox WHERE idempotency_key=?1",
        params![key],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
    ).optional().map_err(|e| e.to_string())?;
    match existing {
        None => Ok(false),
        Some((ws, kind, id, op, body))
            if ws == workspace_id
                && kind == entity
                && id == entity_id
                && op == operation
                && body.as_deref() == payload =>
        {
            Ok(true)
        }
        Some(_) => Err("idempotency_key has already been used for a different mutation".into()),
    }
}

fn ensure_workspace_exists(tx: &Transaction<'_>, workspace_id: &str) -> Result<(), String> {
    let exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=?1)",
            params![workspace_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !exists {
        return Err(format!("workspace '{workspace_id}' does not exist"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{Booking, BookingStatus};

    fn booking(id: &str) -> Booking {
        Booking {
            id: id.into(),
            resource_id: "room-101".into(),
            resource_name: "101".into(),
            sector: "hotel".into(),
            guest_name: "Guest".into(),
            guest_email: "g@example.test".into(),
            guest_phone: "".into(),
            start_date: "2026-11-21".into(),
            end_date: "2026-11-23".into(),
            status: BookingStatus::Confirmed,
            total_price: Some(10_000.0),
            payment_currency: Some("DZD".into()),
            payment_status: "pending".into(),
            ..Booking::default()
        }
    }

    fn database() -> PmsDatabase {
        let db = PmsDatabase::in_memory().unwrap();
        db.ensure_workspace("w-1", "user-1", "Workspace 1").unwrap();
        db.ensure_workspace("w-2", "user-2", "Workspace 2").unwrap();
        db
    }

    #[test]
    fn booking_and_outbox_commit_atomically() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-1"), "idem-1").unwrap();
        assert!(db.get_booking("w-1", "b-1").unwrap().is_some());
        assert_eq!(db.pending_outbox("w-1", 10).unwrap().len(), 1);
    }

    #[test]
    fn sqlite_and_outbox_store_the_normalized_occupant_contract() {
        let mut db = database();
        let mut item = booking("b-family");
        item.guest_phone.clear();
        item.adults = Some(2);
        item.adult_guests = Some(vec![
            crate::domain::BookingOccupant {
                full_name: "Primary Guest".into(),
                phone: "+213 550 11 22 33".into(),
                document_type: "cni".into(),
                document_number: "12345678".into(),
                ..crate::domain::BookingOccupant::default()
            },
            crate::domain::BookingOccupant {
                full_name: "Second Guest".into(),
                document_type: "passport".into(),
                document_number: "P887766".into(),
                ..crate::domain::BookingOccupant::default()
            },
        ]);

        db.upsert_booking("w-1", &item, "idem-family").unwrap();
        let restored = db.get_booking("w-1", "b-family").unwrap().unwrap();
        assert_eq!(restored.adults, Some(2));
        assert_eq!(restored.occupants_list.as_ref().unwrap().len(), 2);
        assert_eq!(restored.guest_name, "Guest"); // Existing non-empty primary scalar remains authoritative.
        assert_eq!(restored.guest_phone, "+213 550 11 22 33");

        let outbox = db.pending_outbox("w-1", 10).unwrap();
        let payload: serde_json::Value =
            serde_json::from_str(outbox[0].payload.as_deref().unwrap()).unwrap();
        assert_eq!(payload["adults"], 2);
        assert_eq!(payload["occupantsList"].as_array().unwrap().len(), 2);
        assert_eq!(payload["occupantsList"][1]["documentNumber"], "P887766");
    }

    #[test]
    fn workspace_queries_never_leak_rows() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-1"), "idem-1").unwrap();
        assert!(db.get_booking("w-2", "b-1").unwrap().is_none());
        assert!(db.list_bookings("w-2", 0, 20).unwrap().is_empty());
        assert!(db.pending_outbox("w-2", 20).unwrap().is_empty());
    }

    #[test]
    fn delete_writes_tombstone_and_outbox_atomically() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-1"), "idem-1").unwrap();
        assert!(db.delete_booking("w-1", "b-1", "idem-2").unwrap());
        assert!(db.get_booking("w-1", "b-1").unwrap().is_none());
        assert_eq!(db.pending_outbox("w-1", 10).unwrap().len(), 2);
        let count: i64 = db
            .connection
            .query_row(
                "SELECT COUNT(*) FROM tombstones WHERE workspace_id='w-1' AND entity_id='b-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn idempotent_retry_does_not_duplicate_outbox() {
        let mut db = database();
        let item = booking("b-1");
        db.upsert_booking("w-1", &item, "same-key").unwrap();
        db.upsert_booking("w-1", &item, "same-key").unwrap();
        assert_eq!(db.pending_outbox("w-1", 10).unwrap().len(), 1);
        assert!(db
            .upsert_booking("w-1", &booking("b-2"), "same-key")
            .is_err());
    }

    #[test]
    fn outbox_retry_state_is_workspace_scoped_and_late_ack_is_accepted() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-1"), "idem-1").unwrap();
        let entry = db.pending_outbox("w-1", 1).unwrap().remove(0);
        assert!(!db.mark_outbox_synced("w-2", &entry.id).unwrap());
        assert!(db
            .mark_outbox_failed("w-1", &entry.id, "network timeout")
            .unwrap());
        assert_eq!(db.pending_outbox("w-1", 10).unwrap().len(), 0);
        assert!(db.mark_outbox_synced("w-1", &entry.id).unwrap());
    }

    #[test]
    fn failed_outbox_entries_become_due_again_after_backoff() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-retry"), "idem-retry")
            .unwrap();
        let entry = db.pending_outbox("w-1", 1).unwrap().remove(0);
        assert!(db
            .mark_outbox_failed("w-1", &entry.id, "temporary network failure")
            .unwrap());
        assert!(db.pending_outbox("w-1", 10).unwrap().is_empty());

        db.connection
            .execute(
                "UPDATE outbox SET next_attempt_at=datetime('now', '-1 second') WHERE id=?1",
                params![entry.id],
            )
            .unwrap();

        let due = db.pending_outbox("w-1", 10).unwrap();
        assert_eq!(due.len(), 1);
        assert_eq!(due[0].id, entry.id);
        assert_eq!(due[0].status, "failed");
        assert_eq!(
            due[0].last_error.as_deref(),
            Some("temporary network failure")
        );
    }

    #[test]
    fn outbox_order_preserves_mutation_order_even_with_same_second_timestamps() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-ordered"), "idem-upsert")
            .unwrap();
        db.delete_booking("w-1", "b-ordered", "idem-delete")
            .unwrap();

        let entries = db.pending_outbox("w-1", 10).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].operation, "upsert");
        assert_eq!(entries[1].operation, "delete");
    }

    #[test]
    fn outbox_stats_are_isolated_by_workspace_and_status() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-pending"), "idem-pending")
            .unwrap();
        db.upsert_booking("w-2", &booking("b-synced"), "idem-synced")
            .unwrap();

        let pending_w2 = db.pending_outbox("w-2", 1).unwrap().remove(0);
        db.mark_outbox_synced("w-2", &pending_w2.id).unwrap();

        assert_eq!(
            db.outbox_stats("w-1").unwrap(),
            OutboxStats {
                pending: 1,
                failed: 0,
                conflict: 0,
                synced: 0
            }
        );
        assert_eq!(
            db.outbox_stats("w-2").unwrap(),
            OutboxStats {
                pending: 0,
                failed: 0,
                conflict: 0,
                synced: 1
            }
        );
    }

    #[test]
    fn server_ack_rebases_later_offline_mutations() {
        let mut db = database();
        let mut first = booking("b-ack");
        db.upsert_booking("w-1", &first, "idem-first").unwrap();
        first.guest_name = "Updated Guest".into();
        db.upsert_booking("w-1", &first, "idem-second").unwrap();

        let entries = db.pending_outbox("w-1", 10).unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].base_server_version, 0);
        assert_eq!(entries[1].base_server_version, 0);

        assert!(db
            .acknowledge_outbox("w-1", &entries[0].id, 7)
            .unwrap());
        let later = db.pending_outbox("w-1", 10).unwrap();
        assert_eq!(later.len(), 1);
        assert_eq!(later[0].id, entries[1].id);
        assert_eq!(later[0].base_server_version, 7);

        let local_server_version: i64 = db
            .connection
            .query_row(
                "SELECT server_version FROM bookings WHERE workspace_id='w-1' AND id='b-ack'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(local_server_version, 7);
    }

    #[test]
    fn conflicts_are_terminal_until_explicit_resolution() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-conflict"), "idem-conflict")
            .unwrap();
        let entry = db.pending_outbox("w-1", 1).unwrap().remove(0);
        assert!(db
            .mark_outbox_conflict("w-1", &entry.id, "server version changed")
            .unwrap());
        assert!(db.pending_outbox("w-1", 10).unwrap().is_empty());
        assert_eq!(
            db.outbox_stats("w-1").unwrap(),
            OutboxStats {
                pending: 0,
                failed: 0,
                conflict: 1,
                synced: 0,
            }
        );
    }

    #[test]
    fn migration_v2_preserves_pending_outbox_and_bookings() {
        let connection = Connection::open_in_memory().unwrap();
        connection
            .execute_batch(
                "PRAGMA foreign_keys=ON;
                 CREATE TABLE schema_migrations (
                   version INTEGER PRIMARY KEY,
                   applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                 );
                 INSERT INTO schema_migrations(version) VALUES (1),(2);
                 CREATE TABLE workspaces (
                   id TEXT PRIMARY KEY,
                   owner_user_id TEXT NOT NULL,
                   name TEXT NOT NULL,
                   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                 );
                 INSERT INTO workspaces(id,owner_user_id,name)
                   VALUES ('w-migrate','u-migrate','Migration test');
                 CREATE TABLE bookings (
                   workspace_id TEXT NOT NULL,
                   id TEXT NOT NULL,
                   resource_id TEXT NOT NULL,
                   payload TEXT NOT NULL,
                   version INTEGER NOT NULL DEFAULT 1,
                   updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   PRIMARY KEY(workspace_id,id),
                   FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
                 );
                 INSERT INTO bookings(workspace_id,id,resource_id,payload,version)
                   VALUES ('w-migrate','b-migrate','r-migrate','{}',4);
                 CREATE TABLE outbox (
                   id TEXT PRIMARY KEY,
                   idempotency_key TEXT NOT NULL UNIQUE,
                   workspace_id TEXT NOT NULL,
                   entity TEXT NOT NULL,
                   entity_id TEXT NOT NULL,
                   operation TEXT NOT NULL CHECK(operation IN ('upsert','delete')),
                   version INTEGER NOT NULL,
                   payload TEXT,
                   status TEXT NOT NULL DEFAULT 'pending'
                     CHECK(status IN ('pending','synced','failed')),
                   attempts INTEGER NOT NULL DEFAULT 0,
                   created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   last_error TEXT,
                   FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
                 );
                 INSERT INTO outbox(
                   id,idempotency_key,workspace_id,entity,entity_id,operation,version,
                   payload,status,attempts,last_error
                 ) VALUES (
                   'o-migrate','idem-migrate','w-migrate','booking','b-migrate','upsert',4,
                   'legacy-payload','failed',2,'temporary'
                 );
                 CREATE TABLE tombstones (
                   workspace_id TEXT NOT NULL,
                   entity TEXT NOT NULL,
                   entity_id TEXT NOT NULL,
                   version INTEGER NOT NULL,
                   deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                   PRIMARY KEY(workspace_id,entity,entity_id),
                   FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
                 );
                 INSERT INTO tombstones(workspace_id,entity,entity_id,version)
                   VALUES ('w-migrate','booking','b-deleted',8);"
            )
            .unwrap();

        let db = PmsDatabase::from_connection(connection).unwrap();
        let outbox = db.pending_outbox("w-migrate", 10).unwrap();
        assert_eq!(outbox.len(), 1);
        assert_eq!(outbox[0].id, "o-migrate");
        assert_eq!(outbox[0].status, "failed");
        assert_eq!(outbox[0].attempts, 2);
        assert_eq!(outbox[0].base_server_version, 0);
        let booking_server_version: i64 = db
            .connection
            .query_row(
                "SELECT server_version FROM bookings WHERE workspace_id='w-migrate' AND id='b-migrate'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let tombstone_server_version: i64 = db
            .connection
            .query_row(
                "SELECT server_version FROM tombstones WHERE workspace_id='w-migrate' AND entity_id='b-deleted'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(booking_server_version, 0);
        assert_eq!(tombstone_server_version, 0);
    }

    #[test]
    fn local_schema_v3_tracks_server_versions_and_conflicts() {
        let db = database();
        let outbox_sql: String = db
            .connection
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='outbox'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let version: i64 = db
            .connection
            .query_row(
                "SELECT MAX(version) FROM schema_migrations",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 3);
        assert!(outbox_sql.contains("'conflict'"));
    }

    #[test]
    fn delete_outbox_carries_the_last_acknowledged_server_version() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-server-version"), "idem-create")
            .unwrap();
        let created = db.pending_outbox("w-1", 1).unwrap().remove(0);
        assert_eq!(created.base_server_version, 0);
        assert!(db
            .acknowledge_outbox("w-1", &created.id, 12)
            .unwrap());

        assert!(db
            .delete_booking("w-1", "b-server-version", "idem-delete")
            .unwrap());
        let deleted = db.pending_outbox("w-1", 1).unwrap().remove(0);
        assert_eq!(deleted.operation, "delete");
        assert_eq!(deleted.base_server_version, 12);

        assert!(db
            .acknowledge_outbox("w-1", &deleted.id, 13)
            .unwrap());
        let server_version: i64 = db
            .connection
            .query_row(
                "SELECT server_version FROM tombstones
                 WHERE workspace_id='w-1' AND entity='booking' AND entity_id='b-server-version'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(server_version, 13);
    }

    #[test]
    fn recreation_keeps_version_monotonic_after_tombstone() {
        let mut db = database();
        let item = booking("b-1");
        db.upsert_booking("w-1", &item, "idem-1").unwrap();
        db.delete_booking("w-1", "b-1", "idem-2").unwrap();
        db.upsert_booking("w-1", &item, "idem-3").unwrap();
        let version: i64 = db
            .connection
            .query_row(
                "SELECT version FROM bookings WHERE workspace_id='w-1' AND id='b-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 3);
    }
}
