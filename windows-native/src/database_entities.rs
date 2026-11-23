use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;

use super::PmsDatabase;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EntityRecord {
    pub workspace_id: String,
    pub entity: String,
    pub entity_id: String,
    pub payload: String,
    pub version: i64,
    pub updated_at: String,
}

pub(super) fn migrate(connection: &Connection) -> rusqlite::Result<()> {
    let applied: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=5)",
        [],
        |row| row.get(0),
    )?;
    if applied {
        return Ok(());
    }

    connection.execute_batch(
        "BEGIN IMMEDIATE;
         CREATE TABLE entity_records (
           workspace_id TEXT NOT NULL,
           entity TEXT NOT NULL,
           entity_id TEXT NOT NULL,
           payload TEXT NOT NULL CHECK(json_valid(payload)),
           version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
           updated_at TEXT NOT NULL,
           sector TEXT GENERATED ALWAYS AS (COALESCE(
             json_extract(payload, '$.sector'),
             json_extract(payload, '$.domain')
           )) VIRTUAL,
           status TEXT GENERATED ALWAYS AS (json_extract(payload, '$.status')) VIRTUAL,
           doc_number TEXT GENERATED ALWAYS AS (json_extract(payload, '$.docNumber')) VIRTUAL,
           issued_at TEXT GENERATED ALWAYS AS (json_extract(payload, '$.issuedAt')) VIRTUAL,
           room_number TEXT GENERATED ALWAYS AS (json_extract(payload, '$.roomNumber')) VIRTUAL,
           event_timestamp TEXT GENERATED ALWAYS AS (json_extract(payload, '$.timestamp')) VIRTUAL,
           category TEXT GENERATED ALWAYS AS (json_extract(payload, '$.category')) VIRTUAL,
           PRIMARY KEY(workspace_id, entity, entity_id),
           FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
         );
         CREATE INDEX idx_entity_records_page
           ON entity_records(workspace_id, entity, updated_at, entity_id);
         CREATE INDEX idx_entity_records_sector
           ON entity_records(workspace_id, entity, sector);
         CREATE INDEX idx_entity_records_status
           ON entity_records(workspace_id, entity, status);
         CREATE INDEX idx_entity_records_doc_number
           ON entity_records(workspace_id, doc_number)
           WHERE doc_number IS NOT NULL;
         CREATE INDEX idx_entity_records_room
           ON entity_records(workspace_id, room_number)
           WHERE room_number IS NOT NULL;
         CREATE INDEX idx_entity_records_event_time
           ON entity_records(workspace_id, event_timestamp)
           WHERE event_timestamp IS NOT NULL;
         CREATE INDEX idx_entity_records_category
           ON entity_records(workspace_id, category)
           WHERE category IS NOT NULL;
         INSERT OR IGNORE INTO schema_migrations(version) VALUES (5);
         COMMIT;",
    )?;
    Ok(())
}

impl PmsDatabase {
    /// Store a complete JSON document for a non-booking PMS entity.
    /// Unknown JSON fields are retained verbatim; the indexed columns are generated
    /// from the document and are never used to reconstruct or rewrite its payload.
    pub fn upsert_entity_record(
        &self,
        workspace_id: &str,
        entity: &str,
        entity_id: &str,
        payload: &str,
        version: i64,
        updated_at: &str,
    ) -> rusqlite::Result<()> {
        if entity.trim().is_empty() || entity_id.trim().is_empty() || version <= 0 {
            return Err(rusqlite::Error::InvalidParameterName(
                "entity, entity_id and positive version are required".into(),
            ));
        }
        let parsed: Value = serde_json::from_str(payload).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                0,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })?;
        if !parsed.is_object() {
            return Err(rusqlite::Error::InvalidParameterName(
                "entity payload must be a JSON object".into(),
            ));
        }

        let tx = self.connection.unchecked_transaction()?;
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=?1)",
            params![workspace_id],
            |row| row.get(0),
        )?;
        if !exists {
            return Err(rusqlite::Error::InvalidParameterName(
                "workspace does not exist".into(),
            ));
        }
        let current: Option<(String, i64)> = tx
            .query_row(
                "SELECT payload, version FROM entity_records
                 WHERE workspace_id=?1 AND entity=?2 AND entity_id=?3",
                params![workspace_id, entity, entity_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;

        match current {
            Some((_, current_version)) if version < current_version => {
                // Stale replication is ignored; it must never replace newer local data.
            }
            Some((current_payload, current_version)) if version == current_version => {
                if current_payload != payload {
                    return Err(rusqlite::Error::InvalidParameterName(
                        "entity version collision: equal version carries different payload; preserve both and resolve conflict".into(),
                    ));
                }
                // Exact replay: idempotent, no write required.
            }
            _ => {
                tx.execute(
                    "INSERT INTO entity_records(workspace_id,entity,entity_id,payload,version,updated_at)
                     VALUES (?1,?2,?3,?4,?5,?6)
                     ON CONFLICT(workspace_id,entity,entity_id) DO UPDATE SET
                       payload=excluded.payload,
                       version=excluded.version,
                       updated_at=excluded.updated_at
                     WHERE excluded.version > entity_records.version",
                    params![workspace_id, entity, entity_id, payload, version, updated_at],
                )?;
            }
        }
        tx.commit()
    }


    /// Local entity mutation: entity row, Supabase Outbox and P2P event share one transaction.
    /// Remote replication must use a separate merge path and must never call this method.
    pub fn upsert_entity_record_with_p2p(
        &self,
        workspace_id: &str,
        entity: &str,
        entity_id: &str,
        payload: &str,
        version: i64,
        updated_at: &str,
        idempotency_key: &str,
        node_id: &str,
        created_at: &str,
    ) -> Result<(), String> {
        if entity.trim().is_empty()
            || entity_id.trim().is_empty()
            || version <= 0
            || idempotency_key.trim().is_empty()
            || node_id.trim().is_empty()
            || updated_at.trim().is_empty()
            || created_at.trim().is_empty()
        {
            return Err("entity identity, positive version, idempotency key, node ID and timestamps are required".into());
        }
        let parsed: Value = serde_json::from_str(payload).map_err(|error| error.to_string())?;
        if !parsed.is_object() {
            return Err("entity payload must be a JSON object".into());
        }

        let tx = self.connection.unchecked_transaction().map_err(|e| e.to_string())?;
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=?1)",
            params![workspace_id],
            |row| row.get(0),
        ).map_err(|e| e.to_string())?;
        if !exists {
            return Err("workspace does not exist".into());
        }
        if super::check_idempotency(
            &tx,
            idempotency_key,
            workspace_id,
            entity,
            entity_id,
            "upsert",
            Some(payload),
        )? {
            tx.commit().map_err(|e| e.to_string())?;
            return Ok(());
        }

        let current: Option<(String, i64)> = tx.query_row(
            "SELECT payload, version FROM entity_records
             WHERE workspace_id=?1 AND entity=?2 AND entity_id=?3",
            params![workspace_id, entity, entity_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).optional().map_err(|e| e.to_string())?;
        match current {
            Some((_, current_version)) if version < current_version => {
                return Err("stale local entity version rejected; use the remote merge API for replicated data".into());
            }
            Some((current_payload, current_version)) if version == current_version => {
                if current_payload != payload {
                    return Err("entity version collision: equal version carries different payload".into());
                }
                tx.commit().map_err(|e| e.to_string())?;
                return Ok(());
            }
            _ => {}
        }

        tx.execute(
            "INSERT INTO entity_records(workspace_id,entity,entity_id,payload,version,updated_at)
             VALUES (?1,?2,?3,?4,?5,?6)
             ON CONFLICT(workspace_id,entity,entity_id) DO UPDATE SET
               payload=excluded.payload, version=excluded.version, updated_at=excluded.updated_at
             WHERE excluded.version > entity_records.version",
            params![workspace_id, entity, entity_id, payload, version, updated_at],
        ).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO outbox(id,idempotency_key,workspace_id,entity,entity_id,operation,version,base_server_version,payload)
             VALUES (?1,?2,?3,?4,?5,'upsert',?6,0,?7)",
            params![uuid::Uuid::new_v4().to_string(), idempotency_key, workspace_id, entity, entity_id, version, payload],
        ).map_err(|e| e.to_string())?;
        super::database_p2p::create_local_event_in_transaction(
            &tx,
            super::NewP2pEvent {
                workspace_id,
                node_id,
                entity,
                entity_id,
                operation: crate::p2p::P2pOperation::Upsert,
                payload: Some(parsed),
                created_at,
            },
        )?;
        tx.commit().map_err(|e| e.to_string())
    }

    pub fn get_entity_record(
        &self,
        workspace_id: &str,
        entity: &str,
        entity_id: &str,
    ) -> rusqlite::Result<Option<EntityRecord>> {
        self.connection
            .query_row(
                "SELECT workspace_id,entity,entity_id,payload,version,updated_at
                 FROM entity_records WHERE workspace_id=?1 AND entity=?2 AND entity_id=?3",
                params![workspace_id, entity, entity_id],
                |row| {
                    Ok(EntityRecord {
                        workspace_id: row.get(0)?,
                        entity: row.get(1)?,
                        entity_id: row.get(2)?,
                        payload: row.get(3)?,
                        version: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                },
            )
            .optional()
    }

    /// Keyset pagination avoids loading whole stores and remains stable for equal timestamps.
    pub fn list_entity_records(
        &self,
        workspace_id: &str,
        entity: &str,
        after: Option<(&str, &str)>,
        limit: u32,
    ) -> rusqlite::Result<Vec<EntityRecord>> {
        let mut statement = self.connection.prepare(
            "SELECT workspace_id,entity,entity_id,payload,version,updated_at
             FROM entity_records
             WHERE workspace_id=?1 AND entity=?2
               AND (?3 IS NULL OR updated_at > ?3 OR (updated_at = ?3 AND entity_id > ?4))
             ORDER BY updated_at,entity_id LIMIT ?5",
        )?;
        let (after_updated_at, after_id) = after.unwrap_or(("", ""));
        let rows = statement.query_map(
            params![
                workspace_id,
                entity,
                if after.is_some() {
                    Some(after_updated_at)
                } else {
                    None
                },
                after_id,
                limit.clamp(1, 500)
            ],
            |row| {
                Ok(EntityRecord {
                    workspace_id: row.get(0)?,
                    entity: row.get(1)?,
                    entity_id: row.get(2)?,
                    payload: row.get(3)?,
                    version: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )?;
        rows.collect()
    }

    pub fn delete_entity_record(
        &self,
        workspace_id: &str,
        entity: &str,
        entity_id: &str,
    ) -> rusqlite::Result<bool> {
        let _ = (workspace_id, entity, entity_id);
        Err(rusqlite::Error::InvalidParameterName(
            "physical entity deletion is disabled: use a versioned tombstone and durable Outbox mutation".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> PmsDatabase {
        let db = PmsDatabase::in_memory().unwrap();
        db.ensure_workspace("ws-a", "owner-a", "A").unwrap();
        db.ensure_workspace("ws-b", "owner-b", "B").unwrap();
        db
    }

    #[test]
    fn entity_payload_preserves_unknown_fields_and_workspace_scope() {
        let db = db();
        let payload = r#"{"id":"r-1","sector":"hotel","customFutureField":{"enabled":true}}"#;
        db.upsert_entity_record(
            "ws-a",
            "resources",
            "r-1",
            payload,
            1,
            "2026-11-22T10:00:00Z",
        )
        .unwrap();
        let stored = db
            .get_entity_record("ws-a", "resources", "r-1")
            .unwrap()
            .unwrap();
        assert_eq!(stored.payload, payload);
        assert!(db
            .get_entity_record("ws-b", "resources", "r-1")
            .unwrap()
            .is_none());
    }

    #[test]
    fn entity_pagination_is_keyset_ordered_and_bounded() {
        let db = db();
        for id in ["a", "b", "c"] {
            let payload = format!(r#"{{"id":"{id}","status":"active"}}"#);
            db.upsert_entity_record(
                "ws-a",
                "issuedCards",
                id,
                &payload,
                1,
                "2026-11-22T10:00:00Z",
            )
            .unwrap();
        }
        let first = db
            .list_entity_records("ws-a", "issuedCards", None, 2)
            .unwrap();
        assert_eq!(
            first
                .iter()
                .map(|row| row.entity_id.as_str())
                .collect::<Vec<_>>(),
            vec!["a", "b"]
        );
        let next = db
            .list_entity_records(
                "ws-a",
                "issuedCards",
                Some((&first[1].updated_at, &first[1].entity_id)),
                2,
            )
            .unwrap();
        assert_eq!(
            next.iter()
                .map(|row| row.entity_id.as_str())
                .collect::<Vec<_>>(),
            vec!["c"]
        );
    }

    #[test]
    fn equal_version_with_different_payload_is_rejected_without_overwrite() {
        let db = db();
        db.upsert_entity_record(
            "ws-a",
            "invoices",
            "i-2",
            r#"{"id":"i-2","status":"paid"}"#,
            7,
            "2026-11-22T10:00:00Z",
        )
        .unwrap();

        let conflict = db.upsert_entity_record(
            "ws-a",
            "invoices",
            "i-2",
            r#"{"id":"i-2","status":"draft"}"#,
            7,
            "2026-11-22T11:00:00Z",
        );
        assert!(conflict.is_err());
        let stored = db
            .get_entity_record("ws-a", "invoices", "i-2")
            .unwrap()
            .unwrap();
        assert_eq!(stored.payload, r#"{"id":"i-2","status":"paid"}"#);
        assert_eq!(stored.version, 7);
    }

    #[test]
    fn entity_upsert_does_not_replace_a_newer_version() {
        let db = db();
        db.upsert_entity_record(
            "ws-a",
            "invoices",
            "i-1",
            r#"{"id":"i-1","status":"paid"}"#,
            8,
            "2026-11-22T10:00:00Z",
        )
        .unwrap();
        db.upsert_entity_record(
            "ws-a",
            "invoices",
            "i-1",
            r#"{"id":"i-1","status":"draft"}"#,
            7,
            "2026-11-22T09:00:00Z",
        )
        .unwrap();
        let stored = db
            .get_entity_record("ws-a", "invoices", "i-1")
            .unwrap()
            .unwrap();
        assert_eq!(stored.version, 8);
        assert!(stored.payload.contains("paid"));
    }
}
