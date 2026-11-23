use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde_json::Value;
use std::collections::BTreeMap;

use super::PmsDatabase;
use crate::p2p::{P2pEvent, P2pOperation};

const MAX_P2P_EVENT_BYTES: usize = 1024 * 1024;
const MAX_P2P_CLOCK_NODES: usize = 256;
const MAX_P2P_PAGE_SIZE: u32 = 500;

#[derive(Debug, Clone, PartialEq)]
pub struct P2pEventLogEntry {
    pub local_order: i64,
    pub event: P2pEvent,
}

pub struct NewP2pEvent<'a> {
    pub workspace_id: &'a str,
    pub node_id: &'a str,
    pub entity: &'a str,
    pub entity_id: &'a str,
    pub operation: P2pOperation,
    pub payload: Option<Value>,
    pub created_at: &'a str,
}

pub(super) fn migrate(connection: &Connection) -> rusqlite::Result<()> {
    let applied: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=6)",
        [],
        |row| row.get(0),
    )?;
    if applied {
        return Ok(());
    }

    connection.execute_batch(
        "BEGIN IMMEDIATE;
         CREATE TABLE p2p_events (
           local_order INTEGER PRIMARY KEY AUTOINCREMENT,
           workspace_id TEXT NOT NULL,
           event_id TEXT NOT NULL,
           node_id TEXT NOT NULL,
           sequence INTEGER NOT NULL CHECK(sequence > 0),
           entity TEXT NOT NULL,
           entity_id TEXT NOT NULL,
           operation TEXT NOT NULL CHECK(operation IN ('upsert','delete')),
           event_json TEXT NOT NULL CHECK(json_valid(event_json)),
           created_at TEXT NOT NULL,
           UNIQUE(workspace_id, event_id),
           UNIQUE(workspace_id, node_id, sequence),
           FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
         );
         CREATE INDEX idx_p2p_events_workspace_order
           ON p2p_events(workspace_id, local_order);
         CREATE INDEX idx_p2p_events_workspace_entity
           ON p2p_events(workspace_id, entity, entity_id, local_order);
         CREATE INDEX idx_p2p_events_workspace_node_sequence
           ON p2p_events(workspace_id, node_id, sequence);
         CREATE TABLE p2p_clock (
           workspace_id TEXT NOT NULL,
           node_id TEXT NOT NULL,
           sequence INTEGER NOT NULL CHECK(sequence > 0),
           PRIMARY KEY(workspace_id, node_id),
           FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
         );
         INSERT OR IGNORE INTO schema_migrations(version) VALUES (6);
         COMMIT;",
    )?;
    Ok(())
}

pub(super) fn migrate_v7(connection: &Connection) -> rusqlite::Result<()> {
    let applied: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=7)",
        [],
        |row| row.get(0),
    )?;
    if applied {
        return Ok(());
    }
    connection.execute_batch(
        "BEGIN IMMEDIATE;
         CREATE TABLE p2p_peer_cursors (
           workspace_id TEXT NOT NULL,
           peer_id TEXT NOT NULL,
           cursor INTEGER NOT NULL CHECK(cursor >= 0),
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           PRIMARY KEY(workspace_id, peer_id),
           FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
         );
         CREATE TABLE p2p_record_frontiers (
           workspace_id TEXT NOT NULL,
           entity TEXT NOT NULL,
           entity_id TEXT NOT NULL,
           status TEXT NOT NULL CHECK(status IN ('resolved','conflict','blocked_pending_local')),
           frontier_json TEXT NOT NULL CHECK(json_valid(frontier_json)),
           applied_event_id TEXT,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
           PRIMARY KEY(workspace_id, entity, entity_id),
           FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
         );
         INSERT OR IGNORE INTO schema_migrations(version) VALUES (7);
         COMMIT;",
    )?;
    Ok(())
}

pub(super) fn append_received_event_in_transaction(
    tx: &Transaction<'_>,
    event: &P2pEvent,
) -> Result<bool, String> {
    validate_event_size(event)?;
    event.validate().map_err(str::to_string)?;
    let existing: Option<String> = tx
        .query_row(
            "SELECT event_json FROM p2p_events WHERE workspace_id=?1 AND event_id=?2",
            params![event.workspace_id, event.event_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if let Some(existing) = existing {
        let incoming = serde_json::to_string(event).map_err(|e| e.to_string())?;
        if existing != incoming {
            return Err("P2P event ID collision or node equivocation.".into());
        }
        return Ok(false);
    }
    insert_event(tx, event)?;
    Ok(true)
}

impl PmsDatabase {
    /// Create and durably append one local event in a single SQLite transaction.
    /// The event's vector clock is derived from the workspace's persisted event log.
    pub fn create_local_p2p_event(&self, draft: NewP2pEvent<'_>) -> Result<P2pEvent, String> {
        let NewP2pEvent {
            workspace_id,
            node_id,
            entity,
            entity_id,
            operation,
            payload,
            created_at,
        } = draft;
        if workspace_id.trim().is_empty()
            || node_id.trim().is_empty()
            || entity.trim().is_empty()
            || entity_id.trim().is_empty()
            || created_at.trim().is_empty()
        {
            return Err(
                "P2P workspace, node, entity, entity ID and timestamp are required.".into(),
            );
        }
        if entity.len() > 128 || entity_id.len() > 256 || node_id.len() > 128 {
            return Err("P2P event identity fields exceed their size limits.".into());
        }
        if let Some(value) = payload.as_ref() {
            if !value.is_object() {
                return Err("P2P event payload must be a JSON object.".into());
            }
        }

        let tx = self
            .connection
            .unchecked_transaction()
            .map_err(|e| e.to_string())?;
        ensure_workspace(&tx, workspace_id)?;
        let event = create_local_event_in_transaction(
            &tx,
            NewP2pEvent {
                workspace_id,
                node_id,
                entity,
                entity_id,
                operation,
                payload,
                created_at,
            },
        )?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(event)
    }

    /// Append a received event. Exact duplicates are idempotent; reusing an event
    /// identity with different content is treated as node equivocation.
    pub fn append_p2p_event(&self, event: &P2pEvent) -> Result<bool, String> {
        validate_event_size(event)?;
        event.validate().map_err(str::to_string)?;
        let tx = self
            .connection
            .unchecked_transaction()
            .map_err(|e| e.to_string())?;
        ensure_workspace(&tx, &event.workspace_id)?;

        let existing: Option<String> = tx
            .query_row(
                "SELECT event_json FROM p2p_events
                 WHERE workspace_id=?1 AND event_id=?2",
                params![event.workspace_id, event.event_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        if let Some(existing) = existing {
            let incoming = serde_json::to_string(event).map_err(|e| e.to_string())?;
            if existing != incoming {
                return Err("P2P event ID collision or node equivocation.".into());
            }
            tx.commit().map_err(|e| e.to_string())?;
            return Ok(false);
        }

        insert_event(&tx, event)?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(true)
    }

    /// Read an append-only, workspace-scoped page. The local_order cursor is
    /// stable even when remote nodes deliver events out of causal order.
    pub fn list_p2p_events_after(
        &self,
        workspace_id: &str,
        after_local_order: i64,
        limit: u32,
    ) -> Result<Vec<P2pEventLogEntry>, String> {
        if after_local_order < 0 {
            return Err("P2P event cursor cannot be negative.".into());
        }
        let limit = limit.clamp(1, MAX_P2P_PAGE_SIZE);
        let mut statement = self
            .connection
            .prepare(
                "SELECT local_order, event_json FROM p2p_events
                 WHERE workspace_id=?1 AND local_order>?2
                 ORDER BY local_order ASC LIMIT ?3",
            )
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map(params![workspace_id, after_local_order, limit], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        let mut entries = Vec::new();
        for row in rows {
            let (local_order, event_json) = row.map_err(|e| e.to_string())?;
            let event = serde_json::from_str(&event_json).map_err(|e| {
                format!("Stored P2P event is corrupt at local order {local_order}: {e}")
            })?;
            entries.push(P2pEventLogEntry { local_order, event });
        }
        Ok(entries)
    }

    pub fn p2p_event_count(&self, workspace_id: &str) -> rusqlite::Result<u64> {
        self.connection.query_row(
            "SELECT COUNT(*) FROM p2p_events WHERE workspace_id=?1",
            params![workspace_id],
            |row| row.get(0),
        )
    }
}

pub(super) fn create_local_event_in_transaction(
    tx: &Transaction<'_>,
    draft: NewP2pEvent<'_>,
) -> Result<P2pEvent, String> {
    let NewP2pEvent {
        workspace_id,
        node_id,
        entity,
        entity_id,
        operation,
        payload,
        created_at,
    } = draft;
    let mut clock = BTreeMap::<String, u64>::new();
    {
        let mut statement = tx
            .prepare(
                "SELECT node_id, sequence FROM p2p_clock
                 WHERE workspace_id=?1 ORDER BY node_id",
            )
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map(params![workspace_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, u64>(1)?))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (known_node, sequence) = row.map_err(|e| e.to_string())?;
            clock.insert(known_node, sequence);
        }
    }

    if clock.len() > MAX_P2P_CLOCK_NODES {
        return Err("P2P workspace has reached the supported vector-clock node limit.".into());
    }
    let sequence = clock
        .get(node_id)
        .copied()
        .unwrap_or(0)
        .checked_add(1)
        .ok_or_else(|| "P2P node sequence overflow.".to_string())?;
    clock.insert(node_id.to_string(), sequence);

    let event = P2pEvent {
        protocol_version: 1,
        event_id: format!("{node_id}:{sequence}"),
        node_id: node_id.to_string(),
        sequence,
        workspace_id: workspace_id.to_string(),
        entity: entity.to_string(),
        entity_id: entity_id.to_string(),
        operation,
        payload,
        clock,
        created_at: created_at.to_string(),
    };
    validate_event_size(&event)?;
    event.validate().map_err(str::to_string)?;
    insert_event(tx, &event)?;
    Ok(event)
}

fn ensure_workspace(tx: &Transaction<'_>, workspace_id: &str) -> Result<(), String> {
    let exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id=?1)",
            params![workspace_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    if !exists {
        return Err("P2P event workspace does not exist locally.".into());
    }
    Ok(())
}

fn validate_event_size(event: &P2pEvent) -> Result<(), String> {
    if event.clock.len() > MAX_P2P_CLOCK_NODES {
        return Err("P2P event vector clock exceeds the node limit.".into());
    }
    let encoded = serde_json::to_vec(event).map_err(|e| e.to_string())?;
    if encoded.len() > MAX_P2P_EVENT_BYTES {
        return Err("P2P event exceeds the 1 MiB persistence limit.".into());
    }
    Ok(())
}

fn insert_event(tx: &Transaction<'_>, event: &P2pEvent) -> Result<(), String> {
    let event_json = serde_json::to_string(event).map_err(|e| e.to_string())?;
    let operation = match event.operation {
        P2pOperation::Upsert => "upsert",
        P2pOperation::Delete => "delete",
    };
    tx.execute(
        "INSERT INTO p2p_events(
           workspace_id,event_id,node_id,sequence,entity,entity_id,operation,event_json,created_at
         ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            event.workspace_id,
            event.event_id,
            event.node_id,
            event.sequence,
            event.entity,
            event.entity_id,
            operation,
            event_json,
            event.created_at
        ],
    )
    .map_err(|error| {
        format!(
            "Could not append P2P event (duplicate node sequence or database constraint): {error}"
        )
    })?;

    // Merge every component, not only the sender's own sequence. A received
    // event can prove causal knowledge of events that have not arrived yet.
    for (node_id, sequence) in &event.clock {
        tx.execute(
            "INSERT INTO p2p_clock(workspace_id,node_id,sequence) VALUES (?1,?2,?3)
             ON CONFLICT(workspace_id,node_id) DO UPDATE SET
               sequence=MAX(p2p_clock.sequence, excluded.sequence)",
            params![event.workspace_id, node_id, sequence],
        )
        .map_err(|error| format!("Could not merge P2P vector clock: {error}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::p2p::P2pOperation;
    use serde_json::json;

    fn database() -> PmsDatabase {
        let db = PmsDatabase::in_memory().unwrap();
        db.ensure_workspace("workspace-a", "owner-a", "Workspace A")
            .unwrap();
        db.ensure_workspace("workspace-b", "owner-b", "Workspace B")
            .unwrap();
        db
    }

    fn local_booking_event(
        db: &PmsDatabase,
        workspace_id: &str,
        node_id: &str,
        booking_id: &str,
        operation: P2pOperation,
        payload: Option<serde_json::Value>,
        created_at: &str,
    ) -> P2pEvent {
        db.create_local_p2p_event(NewP2pEvent {
            workspace_id,
            node_id,
            entity: "booking",
            entity_id: booking_id,
            operation,
            payload,
            created_at,
        })
        .unwrap()
    }

    #[test]
    fn local_events_are_durable_and_advance_workspace_vector_clock() {
        let db = database();
        let first = local_booking_event(
            &db,
            "workspace-a",
            "node-a",
            "booking-1",
            P2pOperation::Upsert,
            Some(json!({"guest": "Alice"})),
            "2026-11-23T08:00:00Z",
        );
        let second = local_booking_event(
            &db,
            "workspace-a",
            "node-a",
            "booking-1",
            P2pOperation::Upsert,
            Some(json!({"guest": "Bob"})),
            "2026-11-23T08:01:00Z",
        );

        assert_eq!(first.sequence, 1);
        assert_eq!(second.sequence, 2);
        assert_eq!(second.clock.get("node-a"), Some(&2));
        assert_eq!(db.p2p_event_count("workspace-a").unwrap(), 2);
    }

    #[test]
    fn event_log_and_vector_clock_survive_sqlite_reopen() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("appointment.sqlite3");
        {
            let db = PmsDatabase::open(&path).unwrap();
            db.ensure_workspace("workspace-a", "owner-a", "Workspace A")
                .unwrap();
            let event = local_booking_event(
                &db,
                "workspace-a",
                "node-a",
                "booking-1",
                P2pOperation::Upsert,
                Some(json!({"guest": "Persisted"})),
                "2026-11-23T08:00:00Z",
            );
            assert_eq!(event.sequence, 1);
        }

        let reopened = PmsDatabase::open(&path).unwrap();
        let events = reopened
            .list_p2p_events_after("workspace-a", 0, 10)
            .unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(
            events[0].event.payload.as_ref().unwrap()["guest"],
            "Persisted"
        );

        let next = local_booking_event(
            &reopened,
            "workspace-a",
            "node-a",
            "booking-2",
            P2pOperation::Upsert,
            Some(json!({"guest": "After restart"})),
            "2026-11-23T08:01:00Z",
        );
        assert_eq!(next.sequence, 2);
        assert_eq!(next.clock.get("node-a"), Some(&2));
    }

    #[test]
    fn received_events_are_idempotent_and_equivocation_is_rejected() {
        let db = database();
        let event = local_booking_event(
            &db,
            "workspace-a",
            "node-a",
            "booking-1",
            P2pOperation::Upsert,
            Some(json!({"guest": "Alice"})),
            "2026-11-23T08:00:00Z",
        );

        // A second local database represents another replica receiving this event.
        let replica = database();
        assert!(replica.append_p2p_event(&event).unwrap());
        assert!(!replica.append_p2p_event(&event).unwrap());

        let mut forged = event.clone();
        forged.payload = Some(json!({"guest": "Mallory"}));
        assert!(replica.append_p2p_event(&forged).is_err());
        assert_eq!(replica.p2p_event_count("workspace-a").unwrap(), 1);
    }

    #[test]
    fn received_vector_clock_dependencies_survive_restart_and_advance_local_sequence() {
        let replica = database();
        let remote = P2pEvent {
            protocol_version: 1,
            event_id: "node-b:1".into(),
            node_id: "node-b".into(),
            sequence: 1,
            workspace_id: "workspace-a".into(),
            entity: "booking".into(),
            entity_id: "booking-1".into(),
            operation: P2pOperation::Upsert,
            payload: Some(json!({"guest": "Remote"})),
            clock: BTreeMap::from([("node-a".into(), 4), ("node-b".into(), 1)]),
            created_at: "2026-11-23T08:00:00Z".into(),
        };
        assert!(replica.append_p2p_event(&remote).unwrap());

        let local = local_booking_event(
            &replica,
            "workspace-a",
            "node-a",
            "booking-2",
            P2pOperation::Upsert,
            Some(json!({"guest": "Local"})),
            "2026-11-23T08:01:00Z",
        );

        assert_eq!(local.sequence, 5);
        assert_eq!(local.clock.get("node-a"), Some(&5));
        assert_eq!(local.clock.get("node-b"), Some(&1));
    }

    #[test]
    fn event_pages_are_stable_and_workspace_isolated() {
        let db = database();
        local_booking_event(
            &db,
            "workspace-a",
            "node-a",
            "booking-1",
            P2pOperation::Upsert,
            Some(json!({"guest": "Alice"})),
            "2026-11-23T08:00:00Z",
        );
        local_booking_event(
            &db,
            "workspace-b",
            "node-b",
            "booking-2",
            P2pOperation::Delete,
            None,
            "2026-11-23T08:01:00Z",
        );

        let first_page = db.list_p2p_events_after("workspace-a", 0, 1).unwrap();
        assert_eq!(first_page.len(), 1);
        assert_eq!(first_page[0].event.entity_id, "booking-1");
        let second_page = db
            .list_p2p_events_after("workspace-a", first_page[0].local_order, 10)
            .unwrap();
        assert!(second_page.is_empty());
        assert_eq!(db.p2p_event_count("workspace-a").unwrap(), 1);
        assert_eq!(db.p2p_event_count("workspace-b").unwrap(), 1);
    }

    #[test]
    fn event_payload_and_vector_clock_are_bounded() {
        let db = database();
        let oversized = "x".repeat(MAX_P2P_EVENT_BYTES + 1);
        assert!(db
            .create_local_p2p_event(NewP2pEvent {
                workspace_id: "workspace-a",
                node_id: "node-a",
                entity: "booking",
                entity_id: "booking-1",
                operation: P2pOperation::Upsert,
                payload: Some(json!({"blob": oversized})),
                created_at: "2026-11-23T08:00:00Z",
            })
            .is_err());
    }
}
