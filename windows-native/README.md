# Appointment PMS — Native Windows

Independent Windows desktop client built with Rust and Win32. No browser, Edge, WebView2, Electron, Node runtime, or HTML renderer is embedded.

## Build

Install the Rust MSVC toolchain and Visual Studio Build Tools C++ workload:

```powershell
cargo fmt --all -- --check
cargo test --locked
cargo clippy --all-targets --locked -- -D warnings
cargo build --release --locked
```

The committed `Cargo.lock` pins the dependency graph; the Windows pipeline uses `--locked` for tests, Clippy and release builds. The MSVC runtime is statically linked. The output is `target/release/appointment-pms-native.exe`; Inno Setup produces the installer.

## Implemented native foundation

- Direct Win32 window and message loop.
- Rust domain model for PMS bookings, with input validation.
- SQLite database migrations and workspace-scoped booking persistence under `%LOCALAPPDATA%\\Connacri\\Appointment`.
- Exact money representation using integer minor units plus a validated ISO currency code.
- Atomic booking + Outbox writes; atomic delete + tombstone + Outbox writes.
- Unique idempotency keys and bounded, workspace-scoped pagination.
- Automated tests for validation, atomicity, workspace isolation, tombstones and idempotency.

## Not yet implemented

Supabase authentication/remote synchronization, conflict resolution, full PMS entities and screens, CardLock MDB import, USB/HID hardware, printing and reports. The current Win32 shell remains a foundation and does not claim feature parity with the React client.

## Data compatibility

The Rust booking model is a deliberately explicit first slice of the existing TypeScript `TimelineBooking` contract. Do not import/export production records until a versioned compatibility mapper covers all existing optional booking fields, occupant identity fields, payments, extras, currencies, modification history and legacy aliases. Never sync demo records.
