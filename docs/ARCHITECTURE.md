# Architecture technique

## Frontends

- Web: React 19 + TypeScript + Vite.
- Android: Capacitor 8; local persistence remains IndexedDB.
- Windows Desktop: Tauri 2. The UI is rendered by the system WebView2, but the executable is a native Rust host. It is not a process launcher for Microsoft Edge.

## Windows native boundary

The frontend calls a small, explicit Rust command surface:

- `desktop_runtime_info`: reports whether the native host and Windows Credential Manager are available.
- `discover_cardlock_candidates`: checks the documented proUSB installation and Windows VirtualStore paths and returns metadata only.
- `read_cardlock_file`: reads a user-selected or discovered `CardLock.mdb` file and returns its bytes plus source modification time.
- `secure_secret_set/exists/delete`: writes, checks or removes allow-listed credentials in Windows Credential Manager through the `keyring` crate.
- `neon_test_connection`: opens a real TLS PostgreSQL connection, executes `SELECT 1` and reads `SHOW server_version`. It never writes business data.

Custom commands are explicitly allowed by the Tauri capability file. The frontend cannot retrieve stored secrets. The secret allow-list is restricted to Supabase public client keys, Neon connection string and Google refresh token. No `service_role` key is accepted.

The filesystem boundary is intentionally narrower than arbitrary disk access: CardLock is read only after explicit selection or discovery of known paths. NTFS permissions still apply. Program Files is not a backup destination; backups belong in user-writable application data or Documents.

## CardLock ingestion

The Access reader inspects every physical table and returns an inventory (table name, row count and column names). Raw rows from technical/operator tables are not persisted automatically.

Supported mapping:
- `BuildingInfo` → building groups.
- `RoomInfo` → rooms with building and floor references.
- `GuestInfo` → stay/booking records.
- `CardInfo` → supported card records and system-card profile.
- `RecordOpen` → readable opening-event count.

Other tables remain visible in the inventory until their schemas and semantics have been validated. Do not map a technical table into a business entity based on its name alone.

## Hotel structure generation

`src/utils/hotelStructure.ts` is a pure deterministic generator. It accepts building number, floor number, prefix, inclusive suffix range, padding, per-floor excluded suffixes and existing room names. The default exclusion is suffix `13`, so prefix `1` skips `113`, prefix `2` skips `213`. Duplicate names are ignored and returned separately. Unit tests cover the default exclusion, padding, duplicates and invalid ranges.

## Data and synchronization truthfulness

- IndexedDB remains the local-first store.
- The header's Push count is the number of local Outbox records waiting; it is not a remote acknowledgement.
- Pull is shown unavailable until a real remote cursor-based pull worker exists.
- A successful Neon connection test proves only PostgreSQL connectivity, not schema compatibility, data replication or synchronization.
- Supabase URL and public Publishable/Anon keys are client configuration. They are not privileged secrets and must be protected by database policies.
- Neon direct connection strings are stored in Windows Credential Manager in the native Windows app. Use a dedicated PostgreSQL role with least-privilege grants; do not use an owner/superuser credential in a distributed desktop client.

## Future synchronization contract

A production bidirectional engine still needs:
- transactional Outbox writes for every business mutation;
- stable event IDs, idempotency keys and per-workspace scope;
- durable remote change log / pull cursor and tombstones;
- domain-specific conflict resolution for bookings, payments and stock;
- retry/backoff, offline queue, replay protection and observable server acknowledgements;
- schema migrations and permission tests for both Supabase and Neon.

Do not label the system synchronized until a remote write is acknowledged and the pull cursor has advanced.
