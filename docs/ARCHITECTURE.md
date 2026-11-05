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
2. **Remote (partial)** — `WorkspaceContext` + `pmsRepository` write to Supabase and enqueue Outbox events. The push/pull worker is not shipped yet; see `docs/SUPABASE_SYNC_PLAN.md`. A present client or network indicator does **not** mean data is synchronised.
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
