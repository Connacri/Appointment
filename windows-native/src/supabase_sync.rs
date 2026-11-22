use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Mutex;
use uuid::Uuid;

use crate::booking_mapper::{from_supabase_booking_row, to_supabase_booking_row};
use crate::database::{OutboxEntry, PmsDatabase};
use crate::domain::Booking;
use crate::supabase_auth::SupabaseAuthClient;
use crate::winhttp::HttpResponse;

const REST_PREFER_REPRESENTATION: &str = "return=representation";

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PushSummary {
    pub acknowledged: u32,
    pub retry_scheduled: u32,
    pub conflicts: u32,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PullSummary {
    pub pages: u32,
    pub received: u32,
    pub applied: u32,
    pub skipped_pending: u32,
    pub skipped_tombstone: u32,
    pub stale: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct BookingSyncSummary {
    pub push: PushSummary,
    pub pull: PullSummary,
    pub pull_error: Option<String>,
}

enum PushFailure {
    Retry(String),
    Conflict(String),
}

#[derive(Deserialize)]
struct RemoteResource {
    id: String,
    workspace_id: String,
    establishment_id: String,
    is_active: bool,
    deleted_at: Option<String>,
}

#[derive(Deserialize)]
struct RemoteReturnedVersion {
    version: i64,
}

/// Pushes due booking Outbox events sequentially.
///
/// A workspace must first pass the native Supabase Auth + RLS membership gate.
/// Inserts, updates and soft deletes use conditional server versions. A local
/// Outbox row is acknowledged only after a successful server representation
/// (or an idempotent read proving the same operation already committed).
///
/// Calls for a given workspace must be serialized by the caller. The HTTP
/// operations themselves are synchronous; run this function on a worker thread.
pub fn push_due_bookings(
    client: &mut SupabaseAuthClient,
    database: &Mutex<PmsDatabase>,
    workspace_id: &str,
    limit: u32,
) -> Result<PushSummary, String> {
    let expected_workspace = normalize_uuid(workspace_id, "workspace_id")?;
    let access = client.resolve_personal_workspace()?;
    if access.id != expected_workspace {
        return Err(
            "The requested local workspace is not the authenticated account's verified personal workspace."
                .into(),
        );
    }
    let user_id = client
        .session()
        .map(|session| session.user_id.clone())
        .ok_or_else(|| "An authenticated Supabase session is required.".to_string())?;
    {
        let local = database
            .lock()
            .map_err(|_| "Local database lock is poisoned.".to_string())?;
        let owner_matches = local
            .workspace_is_owned_by(&expected_workspace, &user_id)
            .map_err(|error| format!("Could not verify local workspace ownership: {error}"))?;
        if !owner_matches {
            return Err(
                "Local SQLite workspace owner does not match the authenticated Supabase account."
                    .into(),
            );
        }
    }

    let mut summary = PushSummary::default();
    let batch_limit = limit.min(500);

    // Re-read one event after every ACK. An earlier event may advance the server
    // version and rebase later events for the same booking in SQLite; processing
    // a previously fetched Vec would keep stale base_server_version values.
    for _ in 0..batch_limit {
        let entry = {
            let local = database
                .lock()
                .map_err(|_| "Local database lock is poisoned.".to_string())?;
            local
                .pending_outbox(&expected_workspace, 1)
                .map_err(|error| format!("Could not read the local Outbox: {error}"))?
                .into_iter()
                .next()
        };
        let Some(entry) = entry else {
            break;
        };

        match push_one(client, &user_id, &expected_workspace, &entry) {
            Ok(server_version) => {
                let acknowledged = database
                    .lock()
                    .map_err(|_| "Local database lock is poisoned.".to_string())?
                    .acknowledge_outbox(&expected_workspace, &entry.id, server_version)
                    .map_err(|error| {
                        format!("Could not persist server acknowledgement: {error}")
                    })?;
                if !acknowledged {
                    return Err(
                        "The server accepted a booking mutation, but its local Outbox row changed before acknowledgement. The operation will be retried idempotently."
                            .into(),
                    );
                }
                summary.acknowledged += 1;
            }
            Err(PushFailure::Conflict(reason)) => {
                database
                    .lock()
                    .map_err(|_| "Local database lock is poisoned.".to_string())?
                    .mark_outbox_conflict(&expected_workspace, &entry.id, &reason)
                    .map_err(|error| format!("Could not persist Outbox conflict: {error}"))?;
                summary.conflicts += 1;
            }
            Err(PushFailure::Retry(reason)) => {
                database
                    .lock()
                    .map_err(|_| "Local database lock is poisoned.".to_string())?
                    .mark_outbox_failed(&expected_workspace, &entry.id, &reason)
                    .map_err(|error| format!("Could not schedule Outbox retry: {error}"))?;
                summary.retry_scheduled += 1;
            }
        }
    }

    Ok(summary)
}

/// Pulls authenticated booking rows incrementally using the composite
/// (updated_at,id) cursor. The cursor is persisted only after a whole page has
/// been merged, so a crash replays that page instead of losing unseen rows.
/// Remote tombstones are included; local pending/conflicted Outbox events and
/// local tombstones always win over a pull.
pub fn pull_bookings(
    client: &mut SupabaseAuthClient,
    database: &Mutex<PmsDatabase>,
    workspace_id: &str,
    page_size: u32,
) -> Result<PullSummary, String> {
    let expected_workspace = normalize_uuid(workspace_id, "workspace_id")?;
    let access = client.resolve_personal_workspace()?;
    if access.id != expected_workspace {
        return Err(
            "The requested local workspace is not the authenticated account's verified personal workspace."
                .into(),
        );
    }
    let user_id = client
        .session()
        .map(|session| session.user_id.clone())
        .ok_or_else(|| "An authenticated Supabase session is required.".to_string())?;
    {
        let local = database
            .lock()
            .map_err(|_| "Local database lock is poisoned.".to_string())?;
        let owner_matches = local
            .workspace_is_owned_by(&expected_workspace, &user_id)
            .map_err(|error| format!("Could not verify local workspace ownership: {error}"))?;
        if !owner_matches {
            return Err(
                "Local SQLite workspace owner does not match the authenticated Supabase account."
                    .into(),
            );
        }
    }

    let limit = page_size.clamp(1, 200);
    let mut summary = PullSummary::default();
    const MAX_PAGES_PER_RUN: u32 = 500;

    for _ in 0..MAX_PAGES_PER_RUN {
        let cursor = database
            .lock()
            .map_err(|_| "Local database lock is poisoned.".to_string())?
            .sync_cursor(&expected_workspace, "bookings")
            .map_err(|error| format!("Could not read the booking sync cursor: {error}"))?;
        let path = booking_pull_path(&expected_workspace, cursor.as_ref(), limit);
        let response = client
            .authenticated_get(&path)
            .map_err(|error| format!("Booking pull request failed: {error}"))?;
        let response = require_success(response).map_err(push_failure_message)?;
        let rows: Vec<Value> = serde_json::from_slice(&response.body)
            .map_err(|_| "Supabase returned an invalid booking pull page.".to_string())?;
        if rows.is_empty() {
            break;
        }
        if rows.len() > limit as usize {
            return Err("Supabase returned more booking rows than the requested page size.".into());
        }

        let mut page_cursor = cursor;
        let mut last_cursor: Option<(String, String)> = None;

        for row in &rows {
            let remote = parse_remote_booking(row, &expected_workspace)?;
            let tuple = (remote.updated_at.clone(), remote.id.clone());
            if let Some(previous) = page_cursor.as_ref() {
                if !cursor_is_after(&tuple.0, &tuple.1, &previous.updated_at, &previous.entity_id) {
                    return Err(
                        "Supabase booking pull page is not strictly ordered after the saved cursor."
                            .into(),
                    );
                }
            }
            if let Some(previous) = last_cursor.as_ref() {
                if !cursor_is_after(&tuple.0, &tuple.1, &previous.0, &previous.1) {
                    return Err(
                        "Supabase booking pull page contains duplicate or out-of-order rows."
                            .into(),
                    );
                }
            }

            let outcome = database
                .lock()
                .map_err(|_| "Local database lock is poisoned.".to_string())?
                .apply_remote_booking(
                    &expected_workspace,
                    &remote.booking,
                    remote.server_version,
                    remote.deleted_at.as_deref(),
                )
                .map_err(|error| format!("Could not merge remote booking: {error}"))?;
            match outcome {
                crate::database::RemoteBookingApply::Applied => summary.applied += 1,
                crate::database::RemoteBookingApply::SkippedPending => {
                    summary.skipped_pending += 1
                }
                crate::database::RemoteBookingApply::SkippedTombstone => {
                    summary.skipped_tombstone += 1
                }
                crate::database::RemoteBookingApply::Stale => summary.stale += 1,
            }
            summary.received += 1;
            last_cursor = Some(tuple);
        }

        let Some((updated_at, entity_id)) = last_cursor else {
            break;
        };
        database
            .lock()
            .map_err(|_| "Local database lock is poisoned.".to_string())?
            .store_sync_cursor(
                &expected_workspace,
                "bookings",
                &updated_at,
                &entity_id,
            )
            .map_err(|error| format!("Could not persist the booking sync cursor: {error}"))?;
        summary.pages += 1;

        if rows.len() < limit as usize {
            break;
        }
    }

    if summary.pages == MAX_PAGES_PER_RUN {
        return Err(
            "Booking pull reached the per-run page safety limit. Run it again to continue from the saved cursor."
                .into(),
        );
    }
    Ok(summary)
}

/// Push first, then pull. A pull failure is reported alongside the successful
/// push summary because push ACKs are already committed and must not be hidden.
pub fn sync_bookings(
    client: &mut SupabaseAuthClient,
    database: &Mutex<PmsDatabase>,
    workspace_id: &str,
    push_limit: u32,
    pull_page_size: u32,
) -> Result<BookingSyncSummary, String> {
    let push = push_due_bookings(client, database, workspace_id, push_limit)?;
    match pull_bookings(client, database, workspace_id, pull_page_size) {
        Ok(pull) => Ok(BookingSyncSummary {
            push,
            pull,
            pull_error: None,
        }),
        Err(error) => Ok(BookingSyncSummary {
            push,
            pull: PullSummary::default(),
            pull_error: Some(error),
        }),
    }
}

struct ParsedRemoteBooking {
    id: String,
    updated_at: String,
    server_version: i64,
    deleted_at: Option<String>,
    booking: Booking,
}

fn parse_remote_booking(
    row: &Value,
    expected_workspace_id: &str,
) -> Result<ParsedRemoteBooking, String> {
    let object = row
        .as_object()
        .ok_or_else(|| "Supabase booking row must be a JSON object.".to_string())?;
    let id = object
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Supabase booking row has no ID.".to_string())?;
    let workspace_id = object
        .get("workspace_id")
        .and_then(Value::as_str)
        .ok_or_else(|| "Supabase booking row has no workspace ID.".to_string())?;
    let id = normalize_uuid(id, "remote booking.id")?;
    let workspace_id = normalize_uuid(workspace_id, "remote booking.workspace_id")?;
    if workspace_id != expected_workspace_id {
        return Err("Supabase returned a booking outside the verified workspace.".into());
    }
    let updated_at = object
        .get("updated_at")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty() && !value.contains('\r') && !value.contains('\n'))
        .ok_or_else(|| "Supabase booking row has no valid updated_at cursor.".to_string())?
        .to_string();
    let server_version = object
        .get("version")
        .and_then(Value::as_i64)
        .filter(|version| *version > 0)
        .ok_or_else(|| "Supabase booking row has no positive server version.".to_string())?;
    let deleted_at = match object.get("deleted_at") {
        Some(Value::String(value)) if !value.is_empty() => Some(value.clone()),
        Some(Value::Null) | None => None,
        _ => return Err("Supabase booking deleted_at field is invalid.".into()),
    };
    let booking = from_supabase_booking_row(row)
        .map_err(|error| format!("Could not map remote booking {id}: {error}"))?;
    if booking.id != id {
        return Err("Mapped remote booking ID does not match the server row ID.".into());
    }
    Ok(ParsedRemoteBooking {
        id,
        updated_at,
        server_version,
        deleted_at,
        booking,
    })
}

fn booking_pull_path(
    workspace_id: &str,
    cursor: Option<&crate::database::SyncCursor>,
    limit: u32,
) -> String {
    let mut path = format!(
        "/rest/v1/bookings?select=*&workspace_id=eq.{workspace_id}&order=updated_at.asc,id.asc&limit={}",
        limit.clamp(1, 200)
    );
    if let Some(cursor) = cursor {
        let updated_at = encode_query_component(&cursor.updated_at);
        path.push_str(&format!(
            "&or=%28updated_at.gt.{updated_at},and%28updated_at.eq.{updated_at},id.gt.{}%29%29",
            cursor.entity_id
        ));
    }
    path
}

fn encode_query_component(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'~') {
            encoded.push(byte as char);
        } else {
            use std::fmt::Write as _;
            let _ = write!(encoded, "%{byte:02X}");
        }
    }
    encoded
}

fn cursor_is_after(
    candidate_updated_at: &str,
    candidate_id: &str,
    previous_updated_at: &str,
    previous_id: &str,
) -> bool {
    candidate_updated_at > previous_updated_at
        || (candidate_updated_at == previous_updated_at && candidate_id > previous_id)
}

fn push_failure_message(failure: PushFailure) -> String {
    match failure {
        PushFailure::Retry(message) => message,
        PushFailure::Conflict(message) => message,
    }
}

fn push_one(
    client: &mut SupabaseAuthClient,
    user_id: &str,
    workspace_id: &str,
    entry: &OutboxEntry,
) -> Result<i64, PushFailure> {
    if entry.workspace_id != workspace_id {
        return Err(PushFailure::Conflict(
            "Outbox workspace does not match the verified workspace.".into(),
        ));
    }
    if entry.entity != "booking" {
        return Err(PushFailure::Conflict(format!(
            "Unsupported Outbox entity '{}'; no remote mutation was attempted.",
            entry.entity
        )));
    }
    let booking_id =
        normalize_uuid(&entry.entity_id, "booking_id").map_err(PushFailure::Conflict)?;

    match entry.operation.as_str() {
        "upsert" => {
            let payload = entry.payload.as_deref().ok_or_else(|| {
                PushFailure::Conflict("Booking upsert has no local payload.".into())
            })?;
            let mut booking: Booking = serde_json::from_str(payload).map_err(|_| {
                PushFailure::Conflict("Booking Outbox payload is invalid JSON.".into())
            })?;
            if normalize_uuid(&booking.id, "booking_id").map_err(PushFailure::Conflict)?
                != booking_id
            {
                return Err(PushFailure::Conflict(
                    "Booking payload ID does not match its Outbox entity ID.".into(),
                ));
            }
            booking.id = booking_id.clone();
            booking.normalize_occupants();
            booking.validate().map_err(PushFailure::Conflict)?;

            let resource_id = normalize_uuid(&booking.resource_id, "resource_id")
                .map_err(PushFailure::Conflict)?;
            booking.resource_id = resource_id.clone();
            let resource = fetch_resource(client, workspace_id, &resource_id)?;
            let resource_workspace =
                normalize_uuid(&resource.workspace_id, "resource.workspace_id")
                    .map_err(PushFailure::Conflict)?;
            let returned_resource_id =
                normalize_uuid(&resource.id, "resource.id").map_err(PushFailure::Conflict)?;
            if resource_workspace != workspace_id
                || returned_resource_id != resource_id
                || !resource.is_active
                || resource.deleted_at.is_some()
            {
                return Err(PushFailure::Conflict(
                    "Booking resource is inactive, deleted, or outside the verified workspace."
                        .into(),
                ));
            }
            let establishment_id = normalize_uuid(&resource.establishment_id, "establishment_id")
                .map_err(PushFailure::Conflict)?;

            let expected =
                to_supabase_booking_row(&booking, workspace_id, &establishment_id, Some(user_id))
                    .map_err(PushFailure::Conflict)?;
            upsert_remote_booking(
                client,
                workspace_id,
                &booking_id,
                entry.base_server_version,
                expected,
            )
        }
        "delete" => {
            delete_remote_booking(client, workspace_id, &booking_id, entry.base_server_version)
        }
        _ => Err(PushFailure::Conflict(format!(
            "Unsupported booking Outbox operation '{}'.",
            entry.operation
        ))),
    }
}

fn fetch_resource(
    client: &mut SupabaseAuthClient,
    workspace_id: &str,
    resource_id: &str,
) -> Result<RemoteResource, PushFailure> {
    let resource_id = normalize_uuid(resource_id, "resource_id").map_err(PushFailure::Conflict)?;
    let path = format!(
        "/rest/v1/resources?select=id,workspace_id,establishment_id,is_active,deleted_at&id=eq.{resource_id}&workspace_id=eq.{workspace_id}&limit=1"
    );
    let response = client
        .authenticated_get(&path)
        .map_err(PushFailure::Retry)?;
    let response = require_success(response)?;
    let rows: Vec<RemoteResource> = serde_json::from_slice(&response.body).map_err(|_| {
        PushFailure::Retry("Supabase returned an invalid resource lookup response.".into())
    })?;
    let Some(resource) = rows.into_iter().next() else {
        return Err(PushFailure::Conflict(
            "The booking resource is not visible in this workspace under RLS.".into(),
        ));
    };
    Ok(resource)
}

fn upsert_remote_booking(
    client: &mut SupabaseAuthClient,
    workspace_id: &str,
    booking_id: &str,
    base_server_version: i64,
    expected: Value,
) -> Result<i64, PushFailure> {
    let path = format!(
        "/rest/v1/bookings?select=*&id=eq.{booking_id}&workspace_id=eq.{workspace_id}&limit=1"
    );
    let current = fetch_booking_row(client, &path, workspace_id, booking_id)?;

    if base_server_version == 0 {
        if let Some(row) = current.as_ref() {
            if row_matches_expected(row, &expected)
                && row.get("deleted_at").is_some_and(Value::is_null)
            {
                return remote_version(row);
            }
            return Err(PushFailure::Conflict(
                "A remote booking with this ID already exists and has no matching local server-version history."
                    .into(),
            ));
        }

        let mut insert = expected;
        insert
            .as_object_mut()
            .ok_or_else(|| PushFailure::Conflict("Booking mapper returned a non-object.".into()))?
            .insert("deleted_at".into(), Value::Null);
        let body = serde_json::to_vec(&insert)
            .map_err(|_| PushFailure::Conflict("Could not serialize booking insert.".into()))?;
        let response = client
            .authenticated_post_with_prefer("/rest/v1/bookings", REST_PREFER_REPRESENTATION, &body)
            .map_err(PushFailure::Retry)?;
        if response.status == 409 {
            // The first POST may have committed even though its response was lost,
            // or another device may have inserted the same primary key.
            let raced = fetch_booking_row(client, &path, workspace_id, booking_id)?;
            if let Some(row) = raced.as_ref() {
                if row_matches_expected(row, &insert)
                    && row.get("deleted_at").is_some_and(Value::is_null)
                {
                    return remote_version(row);
                }
            }
            return Err(PushFailure::Conflict(
                "The booking ID was inserted remotely with different data.".into(),
            ));
        }
        let response = require_success(response)?;
        return returned_version(&response);
    }

    let Some(row) = current else {
        return Err(PushFailure::Conflict(
            "The remote booking no longer exists; a local update cannot recreate it silently."
                .into(),
        ));
    };
    let current_version = remote_version(&row)?;
    if current_version > base_server_version
        && row_matches_expected(&row, &expected)
        && row.get("deleted_at").is_some_and(Value::is_null)
    {
        // Idempotent recovery after a successful server write with a lost response.
        return Ok(current_version);
    }
    if current_version != base_server_version {
        return Err(PushFailure::Conflict(format!(
            "Booking version conflict: local base {base_server_version}, remote version {current_version}."
        )));
    }

    let mut patch = expected;
    patch
        .as_object_mut()
        .ok_or_else(|| PushFailure::Conflict("Booking mapper returned a non-object.".into()))?
        .remove("created_by");
    patch
        .as_object_mut()
        .expect("object shape was checked")
        .insert("deleted_at".into(), Value::Null);
    let body = serde_json::to_vec(&patch)
        .map_err(|_| PushFailure::Conflict("Could not serialize booking update.".into()))?;
    let patch_path = format!(
        "/rest/v1/bookings?id=eq.{booking_id}&workspace_id=eq.{workspace_id}&version=eq.{base_server_version}"
    );
    let response = client
        .authenticated_patch_with_prefer(&patch_path, REST_PREFER_REPRESENTATION, &body)
        .map_err(PushFailure::Retry)?;
    let response = require_success(response)?;
    returned_version(&response)
}

fn delete_remote_booking(
    client: &mut SupabaseAuthClient,
    workspace_id: &str,
    booking_id: &str,
    base_server_version: i64,
) -> Result<i64, PushFailure> {
    let path = format!(
        "/rest/v1/bookings?select=id,workspace_id,version,deleted_at&id=eq.{booking_id}&workspace_id=eq.{workspace_id}&limit=1"
    );
    let Some(row) = fetch_booking_row(client, &path, workspace_id, booking_id)? else {
        // A physical remote deletion already satisfies the requested final state.
        return Ok(0);
    };
    let current_version = remote_version(&row)?;
    if row.get("deleted_at").is_some_and(|value| !value.is_null()) {
        // Soft deletion is monotonic; retries after a lost ACK converge here.
        return Ok(current_version);
    }
    if base_server_version == 0 || current_version != base_server_version {
        return Err(PushFailure::Conflict(format!(
            "Booking delete conflict: local base {base_server_version}, remote version {current_version}."
        )));
    }

    let body = serde_json::to_vec(&json!({ "deleted_at": utc_timestamp() }))
        .map_err(|_| PushFailure::Conflict("Could not serialize booking tombstone.".into()))?;
    let patch_path = format!(
        "/rest/v1/bookings?id=eq.{booking_id}&workspace_id=eq.{workspace_id}&version=eq.{base_server_version}&deleted_at=is.null"
    );
    let response = client
        .authenticated_patch_with_prefer(&patch_path, REST_PREFER_REPRESENTATION, &body)
        .map_err(PushFailure::Retry)?;
    let response = require_success(response)?;
    returned_version(&response)
}

fn fetch_booking_row(
    client: &mut SupabaseAuthClient,
    path: &str,
    expected_workspace_id: &str,
    expected_booking_id: &str,
) -> Result<Option<Value>, PushFailure> {
    let response = client.authenticated_get(path).map_err(PushFailure::Retry)?;
    let response = require_success(response)?;
    let rows: Vec<Value> = serde_json::from_slice(&response.body)
        .map_err(|_| PushFailure::Retry("Supabase returned an invalid booking response.".into()))?;
    if rows.len() > 1 {
        return Err(PushFailure::Conflict(
            "Supabase returned multiple rows for a unique booking ID.".into(),
        ));
    }
    let Some(row) = rows.into_iter().next() else {
        return Ok(None);
    };
    validate_remote_booking_identity(&row, expected_workspace_id, expected_booking_id)?;
    Ok(Some(row))
}

fn validate_remote_booking_identity(
    row: &Value,
    expected_workspace_id: &str,
    expected_booking_id: &str,
) -> Result<(), PushFailure> {
    let actual_id = row
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| PushFailure::Retry("Remote booking response has no ID.".into()))?;
    let actual_workspace = row
        .get("workspace_id")
        .and_then(Value::as_str)
        .ok_or_else(|| PushFailure::Retry("Remote booking response has no workspace ID.".into()))?;
    let actual_id = normalize_uuid(actual_id, "remote booking.id").map_err(PushFailure::Retry)?;
    let actual_workspace = normalize_uuid(actual_workspace, "remote booking.workspace_id")
        .map_err(PushFailure::Retry)?;
    if actual_id != expected_booking_id || actual_workspace != expected_workspace_id {
        return Err(PushFailure::Conflict(
            "Supabase returned a booking outside the requested identity/tenant scope.".into(),
        ));
    }
    Ok(())
}

fn require_success(response: HttpResponse) -> Result<HttpResponse, PushFailure> {
    if (200..300).contains(&response.status) {
        return Ok(response);
    }
    let message = format!(
        "Supabase REST request failed with HTTP {}.",
        response.status
    );
    if response.status == 401 || response.status == 403 || response.status >= 500 {
        Err(PushFailure::Retry(message))
    } else {
        Err(PushFailure::Conflict(message))
    }
}

fn returned_version(response: &HttpResponse) -> Result<i64, PushFailure> {
    let rows: Vec<RemoteReturnedVersion> =
        serde_json::from_slice(&response.body).map_err(|_| {
            PushFailure::Retry(
                "Supabase did not return a booking representation; the server ACK is unverified."
                    .into(),
            )
        })?;
    if rows.is_empty() {
        return Err(PushFailure::Conflict(
            "The conditional booking update matched no remote row; the operation was not acknowledged."
                .into(),
        ));
    }
    if rows.len() != 1 {
        return Err(PushFailure::Conflict(
            "The server returned more than one row for a unique booking mutation.".into(),
        ));
    }
    let row = rows
        .into_iter()
        .next()
        .expect("exactly one row was validated");
    if row.version <= 0 {
        return Err(PushFailure::Retry(
            "Supabase returned a non-positive booking version; the server ACK is invalid.".into(),
        ));
    }
    Ok(row.version)
}

fn remote_version(row: &Value) -> Result<i64, PushFailure> {
    row.get("version")
        .and_then(Value::as_i64)
        .filter(|version| *version > 0)
        .ok_or_else(|| PushFailure::Retry("Remote booking row has no valid server version.".into()))
}

fn row_matches_expected(remote: &Value, expected: &Value) -> bool {
    let Some(expected) = expected.as_object() else {
        return false;
    };
    let Some(remote) = remote.as_object() else {
        return false;
    };
    expected
        .iter()
        .filter(|(key, _)| key.as_str() != "created_by")
        .all(|(key, value)| remote.get(key) == Some(value))
}

fn normalize_uuid(value: &str, field: &str) -> Result<String, String> {
    Uuid::parse_str(value)
        .map(|id| id.hyphenated().to_string())
        .map_err(|_| format!("{field} must be a valid UUID before cloud synchronization."))
}

fn utc_timestamp() -> String {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = (seconds / 86_400) as i64;
    let day_seconds = seconds % 86_400;
    let (year, month, day) = civil_from_days(days);
    let hour = day_seconds / 3_600;
    let minute = (day_seconds % 3_600) / 60;
    let second = day_seconds % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn civil_from_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    if month <= 2 {
        year += 1;
    }
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resource_and_booking_ids_must_be_uuids_before_query_construction() {
        assert!(normalize_uuid("a1b2c3d4-e5f6-47a8-9012-1234567890ab", "booking_id").is_ok());
        assert!(normalize_uuid("room-101", "resource_id").is_err());
    }

    #[test]
    fn remote_booking_identity_must_match_both_id_and_workspace() {
        let row = json!({
            "id":"a1b2c3d4-e5f6-47a8-9012-1234567890ab",
            "workspace_id":"b1b2c3d4-e5f6-47a8-9012-1234567890ab"
        });
        assert!(validate_remote_booking_identity(
            &row,
            "b1b2c3d4-e5f6-47a8-9012-1234567890ab",
            "a1b2c3d4-e5f6-47a8-9012-1234567890ab"
        )
        .is_ok());
        assert!(validate_remote_booking_identity(
            &row,
            "c1b2c3d4-e5f6-47a8-9012-1234567890ab",
            "a1b2c3d4-e5f6-47a8-9012-1234567890ab"
        )
        .is_err());
        assert!(validate_remote_booking_identity(
            &row,
            "b1b2c3d4-e5f6-47a8-9012-1234567890ab",
            "c1b2c3d4-e5f6-47a8-9012-1234567890ab"
        )
        .is_err());
    }

    #[test]
    fn composite_booking_cursor_encodes_timezone_and_tie_breaker() {
        let cursor = crate::database::SyncCursor {
            updated_at: "2026-11-22T12:30:00.123456+00:00".into(),
            entity_id: "a1b2c3d4-e5f6-47a8-9012-1234567890ab".into(),
        };
        let path = booking_pull_path(
            "b1b2c3d4-e5f6-47a8-9012-1234567890ab",
            Some(&cursor),
            200,
        );
        assert!(path.contains("order=updated_at.asc,id.asc"));
        assert!(path.contains("limit=200"));
        assert!(path.contains("updated_at.gt.2026-11-22T12%3A30%3A00%2E123456%2B00%3A00"));
        assert!(path.contains("id.gt.a1b2c3d4-e5f6-47a8-9012-1234567890ab"));
    }

    #[test]
    fn composite_cursor_orders_same_timestamp_by_id() {
        assert!(cursor_is_after("2026-11-22T12:00:00+00:00", "b", "2026-11-22T12:00:00+00:00", "a"));
        assert!(!cursor_is_after("2026-11-22T12:00:00+00:00", "a", "2026-11-22T12:00:00+00:00", "b"));
        assert!(cursor_is_after("2026-11-22T12:00:01+00:00", "a", "2026-11-22T12:00:00+00:00", "z"));
    }

    #[test]
    fn remote_pull_parser_requires_tenant_identity_and_version() {
        let workspace_id = "b1b2c3d4-e5f6-47a8-9012-1234567890ab";
        let booking_id = "a1b2c3d4-e5f6-47a8-9012-1234567890ab";
        let mut booking = Booking {
            id: booking_id.into(),
            resource_id: "c1b2c3d4-e5f6-47a8-9012-1234567890ab".into(),
            resource_name: "101".into(),
            sector: "hotel".into(),
            guest_name: "Remote Guest".into(),
            guest_email: "guest@example.test".into(),
            guest_phone: "+213555000000".into(),
            start_date: "2026-11-22".into(),
            end_date: "2026-11-24".into(),
            status: crate::domain::BookingStatus::Confirmed,
            total_price: Some(12_000.0),
            payment_currency: Some("DZD".into()),
            payment_status: "pending".into(),
            ..Booking::default()
        };
        booking.normalize_occupants();
        let mut row = to_supabase_booking_row(&booking, workspace_id, "d1b2c3d4-e5f6-47a8-9012-1234567890ab", None).unwrap();
        row["version"] = json!(9);
        row["updated_at"] = json!("2026-11-22T12:00:00+00:00");
        row["deleted_at"] = Value::Null;

        let parsed = parse_remote_booking(&row, workspace_id).unwrap();
        assert_eq!(parsed.id, booking_id);
        assert_eq!(parsed.server_version, 9);
        assert_eq!(parsed.booking.guest_name, "Remote Guest");
        assert!(parsed.deleted_at.is_none());

        assert!(parse_remote_booking(&row, "e1b2c3d4-e5f6-47a8-9012-1234567890ab").is_err());
        row["version"] = json!(0);
        assert!(parse_remote_booking(&row, workspace_id).is_err());
    }

    #[test]
    fn row_match_ignores_server_managed_fields() {
        let expected = json!({
            "id":"a1b2c3d4-e5f6-47a8-9012-1234567890ab",
            "workspace_id":"b1b2c3d4-e5f6-47a8-9012-1234567890ab",
            "guest_name":"Guest",
            "created_by":"user-a"
        });
        let remote = json!({
            "id":"a1b2c3d4-e5f6-47a8-9012-1234567890ab",
            "workspace_id":"b1b2c3d4-e5f6-47a8-9012-1234567890ab",
            "guest_name":"Guest",
            "created_by":"user-b",
            "version":3,
            "updated_at":"2026-11-22T11:00:00Z",
            "deleted_at":null
        });
        assert!(row_matches_expected(&remote, &expected));
    }

    #[test]
    fn timestamp_is_utc_and_uses_rfc3339_shape() {
        let value = utc_timestamp();
        assert!(value.ends_with('Z'));
        assert_eq!(value.len(), 20);
        assert_eq!(&value[4..5], "-");
        assert_eq!(&value[10..11], "T");
    }

    #[test]
    fn civil_date_conversion_handles_unix_epoch_and_leap_day() {
        assert_eq!(civil_from_days(0), (1970, 1, 1));
        assert_eq!(civil_from_days(20_000), (2024, 10, 4));
    }
}
