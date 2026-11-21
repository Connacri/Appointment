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
        )
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
        booking.validate()?;
        if idempotency_key.trim().is_empty() {
            return Err("idempotency_key is required".into());
        }
        let payload = serde_json::to_string(booking).map_err(|e| e.to_string())?;
        let tx = self.connection.transaction().map_err(|e| e.to_string())?;
        ensure_workspace_exists(&tx, workspace_id)?;
        if check_idempotency(
            &tx,
            idempotency_key,
            workspace_id,
            "booking",
            &booking.id,
            "upsert",
            Some(&payload),
        )? {
            tx.commit().map_err(|e| e.to_string())?;
            return Ok(());
        }
        let version: i64 = tx.query_row(
            "SELECT COALESCE(MAX(version), 0) + 1 FROM bookings WHERE workspace_id=?1 AND id=?2",
            params![workspace_id, booking.id], |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO bookings(workspace_id,id,resource_id,payload,version,updated_at)
             VALUES (?1,?2,?3,?4,?5,CURRENT_TIMESTAMP)
             ON CONFLICT(workspace_id,id) DO UPDATE SET resource_id=excluded.resource_id,
             payload=excluded.payload, version=excluded.version, updated_at=CURRENT_TIMESTAMP",
            params![
                workspace_id,
                booking.id,
                booking.resource_id,
                payload,
                version
            ],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "DELETE FROM tombstones WHERE workspace_id=?1 AND entity='booking' AND entity_id=?2",
            params![workspace_id, booking.id],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO outbox(id,idempotency_key,workspace_id,entity,entity_id,operation,version,payload)
             VALUES (?1,?2,?3,'booking',?4,'upsert',?5,?6)",
            params![Uuid::new_v4().to_string(), idempotency_key, workspace_id, booking.id, version, payload],
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
        let version: Option<i64> = tx
            .query_row(
                "SELECT version + 1 FROM bookings WHERE workspace_id=?1 AND id=?2",
                params![workspace_id, booking_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        let Some(version) = version else {
            tx.commit().map_err(|e| e.to_string())?;
            return Ok(false);
        };
        tx.execute(
            "DELETE FROM bookings WHERE workspace_id=?1 AND id=?2",
            params![workspace_id, booking_id],
        )
        .map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO tombstones(workspace_id,entity,entity_id,version) VALUES (?1,'booking',?2,?3)
             ON CONFLICT(workspace_id,entity,entity_id) DO UPDATE SET version=excluded.version, deleted_at=CURRENT_TIMESTAMP",
            params![workspace_id, booking_id, version],
        ).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO outbox(id,idempotency_key,workspace_id,entity,entity_id,operation,version,payload)
             VALUES (?1,?2,?3,'booking',?4,'delete',?5,NULL)",
            params![Uuid::new_v4().to_string(), idempotency_key, workspace_id, booking_id, version],
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
            "SELECT payload FROM bookings WHERE workspace_id=?1 ORDER BY json_extract(payload, '$.start_date'), id LIMIT ?2 OFFSET ?3"
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
            "UPDATE outbox SET status='synced', last_error=NULL WHERE workspace_id=?1 AND id=?2 AND status='pending'",
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
        let changed = self.connection.execute(
            "UPDATE outbox SET status='failed', attempts=attempts+1, last_error=?3,
             next_attempt_at=datetime('now', '+' || MIN(21600, (30 * (1 << MIN(attempts, 10)))) || ' seconds')
             WHERE workspace_id=?1 AND id=?2 AND status IN ('pending','failed')",
            params![workspace_id, outbox_id, error],
        )?;
        Ok(changed == 1)
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
            "SELECT id,idempotency_key,workspace_id,entity,entity_id,operation,version,payload,status,attempts,created_at
             FROM outbox WHERE workspace_id=?1 AND status='pending' AND next_attempt_at<=CURRENT_TIMESTAMP
             ORDER BY created_at,id LIMIT ?2"
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
            })
        })?;
        rows.collect()
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
            total_price_minor: 1_000_000,
            currency_code: "DZD".into(),
            payment_status: "pending".into(),
            notes: None,
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
    fn outbox_retry_state_is_workspace_scoped() {
        let mut db = database();
        db.upsert_booking("w-1", &booking("b-1"), "idem-1").unwrap();
        let entry = db.pending_outbox("w-1", 1).unwrap().remove(0);
        assert!(!db.mark_outbox_synced("w-2", &entry.id).unwrap());
        assert!(db
            .mark_outbox_failed("w-1", &entry.id, "network timeout")
            .unwrap());
        assert_eq!(db.pending_outbox("w-1", 10).unwrap().len(), 0);
        assert!(db.retry_outbox("w-1", &entry.id).unwrap());
        assert_eq!(db.pending_outbox("w-1", 10).unwrap().len(), 1);
    }
}
