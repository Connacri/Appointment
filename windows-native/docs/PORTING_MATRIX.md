# Native Windows migration matrix

A module is not migrated merely because a Rust type or placeholder screen exists.

| Domain | Native status | Acceptance gate |
|---|---|---|
| Booking / occupants | Partial — typed contract, validation, normalization and Supabase row mapper | Full reservation workflows and fixture parity |
| Local booking store | Partial — SQLite, workspace isolation, bounded reads and atomic mutations | Complete entities and migration fixtures |
| Durable Outbox | Partial — transactional writes, tombstones, idempotency, FIFO due-entry selection, exponential retry scheduling and workspace-scoped counters | Real remote ACK, replay and conflict convergence |
| Supabase authentication | Partial — Win32 sign-in/sign-up, async startup restore, refresh and logout; Credential Manager token persistence scoped by Supabase endpoint; access token memory-only | Live Supabase auth tests and periodic refresh scheduling |
| Workspace identity | Partial — deterministic personal workspace bootstrap and PostgREST owner-membership verification through RLS | Live RLS integration tests, shared workspace selection and server-side authorization evidence |
| Remote sync | Partial — sequential booking-only Outbox push, workspace/RLS gate, resource tenant validation, optimistic server-version updates, idempotent lost-ACK recovery and terminal conflict state; engine not yet wired to UI | Remote pull/cursors, tombstone reconciliation, multi-workspace selection, live integration tests and observable native status |
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

## Authentication and workspace milestone

- WinHTTP sends HTTPS requests directly through the Windows networking stack; no browser, WebView, Node runtime or third-party HTTP dependency is used.
- TLS verification is not disabled or bypassed; request and response sizes/timeouts are bounded.
- Sign-in, sign-up, startup refresh restoration and sign-out are exposed through a native Win32 UI; network work runs on a background thread.
- Refresh-token rotation is persisted to Credential Manager, scoped by a stable identifier derived from the configured HTTPS endpoint. A non-secret active-user UUID pointer is project-scoped.
- Access tokens remain only in the in-memory AuthSession and are not serialized to SQLite or files. The password edit control is cleared after submission.
- The personal workspace uses the authenticated user UUID as its stable ID, matching the TypeScript client. Missing workspace and owner membership are created/repaired through RLS-authorized PostgREST operations.
- Workspace access is accepted only after a fresh `workspaces` query with `workspace_members!inner(role)` returns the expected owner row under the authenticated JWT. Failed verification leaves the native client local-only.
- Shared workspace selection, live Supabase/RLS integration tests and business-data synchronization remain pending.
