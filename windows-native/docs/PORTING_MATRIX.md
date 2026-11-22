# Native Windows migration matrix

A module is not migrated merely because a Rust type or placeholder screen exists.

| Domain | Native status | Acceptance gate |
|---|---|---|
| Booking / occupants | Partial — typed contract, validation, normalization and Supabase row mapper | Full reservation workflows and fixture parity |
| Local booking store | Partial — SQLite, workspace isolation, bounded reads and atomic mutations | Complete entities and migration fixtures |
| Durable Outbox | Partial — transactional writes, tombstones, idempotency and retry state | Real remote ACK, replay and conflict convergence |
| Supabase authentication | Partial — native WinHTTP HTTPS transport; password sign-in/sign-up; refresh and logout service; Credential Manager token persistence; access token memory-only | Login UI, startup restore integration, refresh scheduling and live Supabase auth tests |
| Workspace identity | Not started — no membership lookup or authorization context yet | Resolve memberships from authenticated server responses; verify owner/member RLS |
| Remote sync | Not started | HTTP pull/push, server ACKs, tombstones, retries, conflicts and observable status |
| Establishments / buildings / floors / rooms | Not started | Fixture parity and stable parent-child identifiers |
| Planning / Gantt | Not started | Date/timezone parity, overlap and availability tests |
| Billing / payments | Partial — booking amount mapping and currency rules | Native invoices, payment capture and reconciliation |
| Inventory / housekeeping / tasks | Not started | Transactional stock movements and operational state transitions |
| Role management / RBAC | Not started | Server-derived roles, permission enforcement and persistence |
| Staff HR / notifications | Not started | Staff lifecycle, assignments and role-scoped notifications |
| Dynamic pricing / procurement | Not started | Deterministic pricing, supplier/order lifecycle and inventory safety |
| CardLock MDB | Not started | Read-only schema discovery, preview and no-loss reconciliation |
| USB / HID | Not started | Device enumeration, reconnect and protocol fixtures |
| Reports / printing | Not started | Native print/PDF output and regression fixtures |

## Authentication milestone

- WinHTTP sends HTTPS requests directly through the Windows networking stack; no browser, WebView, Node runtime or third-party HTTP dependency is used.
- TLS verification is not disabled or bypassed.
- Password sign-in and sign-up follow the Supabase Auth endpoints used by the TypeScript client.
- Refresh-token rotation is persisted to Credential Manager, scoped by Supabase auth user UUID.
- A non-secret active-user UUID pointer allows session restoration after process restart.
- Access tokens remain only in the in-memory AuthSession and are not serialized to SQLite or files.
- Sign-out clears local refresh-token material even if the remote logout request fails.
- This milestone does not resolve workspaces or perform data synchronization. Authenticated identity is necessary but insufficient for tenant authorization.
