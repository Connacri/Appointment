use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

/// Immutable, transport-neutral Appointment P2P event envelope (protocol v1).
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct P2pEvent {
    pub protocol_version: u16,
    pub event_id: String,
    pub node_id: String,
    pub sequence: u64,
    pub workspace_id: String,
    pub entity: String,
    pub entity_id: String,
    pub operation: P2pOperation,
    pub payload: Option<Value>,
    pub clock: BTreeMap<String, u64>,
    pub created_at: String,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum P2pOperation {
    Upsert,
    Delete,
}

#[derive(Clone, Debug, PartialEq)]
pub enum P2pRecordState {
    Missing,
    Resolved(P2pEvent),
    Conflict(Vec<P2pEvent>),
}

impl P2pEvent {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.protocol_version != 1 {
            return Err("unsupported P2P protocol version");
        }
        if self.node_id.trim().is_empty()
            || self.workspace_id.trim().is_empty()
            || self.entity.trim().is_empty()
            || self.entity_id.trim().is_empty()
        {
            return Err("P2P event identity and scope fields are required");
        }
        if self.sequence == 0 || self.event_id != format!("{}:{}", self.node_id, self.sequence) {
            return Err("P2P event ID must match a positive node sequence");
        }
        if self.created_at.trim().is_empty() {
            return Err("P2P event timestamp is required");
        }
        match (&self.operation, &self.payload) {
            (P2pOperation::Upsert, Some(Value::Object(_))) => {}
            (P2pOperation::Upsert, _) => return Err("P2P upsert requires an object payload"),
            (P2pOperation::Delete, None) => {}
            (P2pOperation::Delete, Some(_)) => return Err("P2P delete must not contain a payload"),
        }
        if self.clock.get(&self.node_id).copied() != Some(self.sequence) {
            return Err("P2P event clock must contain its own node sequence");
        }
        if self.clock.iter().any(|(node, sequence)| node.trim().is_empty() || *sequence == 0) {
            return Err("P2P event clock contains an invalid node or sequence");
        }
        Ok(())
    }
}

pub fn happens_before(a: &P2pEvent, b: &P2pEvent) -> bool {
    a.event_id != b.event_id && b.clock.get(&a.node_id).copied().unwrap_or(0) >= a.sequence
}

/// Deterministic set-union merge. A duplicate event ID with different bytes is equivocation.
pub fn merge_events(
    local: &[P2pEvent],
    incoming: &[P2pEvent],
) -> Result<Vec<P2pEvent>, &'static str> {
    let mut merged = BTreeMap::<String, P2pEvent>::new();
    for event in local.iter().chain(incoming.iter()) {
        event.validate()?;
        if let Some(existing) = merged.get(&event.event_id) {
            if existing != event {
                return Err("P2P event ID collision or node equivocation");
            }
        } else {
            merged.insert(event.event_id.clone(), event.clone());
        }
    }
    Ok(merged.into_values().collect())
}

/// Keep only causally maximal events. Concurrent writes are deliberately retained.
pub fn maximal_events(events: &[P2pEvent]) -> Vec<P2pEvent> {
    let mut maximal: Vec<P2pEvent> = events
        .iter()
        .filter(|candidate| !events.iter().any(|other| happens_before(candidate, other)))
        .cloned()
        .collect();
    maximal.sort_by(|a, b| {
        a.node_id
            .cmp(&b.node_id)
            .then(a.sequence.cmp(&b.sequence))
            .then(a.event_id.cmp(&b.event_id))
    });
    maximal
}

pub fn record_state(events: &[P2pEvent]) -> P2pRecordState {
    if events.is_empty() {
        return P2pRecordState::Missing;
    }
    let frontier = maximal_events(events);
    if frontier.len() == 1 {
        P2pRecordState::Resolved(frontier.into_iter().next().expect("one event"))
    } else {
        P2pRecordState::Conflict(frontier)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn event(node: &str, sequence: u64, clock: &[(&str, u64)], payload: Option<Value>) -> P2pEvent {
        P2pEvent {
            protocol_version: 1,
            event_id: format!("{node}:{sequence}"),
            node_id: node.into(),
            sequence,
            workspace_id: "workspace-1".into(),
            entity: "booking".into(),
            entity_id: "booking-1".into(),
            operation: if payload.is_some() { P2pOperation::Upsert } else { P2pOperation::Delete },
            payload,
            clock: clock.iter().map(|(node, seq)| ((*node).to_string(), *seq)).collect(),
            created_at: "2026-11-22T12:00:00.000Z".into(),
        }
    }

    #[test]
    fn validates_event_identity_and_clock() {
        assert!(event("a", 1, &[("a", 1)], Some(json!({"x": 1}))).validate().is_ok());
        assert!(event("a", 1, &[("a", 2)], Some(json!({"x": 1}))).validate().is_err());
    }

    #[test]
    fn merges_idempotently_and_rejects_equivocation() {
        let a = event("a", 1, &[("a", 1)], Some(json!({"x": 1})));
        assert_eq!(merge_events(&[a.clone()], &[a.clone()]).unwrap().len(), 1);
        let forged = event("a", 1, &[("a", 1)], Some(json!({"x": 2})));
        assert!(merge_events(&[a], &[forged]).is_err());
    }

    #[test]
    fn causal_successor_replaces_older_frontier() {
        let first = event("a", 1, &[("a", 1)], Some(json!({"x": 1})));
        let second = event("b", 1, &[("a", 1), ("b", 1)], Some(json!({"x": 2})));
        assert!(happens_before(&first, &second));
        assert!(matches!(record_state(&[first, second.clone()]), P2pRecordState::Resolved(found) if found == second));
    }

    #[test]
    fn concurrent_updates_remain_a_deterministic_conflict() {
        let a = event("a", 2, &[("a", 2), ("b", 1)], Some(json!({"guest": "Alice"})));
        let b = event("b", 2, &[("a", 1), ("b", 2)], Some(json!({"guest": "Bob"})));
        let ab = merge_events(&[a.clone()], &[b.clone()]).unwrap();
        let ba = merge_events(&[b], &[a]).unwrap();
        assert_eq!(ab, ba);
        assert!(matches!(record_state(&ab), P2pRecordState::Conflict(events) if events.len() == 2));
    }

    #[test]
    fn concurrent_delete_and_update_are_not_silently_resolved() {
        let delete = event("a", 2, &[("a", 2), ("b", 1)], None);
        let update = event("b", 2, &[("a", 1), ("b", 2)], Some(json!({"guest": "Updated"})));
        assert!(matches!(record_state(&[delete, update]), P2pRecordState::Conflict(_)));
    }
}
