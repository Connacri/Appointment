# HEALTH.md — Engineering Health Scorecard

Score: **88/100** (Refreshed: 2026-11-05)

> The previous score (100/100) was not evidence-based: it claimed “zero runtime bloat”
> while the initial JS payload was 1.75 MB (494 kB gzip). The score is corrected here
> and now reflects measured output and identified gaps.

| Area | Pts | Max | Evidence & Audit Findings |
|---|---|---|---|
| Security & secrets | 18 | 20 | No secret tracked (`.env*`, keystores, service accounts ignored); CI reconstructs the signing keystore only in `$RUNNER_TEMP` and deletes it with `if: always()`; production deps: `npm audit --omit=dev` → **0 vulnerabilities**. Gap: 8 moderate advisories remain in the dev toolchain. |
| CI/CD & releases | 19 | 20 | `release-and-deploy.yml` builds signed APK/AAB (`com.planning.oran`) + Windows setup, publishes an immutable GitHub Release per run and deploys GitHub Pages; `quality-checks.yml` gates typecheck, tests, i18n and build. Gap: no build-provenance attestation yet. |
| Compliance (Play + legal) | 14 | 15 | `/privacy/` and `/delete-account/` shipped in fr/en/ar (`dir="rtl"` for Arabic), rewritten from a code audit so they describe what the app really does (no Firebase/FCM/analytics claims); `docs/COMPLIANCE.md` is the data inventory behind the Play Data Safety answers; CI fails on missing pages, missing `dir="rtl"`, placeholders/stale branding or missing README links. Gap: in-app account deletion still needs a backend endpoint (web `mailto:` request is the only server-side path). |
| i18n + RTL | 9 | 10 | 111 keys × fr/en/ar, `npm run i18n:check` enforced in CI, `dir`/`lang` driven by `AppContext`, RTL logical properties in the shell. Gap: several screens still branch on `language === 'fr'` inline, and the default language is `fr` instead of `en`. |
| Responsive + accessibility | 8 | 10 | Mobile-first breakpoints, safe areas, 44 px targets, visible focus, reduced-motion/transparency/contrast fallbacks. Gap: no automated axe or Playwright device × language matrix. |
| Performance | 9 | 10 | Initial bundle cut from **494 kB → ~208 kB gzip** (main chunk 418 kB / 122 kB gzip, lucide 295 kB / 85 kB gzip) by code-splitting 12 views and 7 modals; every other view/modal loads on demand. Gap: slightly above the 200 kB budget and no Lighthouse CI budget file. |
| Tests | 7 | 10 | 38 unit tests green (`bookingValidation`, `readerInfo`, `cardLockScope`, `cardSpecialDecode`, `roomReadiness`, `mdbImport`) + i18n parity gate. Gap: no component or E2E tests. |
| Documentation | 4 | 5 | `README`, `CHANGELOG`, `docs/ARCHITECTURE.md`, `docs/I18N.md`, `docs/COMPLIANCE.md`, `docs/RELEASE.md`, CardLock specs. Gap: `docs/BRANDING.md` missing (splash assets absent). |

**Total: 88/100**

## 2026-11-05 — Agent context hygiene (no score change)

Every request used to carry ~21 k tokens of `AGENTS.md` plus five MCP servers
(~290 tool schemas). Measured and fixed:

| Item | Before | After |
|---|---|---|
| `AGENTS.md` | 82,395 bytes (~20.6 k tokens) | 41,335 bytes (~10.3 k tokens) |
| MCP tool schemas in context | firebase 19 · google-play 16 · rea 207 · render 28 · supabase 20 | 0 (servers configured but disabled) |
| Global `rea` server | connected (207 tools) | disabled |
| Render / Swift / Expo / Sonner skills | advertised | denied |

- Moved the owner bootstrap to `docs/ci/OWNER-BOOTSTRAP.md` and the optional
  advanced-quality reference to `docs/ci/QUALITY-ADVANCED.md`.
- Deleted three stale appendices instead of moving them: the old Appendix B (an outdated
  copy of `scripts/bootstrap-secrets.sh` that pushed the wrong secret names), Appendix C
  (`ci-release.yml`, never shipped, contradicted the real pipeline) and Appendix G
  (duplicate of `docs/RELEASE.md`).
- Corrected the secret/variable inventory to what CI actually reads
  (`ANDROID_KEYSTORE_BASE64`, `PLAY_STORE_JSON_KEY`, `PLAY_STORE_JSON_KEY_PRESENT`, …).
- Repaired the double-encoded mojibake (UTF-8 → CP1252 → UTF-8) that made the whole
  contract unreadable in places.
- Added the project `opencode.json`: Supabase scoped to this project in read-only mode,
  everything else disabled, Render/Swift/Expo/Sonner skills denied. Documented in
  `docs/SUPABASE_MCP.md`.

Verified: Quality Checks + Production Release green on `2dfe231`, Pages legal pages
HTTP 200 in fr/en/ar. Score unchanged: this is operational hygiene, not a product area.


## 2026-11-05 — Legal pages rebuilt from a code audit

The published `/privacy/` and `/delete-account/` pages described a different product
("AgentOps Autonomous Cockpit", Firebase/FCM, Google Sign-In, clinic/patient data, Play
Integrity, telemetry) that does not exist in this repository, and the deletion form showed
a fake "verification link dispatched" confirmation while sending nothing.

- Rewrote `public/privacy/{en,fr,ar}` from an audit of `src/`: local-first IndexedDB data,
  optional Supabase email/password account, WebHID and camera capabilities, Google Fonts
  and GitHub Pages as the only third parties, explicit "we do not collect" list.
- Rewrote `public/delete-account/{en,fr,ar}`: accurate in-app purge steps (top-bar menu →
  Privacy & Account → Local data → Clear local data), a **working** request channel
  (pre-filled `mailto:` the user actually sends), honest retention statements (no analytics,
  invoices are local) and a 72-business-hour timeline.
- Fixed stale titles (`AgentOps AGENTS.md`, `Appointment AGENTS.md`) on the root pages.
- Added `docs/COMPLIANCE.md` (data inventory, permissions, third parties, deletion flows,
  Play Data Safety mapping, open items for the owner).
- CI: the legal-page step now fails on missing files, missing `dir="rtl"` on Arabic pages,
  placeholders/stale branding (`TODO`, `example.com`, `AgentOps`, …) or missing README links.

**Review required**: the legal texts should be validated by the owner or a lawyer.

## 2026-11-05 — Performance, dependencies and i18n gate

Measured with `npm run build` (Vite 8 / rolldown) before and after:

| Metric | Before | After |
|---|---|---|
| Initial JS (gzip) | ~494 kB | ~208 kB |
| `index-*.js` | ~1.75 MB | 418 kB (122 kB gzip) |
| Lazy chunks | none | 12 views + 7 modals + `jspdf`/`html2canvas` |

Changes:

- `App.tsx`: eager imports reduced to the landing shell (`TopBar`, `Sidebar`, `OfflineBanner`,
  `PlanningTimeline`, `LegendBar`, `BookingModal`); every other view/modal is `React.lazy`
  behind `Suspense` and modals mount only while open.
- Removed unused dependencies (verified 0 imports): `d3`, `@types/d3`, `motion`,
  `@google/genai`, `express`, `@types/express`, `dotenv`, `buffer`, `autoprefixer`, `esbuild`
  → `npm install` removed 192 packages.
- Removed dead component `DomainRoleSelector.tsx` (superseded by the `TopBar` switcher, imported nowhere).
- Replaced duplicated `bg-slate-50 dark:bg-slate-950` wrappers (10 screens) with the inherited
  `pms-canvas` background token; added the `pms-view-loading` fallback skeleton.
- Added `npm run i18n:check` (`scripts/check-i18n.ts`) and wired it into the CI *Regression tests* job.
- Documentation: `docs/ARCHITECTURE.md` (shell, lazy map, source layout, data flow) and
  `docs/I18N.md` (key contract, placeholders, RTL checklist) added.

## 2026-10-27 — CardInfo synchronisation (ID + Operator Code)

Root cause of the reported symptom *"still no ID and no Operator Code"*:

- `CardLock.exe` is a legacy 32-bit binary without a manifest installed under
  `Program Files (x86)`, so **Windows UAC file virtualisation redirects all its
  writes** to `%LOCALAPPDATA%\VirtualStore\Program Files (x86)\…\CardLock.mdb`.
- Measured on the real installation: the `Program Files` copy was still dated
  `12/12/2023` with 62 cards, while the VirtualStore copy held **88 cards** and
  had been written the same day.
- A synchronisation aimed at `Program Files` was therefore invisible to the
  software — the `CardInfo` row existed, but not in the file the app reads.

Fix shipped:

- the generated `.vbs` resolves the live database at run time (most recently
  modified of VirtualStore / install folder, `--mdb` override available);
- no elevation is requested when the target is the VirtualStore copy;
- it warns when `CardLock.exe` is still running;
- it re-reads every row and prints `ID` + `Operator Code`, e.g.
  `AAEC631B -> ID 1353 / Admin`;
- the UI now points at the VirtualStore path for both import and sync.

Verified on a **copy** of the real database (never the original): 2 rows
inserted (`GongHao = Admin`), 1 already-present row skipped, second run
idempotent (0 inserted / 3 present), backup created, Unicode preserved
(`é` = U+00E9, `غرفة` = U+063A U+0631 U+0641 U+0629`), apostrophe stored
verbatim. `scripts/verify-cardinfo.ts` → **31/31 green**.
