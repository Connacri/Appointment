# Appointment PMS — Native Windows

This crate starts the independent Windows desktop implementation.

## Runtime constraints

- Rust executable using the Windows Win32 API directly.
- No browser process, Edge app mode, WebView2, WebView, Electron, Node.js runtime, or embedded HTML renderer.
- No external signing certificate is required to compile, test, or package the application.
- Current target: Windows 10/11 x64 (MSVC ABI).

## Build locally

Install the Rust MSVC toolchain and Visual Studio Build Tools C++ workload, then run:

```powershell
cargo fmt --check
cargo test
cargo build --release
```

The executable is written to `target/release/appointment-pms-native.exe`.

## Current implementation status

The current binary proves native Win32 startup and a native message loop. It provides a basic native navigation shell. Buttons intentionally report that the corresponding modules have not yet been migrated. This is a foundation build, not a production PMS replacement.

## Migration order

1. Domain contracts and validation parity with the existing TypeScript implementation.
2. SQLite local persistence, transactional Outbox, workspace isolation, idempotency and tombstones.
3. Supabase Auth and REST synchronization with explicit real push/pull states.
4. Establishments, buildings, floors, rooms and the planning/Gantt surface.
5. Reservations, occupants, billing, inventory, housekeeping and reports.
6. CardLock MDB import and native USB/HID hardware integration.
7. Installer, upgrade/uninstall behavior, backup/restore and Windows compatibility tests.

Every migrated module must have Rust unit/integration tests and fixture-based parity tests against the existing application before it is enabled in production.
