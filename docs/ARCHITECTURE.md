# Architecture — Appointment PMS

> Reference for contributors and agents. Update this file in the same commit as any structural change.

## 1. Runtime shape

Appointment PMS is a **single-page React 19 application** built by **Vite 8** and wrapped for Android with **Capacitor 8**. There is no application server: the web build is static, local data lives in IndexedDB, and remote data (when enabled) goes through Supabase.

```text
index.html
└─ src/main.tsx
   └─ src/App.tsx
      └─ SupabaseAuthGate        (anonymous/hosted auth state, fails open in offline mode)
         └─ WorkspaceProvider    (Supabase workspace + outbox context)
            └─ AppProvider       (application state: bookings, resources, locks, UI flags)
               └─ MainLayout     (shell: TopBar, Sidebar, active view, global modals)
```

### Code splitting

`src/App.tsx` keeps only the landing experience eager: `TopBar`, `Sidebar`, `OfflineBanner`,
`PlanningTimeline`, `LegendBar` and `BookingModal`. Every other view and modal is loaded on
demand with `React.lazy` inside a `Suspense` boundary (`ViewFallback`), and modals are only
mounted while open. Adding a view means adding it to the lazy map, never to the eager imports.

### View error boundary

The working area is wrapped in `ViewErrorBoundary` (also in `src/App.tsx`). A rendering
exception thrown by a screen must never unmount the shell: the boundary keeps the header and
the navigation, states that local data is intact, and offers "Try again" and "Reload".

Stored records can come from older versions or CardLock imports and miss text or date fields.
Every comparison over `bookings`, `resourceGroups` or stock items therefore goes through
`normalizeBookingText` (`src/utils/bookingText.ts`) instead of calling `.toLowerCase()`
directly: an exception thrown during render is what turned a confirmed booking into a blank
page.

## 2. Source layout

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Shell, view routing (state-driven, no router), lazy map |
| `src/context/AppContext.tsx` | Global state: domain/role, language, bookings, resources, lock state, toast, modal flags |
| `src/components/` | Screens, modals and shared UI primitives |
| `src/db/` | IndexedDB stores (`indexedDb.ts`) and transaction helpers |
| `src/services/supabase/` | Auth gate, workspace context, typed PMS repository, generated DB types |
| `src/locks/protocol/` | proUSB wire protocol: frames, commands, transport (WebHID/WebUSB), `readerInfo` (machine code) |
| `src/locks/cards/` | Card codec (guest/master/system/floor/building), scope rules, card types |
| `src/locks/database/` | `CardLock.mdb` import, `CardInfo` synchronisation, database helpers |
| `src/locks/lockManager.ts` | Orchestration between UI, transport and codec |
| `src/i18n/translations.ts` | All UI strings, `fr` / `en` / `ar` |
| `src/types/` | Domain models (booking, channel, spa, establishment) |
| `src/utils/` | Pure helpers: booking validation, room readiness, PDF/ICS export, audio feedback |
| `public/privacy`, `public/delete-account` | Static legal pages (root + `fr/`, `en/`, `ar/`) copied into `dist/` |
| `scripts/` | Owner/CI tooling: secret bootstrap, Windows packaging, MDB and codec verification, i18n gate |

## 3. Data flow

1. **Local first** — `src/db/indexedDb.ts` owns the object stores. `AppContext` hydrates from IndexedDB on mount and persists snapshots transactionally after mutations.
2. **Remote sync** — `WorkspaceContext` resolves the automatic personal workspace; `AppContext` + `src/services/supabase/supabaseSync.ts` push the Outbox in causal order, pull paginated remote state through `pmsRepository`, and merge it without overwriting pending local edits or tombstones. The backfill planner seeds a new personal workspace from the real local establishment/inventory. Status is evidence-based: a present client or network indicator does **not** mean data is synchronised; see `docs/DATA_CONTRACT.md`.
3. **Hardware** — `lockManager` builds frames (`protocol/commands`), writes them through `WebHidTransport`, drains stale input reports, then re-reads the card to verify the write. `MockLockTransport` exists for tests only; the product has no simulator. Encoder identity comes from `readerInfo`.
4. **Legacy import** — `locks/database/mdbImport.ts` parses `CardLock.mdb` read-only; `cardInfoSync.ts` generates the synchronisation script for the live (VirtualStore) database.

## 4. UI system

- Design tokens, interaction primitives, motion and material styles live in `src/index.css`
  (`--pms-*`, `--ease-*`, `pms-card`, `pms-modal`, `pms-toast`, `pms-view-loading` …).
- Screens inherit the canvas background from the shell (`pms-canvas`); they must not
  redeclare `bg-slate-50 dark:bg-slate-950` on their root wrapper.
- Layout is mobile-first with Material window-size breakpoints (~600 / 840 / 1200 px),
  edge-to-edge safe areas, and RTL support driven by `document.documentElement.dir`.

## 5. Build & release

| Concern | Where |
|---|---|
| Quality gates (typecheck, unit tests, i18n parity, build) | `.github/workflows/quality-checks.yml` |
| Signed Android APK/AAB, Windows installers, GitHub Release, GitHub Pages | `.github/workflows/release-and-deploy.yml` |
| Branding source assets and generation | `assets/icon.png`, `assets/branding/icon-source.png`, `npm run assets:generate` |
| Details, secrets names and troubleshooting | `docs/RELEASE.md` |

Production artifacts are built **only** in GitHub Actions. Local release builds are forbidden
(see `AGENTS.md`).


## 6. Distributed LAN mode (P2P, protocol v1 foundation)

Appointment's distributed mode is peer-to-peer: each installation owns its local
IndexedDB (Web/Android) or SQLite (native Windows) database. No peer is authoritative
and there is no permanent or elected coordinator. Replication exchanges immutable
events; it never shares database files.

- The transport-neutral event contract is implemented in
  `src/services/p2p/protocol.ts` and `windows-native/src/p2p.rs`. Events have a
  stable node/sequence identity, workspace and entity scope, operation, payload and
  causal vector clock. Exact replays are idempotent; event-ID equivocation is rejected.
- Native SQLite schema v7 persists the append-only workspace event log, merged vector
  clock, peer cursors and per-record causal frontiers. The canonical local booking
  upsert/delete and entity-upsert APIs commit the business projection, tombstone where
  applicable, Supabase Outbox, P2P event, vector-clock advancement and local frontier
  in one SQLite transaction. Fault-injection tests verify rollback when event append
  fails. The explicitly named Outbox-only compatibility APIs are not safe entry points
  for new replicated business mutations.
- IndexedDB schema v8 persists the shared node identity, P2P event log, vector clocks,
  peer cursors and record frontiers. Local Outbox-backed mutations commit the business
  projection, Outbox intent, event and causal frontier in one IndexedDB transaction.
  Inbound pages append events, merge clocks, apply resolved projections, retain
  concurrent conflicts and advance the peer cursor in one transaction. A verified
  Outbox ACK re-evaluates blocked frontiers transactionally.
- Native inbound batches use one SQLite transaction for event append, causal-frontier
  calculation, projection application, conflict persistence and peer-cursor advancement.
  Pending local Outbox writes block remote overwrite. A projection failure rolls back
  the received events and cursor. Remote application uses a separate path and must not
  generate a new local event.
- Causally superseded events leave the materialized frontier. Concurrent events remain
  explicit conflicts; no generic last-write-wins rule is allowed for bookings,
  inventory or financial records. Tombstones are retained; safe compaction requires
  peer-wide checkpoints and is not yet enabled.
- LAN discovery is implemented on Windows Rust
  (`windows-native/src/p2p_discovery.rs`) and Android
  (`android/app/src/main/java/com/planning/oran/LanDiscoveryPlugin.java`). Both use
  IPv4 multicast 239.255.42.99:45871, protocol version 1 and the bounded JSON
  announcement {protocolVersion, peerId}. Discovery shares only a persisted
  installation UUID, not workspace IDs, user identities, credentials or business data.
  It provides presence only: a discovered address is untrusted and is not a connection.
- Browser-only deployments cannot open arbitrary UDP sockets. They require a native
  companion or a separate browser-compatible signaling/transport path; a companion
  must never become a database server or coordinator.
- **Production gate remains closed.** Native business workflows are not yet fully wired
  to the canonical atomic APIs, and discovery does not implement authenticated event
  transport. Encrypted peer pairing, workspace/user authorization, replay-safe transport,
  anti-entropy/checkpointing, bounded tombstone retention, user-facing domain conflict
  resolution, cross-platform crash/power-loss testing and restore drills remain release
  gates. No UI may report P2P synchronization as operational until these gates pass.
- With no coordinator or quorum, independent peers can accept conflicting operations
  while partitioned. Appointment cannot guarantee globally exclusive room allocation
  or globally serializable financial postings during a LAN partition; such conflicts
  must be detected after reconnection and resolved explicitly.

The event protocol, native persistence and Android discovery are covered by automated
unit/build gates. These gates do not prove authenticated transport or production
convergence. Do not enable business replication until every release gate above is
implemented and verified.
