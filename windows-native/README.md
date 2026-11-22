# Appointment PMS — Native Windows

Independent Windows desktop client built with Rust and Win32. No browser, Edge, WebView2, Electron, Node runtime, or HTML renderer is embedded.

## Build

~~~powershell
cargo fmt --all -- --check
cargo test --locked
cargo clippy --all-targets --locked -- -D warnings
cargo build --release --locked
~~~

## Native foundations

- Direct Win32 window and message loop.
- Rust PMS booking/occupant domain and verified Supabase booking-row mapper.
- SQLite workspace-scoped booking persistence, atomic Outbox writes and tombstones.
- Windows Credential Manager for refresh tokens, with an active-account UUID pointer.
- Native HTTPS transport through Windows WinHTTP; TLS certificate validation remains at the Windows HTTP stack.
- Supabase password sign-in, sign-up, refresh-token restore/rotation and logout API client.
- Access tokens are transient in-memory session data; refresh tokens are persisted only in Windows Credential Manager.
- Uses only the public Supabase publishable/anon key; never embed a service-role key.

## Not yet implemented

The auth client is a native service layer but is not yet connected to a login screen or application startup/session UI. Server-side workspace membership resolution, HTTP data synchronization, conflict resolution, full PMS screens, CardLock MDB import, USB/HID, printing and reports remain unimplemented. Do not treat a valid auth session as proof that a workspace membership or any data sync is ready.

## Configuration

The native client reads APPOINTMENT_SUPABASE_URL and APPOINTMENT_SUPABASE_PUBLISHABLE_KEY when set. Otherwise it uses the same public project defaults as the TypeScript client. A publishable key is public client configuration, not a service credential.

## Credential handling

Only refresh tokens are persisted, in the current Windows user's Credential Manager. The active account UUID is also stored there as a non-secret pointer so the client can locate the corresponding refresh token after restart. Access tokens remain memory-only. Passwords are never persisted. The client must clear the active pointer and refresh token during sign-out, including when the remote logout endpoint is unavailable.
