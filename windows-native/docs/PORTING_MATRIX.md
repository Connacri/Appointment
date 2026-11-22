# Native Windows migration matrix

This matrix tracks parity against the existing TypeScript PMS. A module is not considered migrated merely because a Rust type or placeholder screen exists.

| Domain | Existing source contract | Native status | Acceptance gate |
|---|---|---|---|
| Booking validation | `src/types/booking.ts` — `TimelineBooking` | Partial — typed core contract, occupant validation, date parity, money conversion and Supabase row mapper | Complete native workflows and remaining optional-field fixtures |
| Local booking store | `src/db/indexedDb.ts` | Partial | SQLite migration, workspace isolation, paging, atomic write and delete tests |
| Durable Outbox | `OutboxRecord`, `TombstoneRecord` in `src/db/indexedDb.ts` | Partial | Stable idempotency semantics, retry/backoff, conflict-safe acknowledgements |
| Workspace identity | WorkspaceContext and Supabase auth gate | Not started | Authenticated user-to-workspace mapping; no implicit shared/default workspace |
| Remote sync | Supabase services | Not started | Real pull/push, server acknowledgement, tombstones, retries and observable error states |
| Establishments / buildings / floors / rooms | Existing PMS types and import flows | Not started | Fixture parity and stable parent-child identifiers |
| Planning / Gantt | Existing timeline UI and booking rules | Not started | Date/timezone parity, overlap and availability tests |
| Reservations / occupants | `TimelineBooking`, `BookingOccupant` | Partial — canonical adult/child model, legacy aliases, slot normalization and row round-trip | Native reservation UI, lifecycle workflows and end-to-end fixtures |
| Billing / payments | `InvoiceRecord`, booking payments | Partial — booking amount mapping and explicit currency exponent rules | Native invoices, payment capture, totals reconciliation and billing UI |
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
- A typed TypeScript-compatible booking model with adult/child occupants, extras, payments, guest identity, PMS fields and a flattened extension map for future fields.
- Occupant normalization matching the TypeScript slot/count precedence, plus single-/multi-person validation and same-day date parity.
- Major-unit booking money is retained as received; conversion to integer minor units uses an explicit currency-exponent table and refuses unknown currencies.
- Supabase row conversion maps the verified bookings columns, payments_summary, occupants, custom guest metadata and the _pms envelope in both directions.
- SQLite and Outbox writes persist the normalized booking payload; legacy snake_case keys and previously normalized native minor-unit records remain readable.
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
- Do not treat TypeScript numeric currency amounts as interchangeable with Rust minor units without an explicit currency exponent and rounding policy. Current supported aliases are DA→DZD and RMB→CNY; DZD, EUR, USD, CNY, GBP and SAR use exponent 2. Other currency strings remain readable but cannot be converted to minor units.
- Do not claim parity for RBAC, staff HR, notifications, pricing, procurement or productivity analytics until each has a native model, persistence path, UI and fixture tests.
- Keep the existing Web and Android applications operational until Windows parity is demonstrated.
