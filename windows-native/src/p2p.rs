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
            | "booking_conflict"
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

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookingConflictSnapshot {
    pub id: String,
    pub workspace_id: String,
    pub resource_id: String,
    pub first_booking_id: String,
    pub second_booking_id: String,
    pub first_event_id: String,
    pub second_event_id: String,
    pub start_at: String,
    pub end_at: String,
    pub detected_at: String,
    pub status: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub superseded_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub superseded_by_event_ids: Option<Vec<String>>,
}

#[derive(Clone)]
struct BookingConflictCandidate {
    event: P2pEvent,
    booking_id: String,
    resource_id: String,
    sector: String,
    start: i64,
    end: i64,
}

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let adjusted_year = year - if month <= 2 { 1 } else { 0 };
    let era = adjusted_year.div_euclid(400);
    let year_of_era = adjusted_year - era * 400;
    let adjusted_month = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * adjusted_month + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

fn civil_from_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let shifted = days_since_epoch + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += if month <= 2 { 1 } else { 0 };
    (year, month, day)
}

fn wall_clock_minute(date: &str, time: &str) -> Option<i64> {
    let mut date_parts = date.split('-');
    let year = date_parts.next()?.parse::<i64>().ok()?;
    let month = date_parts.next()?.parse::<i64>().ok()?;
    let day = date_parts.next()?.parse::<i64>().ok()?;
    if date_parts.next().is_some() || year < 1 || !(1..=12).contains(&month) {
        return None;
    }
    let leap_year = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days_in_month = match month {
        2 if leap_year => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    if day < 1 || day > days_in_month {
        return None;
    }

    let mut time_parts = time.split(':');
    let hour = time_parts.next()?.parse::<i64>().ok()?;
    let minute = time_parts.next()?.parse::<i64>().ok()?;
    if time_parts.next().is_some() || !(0..=23).contains(&hour) || !(0..=59).contains(&minute) {
        return None;
    }
    Some(days_from_civil(year, month, day) * 1_440 + hour * 60 + minute)
}

fn format_wall_clock_minute(value: i64) -> String {
    let days = value.div_euclid(1_440);
    let minute_of_day = value.rem_euclid(1_440);
    let (year, month, day) = civil_from_days(days);
    let hour = minute_of_day / 60;
    let minute = minute_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:00.000Z")
}

fn encode_uri_component(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.as_bytes() {
        if byte.is_ascii_alphanumeric()
            || matches!(
                *byte,
                b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')'
            )
        {
            encoded.push(*byte as char);
        } else {
            encoded.push_str(&format!("%{byte:02X}"));
        }
    }
    encoded
}

fn booking_candidate(event: &P2pEvent) -> Option<BookingConflictCandidate> {
    if event.entity != "booking" || event.operation != P2pOperation::Upsert {
        return None;
    }
    let payload = event.payload.as_ref()?;
    let booking_id = payload.get("id")?.as_str()?;
    let resource_id = payload.get("resourceId")?.as_str()?;
    let sector = payload.get("sector")?.as_str()?;
    let start_date = payload.get("startDate")?.as_str()?;
    let end_date = payload.get("endDate")?.as_str()?;
    let status = payload.get("status")?.as_str()?;
    if booking_id != event.entity_id || resource_id.is_empty() || status == "cancelled" {
        return None;
    }
    let check_in = payload
        .get("checkInTime")
        .and_then(Value::as_str)
        .unwrap_or("14:00");
    let check_out = payload
        .get("checkOutTime")
        .and_then(Value::as_str)
        .unwrap_or("12:00");
    let start = wall_clock_minute(start_date, check_in)?;
    let end = wall_clock_minute(end_date, check_out)?;
    if end <= start {
        return None;
    }
    Some(BookingConflictCandidate {
        event: event.clone(),
        booking_id: booking_id.to_string(),
        resource_id: resource_id.to_string(),
        sector: sector.to_string(),
        start,
        end,
    })
}

/// Detect cross-ID reservation overlaps from each booking's causally maximal events.
/// Wall-clock dates are compared as timezone-independent property-local minutes.
pub fn detect_p2p_booking_conflicts(
    events: &[P2pEvent],
    detected_at: &str,
) -> Vec<BookingConflictSnapshot> {
    let mut by_booking = BTreeMap::<(String, String), Vec<P2pEvent>>::new();
    for event in events.iter().filter(|event| event.entity == "booking") {
        by_booking
            .entry((event.workspace_id.clone(), event.entity_id.clone()))
            .or_default()
            .push(event.clone());
    }

    let mut bookings = Vec::<BookingConflictCandidate>::new();
    for versions in by_booking.values() {
        for event in maximal_events(versions) {
            if let Some(booking) = booking_candidate(&event) {
                bookings.push(booking);
            }
        }
    }

    let mut conflicts = Vec::new();
    for first_index in 0..bookings.len() {
        for second_index in (first_index + 1)..bookings.len() {
            let a = &bookings[first_index];
            let b = &bookings[second_index];
            if a.event.workspace_id != b.event.workspace_id
                || a.booking_id == b.booking_id
                || a.resource_id != b.resource_id
            {
                continue;
            }
            let turnover = if a.sector == "hotel" || b.sector == "hotel" {
                10
            } else {
                0
            };
            if a.start < b.end + turnover && a.end + turnover > b.start {
                let (first, second) = if a.booking_id <= b.booking_id {
                    (a, b)
                } else {
                    (b, a)
                };
                let mut source_event_ids = [a.event.event_id.clone(), b.event.event_id.clone()];
                source_event_ids.sort();
                conflicts.push(BookingConflictSnapshot {
                    id: format!(
                        "booking-overlap:{}:{}:{}",
                        encode_uri_component(&a.event.workspace_id),
                        encode_uri_component(&source_event_ids[0]),
                        encode_uri_component(&source_event_ids[1]),
                    ),
                    workspace_id: a.event.workspace_id.clone(),
                    resource_id: a.resource_id.clone(),
                    first_booking_id: first.booking_id.clone(),
                    second_booking_id: second.booking_id.clone(),
                    first_event_id: first.event.event_id.clone(),
                    second_event_id: second.event.event_id.clone(),
                    start_at: format_wall_clock_minute(a.start.max(b.start)),
                    end_at: format_wall_clock_minute(a.end.min(b.end)),
                    detected_at: detected_at.to_string(),
                    status: "pending".into(),
                    reason: "overlapping_reservations".into(),
                    superseded_at: None,
                    superseded_by_event_ids: None,
                });
            }
        }
    }
    conflicts.sort_by(|a, b| a.id.cmp(&b.id));
    conflicts
}

/// A derived pending snapshot is obsolete when a newer causal frontier replaces
/// either immutable source event. The source events themselves remain in the log.
pub fn is_booking_conflict_superseded(
    conflict: &BookingConflictSnapshot,
    current_events: &[P2pEvent],
) -> bool {
    let first: Vec<P2pEvent> = current_events
        .iter()
        .filter(|event| {
            event.workspace_id == conflict.workspace_id
                && event.entity == "booking"
                && event.entity_id == conflict.first_booking_id
        })
        .cloned()
        .collect();
    let second: Vec<P2pEvent> = current_events
        .iter()
        .filter(|event| {
            event.workspace_id == conflict.workspace_id
                && event.entity == "booking"
                && event.entity_id == conflict.second_booking_id
        })
        .cloned()
        .collect();
    let first_frontier = maximal_events(&first);
    let second_frontier = maximal_events(&second);
    let first_replaced = !first_frontier.is_empty()
        && !first_frontier
            .iter()
            .any(|event| event.event_id == conflict.first_event_id);
    let second_replaced = !second_frontier.is_empty()
        && !second_frontier
            .iter()
            .any(|event| event.event_id == conflict.second_event_id);
    first_replaced || second_replaced
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


    fn stay_event(
        node: &str,
        booking_id: &str,
        start: &str,
        end: &str,
        resource: &str,
        sector: &str,
    ) -> P2pEvent {
        let mut value = event(
            node,
            1,
            &[(node, 1)],
            Some(json!({
                "id": booking_id,
                "resourceId": resource,
                "sector": sector,
                "startDate": start,
                "endDate": end,
                "status": "confirmed"
            })),
        );
        value.entity_id = booking_id.into();
        value
    }

    #[test]
    fn detects_same_resource_overlaps_between_distinct_booking_ids() {
        let a = stay_event(
            "node-A",
            "booking-A",
            "2026-12-01",
            "2026-12-04",
            "room-101",
            "hotel",
        );
        let b = stay_event(
            "node-B",
            "booking-B",
            "2026-12-03",
            "2026-12-05",
            "room-101",
            "hotel",
        );
        let conflicts = detect_p2p_booking_conflicts(&[a, b], "2026-11-27T10:00:00.000Z");
        assert_eq!(conflicts.len(), 1);
        assert_eq!(conflicts[0].first_booking_id, "booking-A");
        assert_eq!(conflicts[0].second_booking_id, "booking-B");
        assert_eq!(conflicts[0].start_at, "2026-12-03T14:00:00.000Z");
        assert_eq!(conflicts[0].end_at, "2026-12-04T12:00:00.000Z");
        assert_eq!(
            conflicts[0].id,
            "booking-overlap:workspace-1:node-A%3A1:node-B%3A1"
        );
    }

    #[test]
    fn ignores_other_resources_cancelled_and_malformed_stays() {
        let a = stay_event(
            "node-A",
            "booking-A",
            "2026-12-01",
            "2026-12-02",
            "room-101",
            "hotel",
        );
        let mut other_room = stay_event(
            "node-B",
            "booking-B",
            "2026-12-01",
            "2026-12-03",
            "room-102",
            "hotel",
        );
        let mut cancelled = stay_event(
            "node-C",
            "booking-C",
            "2026-12-01",
            "2026-12-03",
            "room-101",
            "hotel",
        );
        cancelled.payload.as_mut().unwrap()["status"] = json!("cancelled");
        let mut malformed = stay_event(
            "node-D",
            "booking-D",
            "2026-02-30",
            "2026-03-03",
            "room-101",
            "hotel",
        );
        other_room.workspace_id = "other-workspace".into();
        assert!(detect_p2p_booking_conflicts(
            &[a, other_room, cancelled, malformed],
            "2026-11-27T10:00:00Z"
        )
        .is_empty());
    }

    #[test]
    fn applies_hotel_turnover_symmetrically() {
        let before = stay_event(
            "node-A",
            "booking-A",
            "2026-12-01",
            "2026-12-02",
            "room-101",
            "hotel",
        );
        let mut within = stay_event(
            "node-B",
            "booking-B",
            "2026-12-02",
            "2026-12-03",
            "room-101",
            "hotel",
        );
        within.payload.as_mut().unwrap()["checkInTime"] = json!("12:05");
        let mut outside = stay_event(
            "node-C",
            "booking-C",
            "2026-12-02",
            "2026-12-03",
            "room-101",
            "hotel",
        );
        outside.payload.as_mut().unwrap()["checkInTime"] = json!("12:10");
        assert_eq!(
            detect_p2p_booking_conflicts(&[before.clone(), within], "2026-11-27T10:00:00Z").len(),
            1
        );
        assert!(
            detect_p2p_booking_conflicts(&[before, outside], "2026-11-27T10:00:00Z").is_empty()
        );
    }

    #[test]
    fn newer_causal_booking_frontier_supersedes_old_overlap() {
        let original_a = stay_event(
            "node-A",
            "booking-A",
            "2026-12-01",
            "2026-12-05",
            "room-101",
            "hotel",
        );
        let original_b = stay_event(
            "node-B",
            "booking-B",
            "2026-12-03",
            "2026-12-04",
            "room-101",
            "hotel",
        );
        let conflicts = detect_p2p_booking_conflicts(
            &[original_a.clone(), original_b.clone()],
            "2026-11-27T10:00:00Z",
        );
        assert_eq!(conflicts.len(), 1);
        let conflict = &conflicts[0];
        let mut newer_a = original_a.clone();
        newer_a.event_id = "node-A:2".into();
        newer_a.sequence = 2;
        newer_a.clock = [("node-A".to_string(), 2), ("node-B".to_string(), 1)]
            .into_iter()
            .collect();
        newer_a.payload.as_mut().unwrap()["endDate"] = json!("2026-12-02");
        assert!(detect_p2p_booking_conflicts(
            &[newer_a.clone(), original_b.clone()],
            "2026-11-27T10:00:00Z"
        )
        .is_empty());
        assert!(is_booking_conflict_superseded(
            conflict,
            &[original_a, newer_a, original_b]
        ));
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
            "booking_conflict",
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
