# Native Windows migration matrix

This matrix tracks parity against the existing TypeScript PMS. A module is not considered migrated merely because a Rust type or placeholder screen exists.

| Domain | Existing source contract | Native status | Acceptance gate |
|---|---|---|---|
| Booking validation | `src/types/booking.ts` — `TimelineBooking` | Partial | Versioned lossless mapper; every optional field and legacy alias covered by fixtures |
| Local booking store | `src/db/indexedDb.ts` | Partial | SQLite migration, workspace isolation, paging, atomic write and delete tests |
| Durable Outbox | `OutboxRecord`, `TombstoneRecord` in `src/db/indexedDb.ts` | Partial | Stable idempotency semantics, retry/backoff, conflict-safe acknowledgements |
| Workspace identity | WorkspaceContext and Supabase auth gate | Not started | Authenticated user-to-workspace mapping; no implicit shared/default workspace |
| Remote sync | Supabase services | Not started | Real pull/push, server acknowledgement, tombstones, retries and observable error states |
| Establishments / buildings / floors / rooms | Existing PMS types and import flows | Not started | Fixture parity and stable parent-child identifiers |
| Planning / Gantt | Existing timeline UI and booking rules | Not started | Date/timezone parity, overlap and availability tests |
| Reservations / occupants | `TimelineBooking`, `BookingOccupant` | Not started | Lossless identity/document fields, adults/children and occupant list compatibility |
| Billing / payments | `InvoiceRecord`, booking payments | Not started | Decimal-safe money, payment history, invoice numbering and totals parity |
| Inventory / housekeeping / tasks | `StockItem`, `PmsTask`, resource contracts | Not started | Transactional stock movements and operational state transitions |
| CardLock MDB | ProUSB import workflow | Not started | Read-only schema discovery, import preview, mapping and no-loss reconciliation |
| USB / HID | Windows hardware integration | Not started | Device enumeration, disconnect/reconnect, protocol fixtures and hardware tests |
| Reports / printing | Existing export flows | Not started | Native print/PDF output and document layout regression fixtures |

## Implemented slice

The current Rust core includes:
- A validated first-slice booking model with calendar-valid dates and integer minor-unit money.
- SQLite schema version 1.
- Workspace-scoped booking CRUD and bounded reads.
- Atomic booking mutation + Outbox insertion.
- Atomic deletion + tombstone + Outbox insertion.
- Unique idempotency keys with safe same-operation retry handling.
- Workspace-scoped Outbox acknowledgement, failure and manual retry operations.

## Data safety rules

- Do not import or synchronize demo rows.
- Never issue a mutation without an explicit workspace identifier.
- Never report an item as synchronized before the server acknowledges it.
- Never discard a tombstone until remote deletion has been acknowledged under the chosen retention policy.
- Preserve unknown/optional source fields during migration; do not silently drop TypeScript fields not yet represented by Rust.
- Keep the existing Web and Android applications operational until Windows parity is demonstrated.
