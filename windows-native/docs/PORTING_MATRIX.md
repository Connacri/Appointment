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
| Role management / RBAC | `RoleDefinition`, `RolePermissions`, `AppTabId` | Not started | Role resolution, allowed-tab enforcement, permission checks and custom-role persistence |
| Staff HR / career history | `StaffMemberRecord`, `StaffPromotionEntry` | Not started | Staff lifecycle, assignments, shifts and auditable career transitions |
| Staff notifications | `StaffNotification`, role-aware derivation | Not started | Deterministic role-scoped notifications and read-state persistence |
| Dynamic pricing | `DynamicPricingView`, pricing domain services | Not started | Bulk updates, date/resource scope, validation and deterministic recalculation |
| Stock procurement / replenishment | `PurchaseOrderRecord`, `StockSupplier`, `applyStockDeductions` | Not started | Atomic stock deductions, supplier/order lifecycle and no negative inventory |
| Task productivity analytics | `bookingAnalyticsEngine.ts` task analytics | Not started | Period boundaries, staff workload, N/N-1 comparison and fixture parity |
| CardLock MDB | ProUSB import workflow | Not started | Read-only schema discovery, import preview, mapping and no-loss reconciliation |
| USB / HID | Windows hardware integration | Not started | Device enumeration, disconnect/reconnect, protocol fixtures and hardware tests |
| Reports / printing | Existing export flows | Not started | Native print/PDF output and document layout regression fixtures |

## Implemented slice

The current Rust core includes:
- A validated first-slice booking model with calendar-valid dates, integer minor-unit money and same-day date-range parity with the current TypeScript validator.
- CamelCase serialization for shared booking fields, with legacy snake_case deserialization aliases.
- A flattened extension map that preserves unmodeled TypeScript booking fields through Rust read/write round-trips.
- SQLite schema version 2, with a compatible booking-date index for legacy snake_case and canonical camelCase payloads.
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
- Preserve unknown/optional source fields during migration; the Rust booking extension map is a compatibility bridge, not proof that every field has native validation or business behavior.
- Do not treat TypeScript numeric currency amounts as interchangeable with Rust minor units without an explicit currency exponent and rounding policy.
- Do not claim parity for RBAC, staff HR, notifications, pricing, procurement or productivity analytics until each has a native model, persistence path, UI and fixture tests.
- Keep the existing Web and Android applications operational until Windows parity is demonstrated.
