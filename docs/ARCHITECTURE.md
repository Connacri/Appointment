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
IndexedDB (Web) or SQLite (native Windows) database. No peer is authoritative and
there is no permanent or elected coordinator. Replication is an immutable event-set
exchange, not database-file sharing.

- The transport-neutral event contract is implemented in
  `src/services/p2p/protocol.ts` and `windows-native/src/p2p.rs`.
- Each event has a stable node/sequence identity, workspace scope, entity identity,
  operation, payload and causal vector clock.
- Replicas merge by set union. Replayed events are idempotent; reuse of an event ID
  with different content is treated as node equivocation.
- Causally superseded events leave the materialized frontier. Concurrent events
  remain explicit conflicts. There is deliberately no generic last-write-wins rule:
  booking, inventory and financial conflicts require domain-specific handling.
- Local IndexedDB/SQLite remain authoritative for immediate local reads and writes.
  The event log and materialized projections must be committed atomically by each
  storage adapter before a mutation is advertised to peers.
- LAN peer discovery is implemented on both supported native endpoints:
  Windows Rust (windows-native/src/p2p_discovery.rs) and the Android APK
  Capacitor plugin (android/app/src/main/java/com/planning/oran/LanDiscoveryPlugin.java).
  Both use IPv4 multicast 239.255.42.99:45871, protocol version 1 and the same
  bounded JSON announcement {protocolVersion, peerId}. Announcements repeat
  every 3 seconds; peers expire after 12 seconds without a heartbeat. Installation
  UUIDs are persisted locally (Windows under the user's Appointment AppData folder,
  Android in app-private noBackupFilesDir storage, excluded from Android Auto Backup).
- Discovery publishes no workspace ID, account, credential, business data or
  listening port. A found address is an untrusted candidate only: it does not
  establish pairing, membership, authorization, encryption or a data connection.
  Windows displays the discovered-peer count. Android emits native Capacitor
  peerFound, peerExpired and discoveryError events; discovery pauses while
  the Android Activity is backgrounded to avoid a persistent battery/network worker.
- Android discovery requires local-network permission on OS versions that enforce it:
  Android 16 compatibility-mode testing uses the Nearby devices grant; Android 17+
  requires the ACCESS_LOCAL_NETWORK runtime permission. The plugin also acquires
  and releases the Wi-Fi multicast lock only while discovery is active.
- Browser-only web deployments cannot open arbitrary UDP sockets and are not
  discoverable directly. They need a native companion or a separate browser-compatible
  peer signaling path. A native companion is a transport bridge, never a database
  server or coordinator.
- LAN discovery is now implemented, but authenticated peer transport, encrypted
  pairing, durable event-log persistence atomic with local business writes,
  anti-entropy/replay protection, workspace authorization, domain conflict workflows
  and browser companion integration are not yet complete. Do not label P2P data
  synchronization operational until those gates are verified.
- Offline multi-writer operation cannot guarantee globally exclusive room
  reservations during a network partition. Concurrent overlapping reservations
  must be surfaced as conflicts for explicit business resolution; the product
  must not report them as globally conflict-free.

The protocol foundation is covered by `tests/p2pProtocol.test.ts` and Rust unit
tests. LAN discovery, authenticated peer transport, durable event persistence,
anti-entropy, domain-specific conflict workflows and browser companion integration
remain separate implementation gates; do not label P2P synchronization operational
until those gates are verified.
