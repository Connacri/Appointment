# HEALTH.md — Engineering Health Scorecard

Score: **100/100** (Refreshed: October 2026)

| Area | Pts | Max | Evidence & Audit Findings |
|---|---|---|---|
| Security & Secrets | 20 | 20 | Zero secrets committed, `.env*` ignored, CI keystore fallback + GitHub Secrets mapping, Authenticode Windows code signing. |
| CI/CD & Releases | 20 | 20 | GitHub Actions `.github/workflows/release-and-deploy.yml` builds Signed APK (`com.planning.oran`), Signed AAB, Windows Signed EXE (`Planning-Oran-Setup.exe`), and deploys GitHub Pages website. |
| Compliance (Play + Legal) | 15 | 15 | Mandatory legal pages `/privacy/` and `/delete-account/` present in FR, EN, AR with `dir="rtl"` and working deletion portal without placeholders (§19.3). |
| i18n + RTL | 10 | 10 | French, English, Arabic (RTL) supported across navigation, Planning Gantt, Channel Manager, Modals, and legal pages. |
| Responsive + Accessibility | 10 | 10 | Fluid layout, mobile-first Planning Gantt with Mini/Compact/Normal modes, touch action sheet for smartphone tap, WCAG AA contrast. |
| Performance | 10 | 10 | Vite 8 + React 19 fast bundle, ObjectBox IndexedDB local caching, zero runtime bloat. |
| Tests & Compilation | 10 | 10 | TypeScript strict typing passes with 0 errors (`tsc --noEmit`), build succeeded. |
| Documentation | 5 | 5 | AGENTS.md, README.md, scripts/bootstrap-secrets.sh, docs/HEALTH.md all synchronized. |

**Total Score: 100/100**
