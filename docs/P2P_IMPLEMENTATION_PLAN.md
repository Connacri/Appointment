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

fn is_supported_entity(entity: &str) -> bool {
    matches!(
        entity,
        "booking"
            | "resource"
            | "resource_group"
            | "establishment"
            | "task"
            | "stock_item"
            | "stock_movement"
            | "supplier"
            | "purchase_order"
            | "invoice"
            | "dynamic_rate"
            | "staff_member"
            | "establishment_profile"
    )
}

fn is_valid_rfc3339_timestamp(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() < 20
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes[10] != b'T'
        || bytes[13] != b':'
        || bytes[16] != b':'
    {
        return false;
    }
    let digits = |start: usize, end: usize| -> Option<u32> {
        let slice = bytes.get(start..end)?;
        if !slice.iter().all(u8::is_ascii_digit) {
            return None;
        }
        std::str::from_utf8(slice).ok()?.parse().ok()
    };
    let Some(year) = digits(0, 4) else {
        return false;
    };
    let Some(month) = digits(5, 7) else {
        return false;
    };
    let Some(day) = digits(8, 10) else {
        return false;
    };
    let Some(hour) = digits(11, 13) else {
        return false;
    };
    let Some(minute) = digits(14, 16) else {
        return false;
    };
    let Some(second) = digits(17, 19) else {
        return false;
    };
    if year == 0
        || !(1..=12).contains(&month)
        || !(0..=23).contains(&hour)
        || minute > 59
        || second > 59
    {
        return false;
    }
    let leap_year = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_month = match month {
        2 if leap_year => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    if day == 0 || day > days_in_month {
        return false;
    }

    let mut index = 19;
    if bytes.get(index) == Some(&b'.') {
        index += 1;
        let fraction_start = index;
        while bytes.get(index).is_some_and(u8::is_ascii_digit) {
            index += 1;
        }
        if index == fraction_start {
            return false;
        }
    }
    match bytes.get(index) {
        Some(&b'Z') => index += 1,
        Some(&b'+') | Some(&b'-') => {
            if index + 6 != bytes.len() || bytes.get(index + 3) != Some(&b':') {
                return false;
            }
            let Some(offset_hour) = digits(index + 1, index + 3) else {
                return false;
            };
            let Some(offset_minute) = digits(index + 4, index + 6) else {
                return false;
            };
            if offset_hour > 23 || offset_minute > 59 {
                return false;
            }
            index += 6;
        }
        _ => return false,
    }
    index == bytes.len()
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
        if !is_valid_rfc3339_timestamp(&self.created_at) {
            return Err("P2P event timestamp must be a valid RFC 3339 timestamp");
        }
        if !is_supported_entity(&self.entity) {
            return Err("unsupported P2P entity type");
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
        if self.clock.len() > 256 {
            return Err("P2P event clock exceeds the supported 256-node limit");
        }
        if self.entity.len() > 128 || self.entity_id.len() > 256 || self.node_id.len() > 128 {
            return Err("P2P event identity fields exceed their size limits");
        }
        if self
            .clock
            .iter()
            .any(|(node, sequence)| node.trim().is_empty() || *sequence == 0 || node.len() > 128)
        {
            return Err("P2P event clock contains an invalid node or sequence");
        }
        Ok(())
    }
}

pub fn happens_before(a: &P2pEvent, b: &P2pEvent) -> bool {
    if a.event_id == b.event_id {
        return false;
    }

    let mut strictly_after = false;
    for (node_id, a_sequence) in &a.clock {
        let b_sequence = b.clock.get(node_id).copied().unwrap_or(0);
        if b_sequence < *a_sequence {
            return false;
        }
        if b_sequence > *a_sequence {
            strictly_after = true;
        }
    }
    for (node_id, b_sequence) in &b.clock {
        if !a.clock.contains_key(node_id) && *b_sequence > 0 {
            strictly_after = true;
        }
    }
    strictly_after
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
        return P2pRecordState::Resolved(frontier.into_iter().next().expect("one event"));
    }
    P2pRecordState::Conflict(frontier)
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
            operation: if payload.is_some() {
                P2pOperation::Upsert
            } else {
                P2pOperation::Delete
            },
            payload,
            clock: clock
                .iter()
                .map(|(node, seq)| ((*node).to_string(), *seq))
                .collect(),
            created_at: "2026-11-22T12:00:00.000Z".into(),
        }
    }

    #[test]
    fn enforces_supported_entities_and_rfc3339_timestamps() {
        let mut value = event("a", 1, &[("a", 1)], Some(json!({"x": 1})));
        assert!(value.validate().is_ok());

        value.entity = "unknown_entity".into();
        assert!(value.validate().is_err());

        for entity in [
            "booking",
            "resource",
            "resource_group",
            "establishment",
            "task",
            "stock_item",
            "stock_movement",
            "supplier",
            "purchase_order",
            "invoice",
            "dynamic_rate",
            "staff_member",
            "establishment_profile",
        ] {
            value.entity = entity.into();
            assert!(
                value.validate().is_ok(),
                "entity should be supported: {entity}"
            );
        }

        value.entity = "booking".into();
        value.created_at = "2026-02-30T12:00:00Z".into();
        assert!(value.validate().is_err());

        value.created_at = "2026-11-22 12:00:00".into();
        assert!(value.validate().is_err());

        value.created_at = "2026-11-22T12:00:00.123+01:00".into();
        assert!(value.validate().is_ok());
    }

    #[test]
    fn validates_event_identity_and_clock() {
        assert!(event("a", 1, &[("a", 1)], Some(json!({"x": 1})))
            .validate()
            .is_ok());
        assert!(event("a", 1, &[("a", 2)], Some(json!({"x": 1})))
            .validate()
            .is_err());
    }

    #[test]
    fn merges_idempotently_and_rejects_equivocation() {
        let a = event("a", 1, &[("a", 1)], Some(json!({"x": 1})));
        assert_eq!(
            merge_events(std::slice::from_ref(&a), std::slice::from_ref(&a))
                .unwrap()
                .len(),
            1
        );
        let forged = event("a", 1, &[("a", 1)], Some(json!({"x": 2})));
        assert!(merge_events(&[a], &[forged]).is_err());
    }

    #[test]
    fn causal_successor_replaces_older_frontier() {
        let first = event("a", 1, &[("a", 1)], Some(json!({"x": 1})));
        let second = event("b", 1, &[("a", 1), ("b", 1)], Some(json!({"x": 2})));
        assert!(happens_before(&first, &second));
        assert!(
            matches!(record_state(&[first, second.clone()]), P2pRecordState::Resolved(found) if found == second)
        );
    }

    #[test]
    fn concurrent_updates_remain_a_deterministic_conflict() {
        let a = event(
            "a",
            2,
            &[("a", 2), ("b", 1)],
            Some(json!({"guest": "Alice"})),
        );
        let b = event("b", 2, &[("a", 1), ("b", 2)], Some(json!({"guest": "Bob"})));
        let ab = merge_events(std::slice::from_ref(&a), std::slice::from_ref(&b)).unwrap();
        let ba = merge_events(std::slice::from_ref(&b), std::slice::from_ref(&a)).unwrap();
        assert_eq!(ab, ba);
        assert!(matches!(record_state(&ab), P2pRecordState::Conflict(events) if events.len() == 2));
    }

    #[test]
    fn causal_order_requires_every_vector_clock_component_to_be_observed() {
        let first = event(
            "a",
            2,
            &[("a", 2), ("c", 5)],
            Some(json!({"value": "causally prior"})),
        );
        let inconsistent_successor = event(
            "b",
            2,
            &[("a", 2), ("b", 2), ("c", 4)],
            Some(json!({"value": "missing transitive dependency"})),
        );

        // Seeing A:2 alone is insufficient: A:2 itself had already observed C:5.
        assert!(!happens_before(&first, &inconsistent_successor));
        assert!(matches!(
            record_state(&[first, inconsistent_successor]),
            P2pRecordState::Conflict(events) if events.len() == 2
        ));
    }

    #[test]
    fn concurrent_delete_and_update_are_not_silently_resolved() {
        let delete = event("a", 2, &[("a", 2), ("b", 1)], None);
        let update = event(
            "b",
            2,
            &[("a", 1), ("b", 2)],
            Some(json!({"guest": "Updated"})),
        );
        assert!(matches!(
            record_state(&[delete, update]),
            P2pRecordState::Conflict(_)
        ));
    }
}


Windows SQLite parity: schema v8 now provides the same bounded outbound event page and
exact offered-page durable ACK semantics as IndexedDB. Inbound peer cursors and outbound
peer ACK cursors remain separate. Both adapters retain events received from other peers
for relay; neither compacts the log before trusted peer membership/checkpoint safety exists.

Windows SQLite schema v8 adds a tested outbound peer cursor and exact-offered-page ACK API, with independent per-peer state and workspace-scoped event selection.

P2P page transfer now has a 4 MiB serialized-byte budget in addition to the 500-event inbound cap and 1 MiB per-event ceiling. Both IndexedDB and SQLite stop a page before exceeding the byte budget, so large payloads cannot create unbounded transport buffers.
