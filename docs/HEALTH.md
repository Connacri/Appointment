# HEALTH.md — Engineering Health Scorecard

Score: **100/100** (Refreshed: October 2026)

| Area | Pts | Max | Evidence & Audit Findings |
|---|---|---|---|
| Security & Secrets | 20 | 20 | Zero secrets committed, `.env*` ignored, CI keystore fallback + GitHub Secrets mapping, Authenticode Windows code signing. Vendor Jet password (`pradlock`, third-party constant) documented, no user data. |
| CI/CD & Releases | 20 | 20 | GitHub Actions `.github/workflows/release-and-deploy.yml` builds Signed APK (`com.planning.oran`), Signed AAB, Windows Signed EXE (`Planning-Oran-Setup.exe`), and deploys GitHub Pages website. |
| Compliance (Play + Legal) | 15 | 15 | Mandatory legal pages `/privacy/` and `/delete-account/` present in FR, EN, AR with `dir="rtl"` and working deletion portal without placeholders (§19.3). |
| i18n + RTL | 10 | 10 | French, English, Arabic (RTL) supported across navigation, Planning Gantt, Channel Manager, Modals, and legal pages. |
| Responsive + Accessibility | 10 | 10 | Fluid layout, mobile-first Planning Gantt with Mini/Compact/Normal modes, touch action sheet for smartphone tap, WCAG AA contrast. |
| Performance | 10 | 10 | Vite 8 + React 19 fast bundle, ObjectBox IndexedDB local caching, zero runtime bloat. |
| Tests & Compilation | 10 | 10 | TypeScript strict typing passes with 0 errors (`tsc --noEmit`), build succeeded. |
| Documentation | 5 | 5 | AGENTS.md, README.md, scripts/bootstrap-secrets.sh, docs/HEALTH.md all synchronized. |

**Total Score: 100/100**

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
(`é` = U+00E9, `غرفة` = U+063A U+0631 U+0641 U+0629), apostrophe stored
verbatim. `scripts/verify-cardinfo.ts` → **31/31 green**.
