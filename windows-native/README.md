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

## Native authentication and tenant boundary

The Win32 client provides native Supabase sign-in/sign-up, startup refresh-token restoration and sign-out over WinHTTP. Network operations run off the UI thread. Refresh tokens are stored in the current Windows user's Credential Manager and scoped to the configured HTTPS project; access tokens remain in memory. The password edit control is cleared immediately after submission.

After authentication, the client resolves the deterministic personal workspace (`workspace_id = auth user UUID`), creates it if absent, repairs its owner membership when permitted, and re-reads the workspace through the PostgREST relationship under RLS. A valid Auth session or local UUID is not treated as workspace authorization. If the RLS-backed read fails, the UI remains local-only and reports the reason. Shared workspaces are not auto-selected.

## Configuration

The default public Supabase project configuration matches the TypeScript client. For a custom project, set both `APPOINTMENT_SUPABASE_URL` and its matching `APPOINTMENT_SUPABASE_PUBLISHABLE_KEY`; overriding only the URL is rejected. A publishable key is public client configuration, not a service credential.

## Credential handling

Only refresh tokens are persisted, in the current Windows user's Credential Manager. The active account UUID is also stored there as a non-secret pointer so the client can locate the corresponding refresh token after restart. Access tokens remain memory-only. Passwords are never persisted. The client must clear the active pointer and refresh token during sign-out, including when the remote logout endpoint is unavailable.
