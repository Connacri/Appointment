# AGENTS.md

> Operating contract for the autonomous engineering agent of this project.
> Rules marked **MUST / NEVER** are blocking. Rules marked **SHOULD** are strong defaults.
> If a rule conflicts with a user instruction, follow the user, then state the deviation in the commit body.
>
> **This file is self-contained and the single source of truth**: it includes the secrets/keys procedure (Appendix A), the bootstrap script (Appendix B), the full CI/CD workflow (Appendix C), and the Gradle signing config (Appendix D). If `.github/workflows/ci-release.yml` or `scripts/bootstrap-secrets.sh` is missing, create it from the appendix; if they differ, the appendix wins and the files MUST be re-synced in the same commit.

---

## 1. ROLE

Act as a senior engineer covering: Software Architecture, Full-Stack, UI/UX, DevOps/CI-CD, Performance, Security, Accessibility, and Growth/Marketing (only when requested).

Goals: the project stays **functional, clean, maintainable, performant, secure, documented, accessible, localized, and automatically deployable**.

Do not behave like a code generator that edits only the requested file. Understand the architecture first, then make the smallest coherent change.

---

## 2. NON-NEGOTIABLE RULES

1. **NEVER** build or sign production artifacts locally (release APK, release AAB, production web build, signed packages). Production builds happen **only in GitHub Actions**.
2. **NEVER** commit secrets: `.env*`, keystores (`*.jks`, `*.keystore`), `key.properties`, service-account JSON, Firebase admin keys, tokens, Base64-encoded credentials. Check `git diff --staged` before every commit.
3. **NEVER** claim a build, release, or deployment succeeded without verifying the real CI result.
4. **NEVER** force-push to `main`, rewrite published history, or delete tags/releases without explicit user approval.
5. **NEVER** change `applicationId` / bundle ID, signing configuration, or the upload certificate without explicit user approval (this is irreversible on Google Play).
6. **NEVER** hardcode user-facing strings, colors, spacing, or secrets in components.
7. **NEVER** use a local release build as proof that production works.
8. **NEVER** release, publish, or consider the project ready without a public **Privacy Policy** and **Delete Account** page on the website (§19). If missing, create them first.
9. **NEVER** move, delete, or reuse a version tag; releases follow SemVer (§18).
10. **NEVER** print, log, read back, or ask the user to paste any secret, key, password, or token in chat. Secrets are created by the **owner** with the bootstrap script (Appendix A/B) and stored only in GitHub Secrets.

Local work is allowed for: editing, static analysis, linting, formatting, unit/integration tests, debug builds, dev servers, inspection.

---

## 3. DEFINITION OF DONE

A task is done only when every applicable box is true:

```text
implementation → tests → lint/typecheck → i18n parity → responsive check
→ cleanup → README/website/legal sync → version + changelog → commit → push → CI green → artifacts verified
```

Mandatory final sequence:

```bash
git status
git diff --staged        # review for secrets and unrelated changes
git add <specific files> # avoid blind `git add -A`
git commit -m "<conventional message>"
git push
gh run watch             # or inspect the workflow run
```

If CI fails: read the logs, fix the root cause, push again. Never mask failures (`continue-on-error`, deleted tests, loosened checks) to get green.

In the final report, state: what changed, which workflow run was verified, the resulting version, and anything not verified.

---

## 4. GIT WORKFLOW & COMMITS

* Branches: `main` is always releasable. For non-trivial work use `feat/…`, `fix/…`, `chore/…` and open a PR when the user wants review; otherwise push to `main` is allowed for small, tested changes.
* Use **Conventional Commits** with an imperative subject ≤ 72 chars and a body explaining *why* when non-obvious.

```text
feat: add Google authentication
fix(fcm): resolve token refresh on cold start
refactor: simplify authentication architecture
perf: lazy load anatomy modules
docs: update README
ci: automate signed Android releases
chore: remove unused dependencies
i18n: add Arabic translations for settings
```

* Forbidden messages: `update`, `fix`, `changes`, `test`, `new`, `wip`.
* One logical change per commit. Do not mix refactors with features.
* Breaking changes: `feat!:` or a `BREAKING CHANGE:` footer.

---

## 5. ARCHITECTURE

Before implementing a feature:

1. Inspect the existing architecture and conventions.
2. Identify the correct module/layer.
3. Reuse existing abstractions; do not create duplicate services/components.
4. Avoid new dependencies unless clearly justified (size, maintenance, license, security).
5. Preserve existing working behavior; add tests for regressions you fix.
6. Make the smallest coherent change.

Architecture must be modular, predictable, testable, scalable, and easy to debug. Keep a short `docs/ARCHITECTURE.md` up to date when structure changes.

---

## 6. CODE CLEANUP

During relevant work, look for dead code, unused imports/files/components/services/dependencies, unreachable routes, duplicated logic, obsolete implementations, abandoned TODOs, temporary code, and stray `console.log` / debug flags.

* Clearly useless → remove it.
* Clearly intended but disconnected → wire it correctly.
* Ambiguous → investigate (git history, usages) before deleting. Never blindly delete architecture.

---

## 7. UI / UX

Apply **Jacob's Law**: prefer familiar, platform-conventional patterns (navigation, forms, dialogs, search, settings, auth, feedback, loading states).

Priority order: usability → clarity → consistency → accessibility → responsiveness → performance → visual polish.

* Follow Material 3 on Android and Human Interface Guidelines on iOS where the framework allows; keep one coherent design system (tokens for color, type, spacing, radius, elevation).
* Support **light and dark** themes and respect system preference.
* Provide visible focus states, meaningful labels, and proper semantics.
* Never rely on color alone to convey meaning.

---

## 8. RESPONSIVE & MULTI-DEVICE LAYOUT (first-class requirement)

Every UI change MUST be evaluated on all supported classes:

| Class | Examples |
|---|---|
| Phone | 360×640 → 430×932, portrait + landscape |
| Foldable / small tablet | 600–840 dp |
| Tablet | 840+ dp, portrait + landscape |
| Web | mobile, tablet, laptop, desktop, ultrawide |

Rules:

* **Mobile-first**, with breakpoints at ~`600`, `840`, `1200` (Material window size classes: compact / medium / expanded).
* Use fluid layouts (flex/grid, `min()`/`max()`/`clamp()`, `dvh` instead of `100vh`). No fixed pixel widths for containers.
* **Edge-to-edge** is mandatory (enforced on Android 15+): handle **safe areas / insets** (status bar, navigation bar, display cutout, IME) with `env(safe-area-inset-*)` or the framework equivalent.
* Tablets/expanded: use adaptive patterns (two-pane list-detail, navigation rail instead of bottom bar, max content width ~720–960 px). Do not just stretch the phone UI.
* Touch targets ≥ **48×48 dp**; spacing between targets ≥ 8 dp.
* Support OS font scaling up to **200%** without clipping or overlap. Use `rem`/`sp`, never fixed font sizes.
* Handle orientation changes, split-screen, resizable windows, and foldable posture changes without losing state.
* Keyboard-open state must keep the focused field visible.
* Web: support keyboard navigation, hover + touch, `prefers-reduced-motion`, `prefers-color-scheme`.
* Images: responsive sizes, lazy loaded, explicit dimensions to avoid layout shift.

Before declaring UI work done, verify (emulator, devtools device mode, or screenshots) at least: small phone, large phone, tablet portrait, tablet landscape, desktop web, **and RTL** (see §9).

---

## 9. LOCALIZATION (i18n) — `fr`, `en`, `ar`

Supported languages: **French (`fr`)**, **English (`en`)**, **Arabic (`ar`, RTL)**.

* Single source of truth: `src/i18n/translations.ts` (or the project's i18n mechanism). **No hardcoded user-facing strings** anywhere (UI, errors, notifications, validation messages, accessibility labels, push payload templates, store listing).
* **Key parity is enforced**: every key must exist in `fr`, `en`, and `ar`. Add a script/test (`npm run i18n:check`) that fails CI on missing, extra, or empty keys and on mismatched interpolation placeholders.
* Default/fallback language: `en`; initial language from device locale if supported, otherwise fallback. Allow manual override in Settings and **persist** it.
* Use `Intl` APIs for dates, numbers, currencies, relative time, lists, and plural rules. Arabic has **6 plural forms** (zero, one, two, few, many, other): use proper plural handling, never `count === 1 ? … : …`.
* Prefer ICU-style messages with named placeholders; never build sentences by string concatenation.
* Arabic copy must be written naturally (Modern Standard Arabic unless the user specifies a dialect), not machine-literal. Flag any machine-translated text for human review in the PR/commit body.

### RTL (Arabic) requirements

* Set `<html lang="ar" dir="rtl">` on web, and `android:supportsRtl="true"` plus `start/end` (never `left/right`) on native.
* Use **CSS logical properties**: `margin-inline-start`, `padding-inline-end`, `inset-inline-*`, `text-align: start`, `border-start-*`. Ban `left/right` for layout unless intentionally physical.
* Mirror directional icons (back, forward, chevrons, progress, send); do **not** mirror logos, media controls, clocks, or phone numbers.
* Handle bidirectional text: wrap mixed-direction fragments (URLs, numbers, Latin brand names) with `dir="auto"` / `<bdi>` where needed.
* Numerals: default to Western digits (0–9) for consistency with `fr/en` unless the user requests Arabic-Indic digits; make this a single configurable setting.
* Fonts: use a family with full Arabic coverage (e.g. Noto Sans Arabic / Cairo / IBM Plex Sans Arabic), with correct line-height (Arabic needs more vertical space) and no letter-spacing on Arabic text.
* Animations, swipes, carousels, drawers and sliders must follow the reading direction.
* Layouts must survive text expansion: French is ~20–30% longer than English; Arabic differs in height more than width.

### Store listing & metadata

Maintain localized Google Play assets under `store/listing/{fr-FR,en-US,ar}/` (title ≤ 30, short description ≤ 80, full description ≤ 4000, release notes ≤ 500, localized screenshots). The app name and permission rationale strings must be localized natively (`values/`, `values-fr/`, `values-ar/` on Android; `InfoPlist.strings` on iOS).

---

## 10. NATIVE ICON & SPLASH SCREEN (generated at build time)

Icons and splash screens are **generated from source assets**, never hand-edited in native folders.

Source assets (single source of truth, committed):

```text
assets/branding/
  icon-source.png            # 1024×1024, no transparency for iOS, no rounded corners
  icon-foreground.png        # 1024×1024 transparent, content inside the central 66% safe zone
  icon-background.png        # solid color or 1024×1024 image
  icon-monochrome.png        # Android 13+ themed icon (single color + alpha)
  splash.png                 # ≥ 2732×2732, logo centered, safe within central ~1200 px
  splash-dark.png            # dark-mode variant
  play-store-icon.png        # 512×512 for the Play listing
  feature-graphic.png        # 1024×500 for the Play listing
```

Rules:

* Generate with the tool that matches the stack, run as a **CI step before the native build** (and locally via `npm run assets:generate` for dev):
  * Capacitor → `@capacitor/assets generate` (with `--iconBackgroundColor`, `--splashBackgroundColor`, dark variants)
  * Flutter → `flutter_launcher_icons` + `flutter_native_splash`
  * Expo/React Native → `expo-asset`/config plugins or `react-native-bootstrap-splash`
* **Android icons**: adaptive icon (foreground + background) **plus monochrome layer** for themed icons, legacy mipmaps for API < 26, round variant.
* **Android 12+ splash**: use the **SplashScreen API** (`Theme.SplashScreen`, `windowSplashScreenBackground`, `windowSplashScreenAnimatedIcon`), icon within the safe circle (~⅔ of 288 dp), dark theme variant, and no custom full-screen image on API 31+. Keep a compatible fallback for older APIs.
* **iOS**: full `AppIcon` set (including 1024 marketing icon, no alpha) and a storyboard launch screen with light/dark.
* **Web/PWA**: favicon (`.ico`, `.svg`), `apple-touch-icon`, maskable PWA icons (192, 512), `manifest.webmanifest` with `theme_color`/`background_color`, and `<meta name="theme-color">`.
* Splash must hide as soon as the app is interactive (no artificial delays), and must not flash white in dark mode.
* CI verifies the generation: fail the build if the expected files (e.g. `mipmap-anydpi-v26/ic_launcher.xml`, `drawable*/splash*`) are missing or if source assets are below the minimum resolution.
* Do **not** commit generated native icon/splash outputs if the pipeline regenerates them; if the project must commit them, regenerate and commit in the same change as the source asset update.

---

## 11. PERFORMANCE

* Prioritize startup time, fluid 60 fps (120 fps capable) rendering, small initial payload, and lazy loading (route-level code splitting, deferred heavy modules).
* **ObjectBox**: use paginated lazy queries with `offset` and `limit`; never load whole collections into memory; index queried properties; run writes off the UI thread.
* Lists: virtualization, stable keys, memoized rows.
* Images: modern formats (WebP/AVIF), correct sizes, lazy loading, caching.
* Budgets (adjust to the project): web initial JS ≤ 200 KB gzip, LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms; Android cold start ≤ 2 s on mid-range devices. Report regressions found.
* Android release builds MUST enable **R8 minification + resource shrinking**; keep rules maintained and test the minified build via CI smoke tests. Upload `mapping.txt` and native debug symbols to Play/Crashlytics.

---

## 12. STATE HANDLING

Every data-driven screen explicitly handles: **loading (skeleton), success, empty, error, offline, retry, and partial/stale data**. Errors are localized, actionable, and never expose stack traces or internals. Offline-first where the product allows it, with clear sync status.

---

## 13. ACCESSIBILITY

Target **WCAG 2.2 AA**.

* Contrast ≥ 4.5:1 (text) and 3:1 (UI components) in light **and** dark themes.
* Screen-reader labels (TalkBack / VoiceOver / ARIA) in all three languages; correct reading order, including RTL.
* Don't disable zoom. Respect reduced-motion and large-text settings.
* Forms: associated labels, error messages linked to fields, correct input types and autofill hints.

---

## 14. SECURITY & PRIVACY

* Secrets only in **GitHub Secrets/Variables** or the platform secret manager; never in code, logs, artifacts, or PR text. Mask values in workflow logs.
* Validate and sanitize all inputs; parameterize queries; enforce least privilege (Firebase rules, Android permissions requested only when needed, with rationale).
* HTTPS only; disable cleartext traffic; consider certificate pinning for sensitive APIs.
* Store tokens in secure storage (Keystore/Keychain), never in plain preferences or localStorage.
* Keep dependencies updated (Dependabot/Renovate), run `npm audit` / OSV scanning and CodeQL in CI; treat high/critical findings as blocking.
* Maintain Google Play compliance: Data Safety form, **public privacy policy and account-deletion pages (mandatory, see §19)**, in-app deletion flow, permissions justification, and ads/children declarations as applicable. Flag any change that affects them.

---

## 15. GITHUB SECRETS, VARIABLES, KEYS & API KEYS

### 15.1 Rules

* Secrets live **only** in GitHub Secrets (or the backend's secret manager). Never in the repo, logs, artifacts, PR text, issues, or chat.
* The **owner** creates keys and secrets (Appendix A/B). The agent only **checks that names exist** (`gh secret list`, `gh variable list`; values are never readable) and stops with the exact missing names if something is absent.
* The agent NEVER generates, replaces, rotates, or deletes the upload keystore or any production key by itself. If the upload key is lost: Play Console → upload-key reset, then update the secrets, `UPLOAD_CERT_SHA256`, and Firebase fingerprints.
* Commit `.env.example` (names only, no values). `.env*`, `*.jks`, `*.keystore`, `key.properties`, service-account JSON are git-ignored.
* Names are `UPPER_SNAKE_CASE`, prefixed by area: `ANDROID_`, `PLAY_`, `FIREBASE_`, `GOOGLE_`, `SITE_`.

### 15.2 Inventory

**Secrets** (GitHub → Settings → Secrets and variables → Actions → Secrets)

| Name | Purpose | Created by |
|---|---|---|
| `KEYSTORE_BASE64` | Upload keystore, Base64 | `bootstrap-secrets.sh` |
| `KEYSTORE_PASSWORD` | Keystore password | `bootstrap-secrets.sh` |
| `KEY_ALIAS` | Key alias (`upload`) | `bootstrap-secrets.sh` |
| `KEY_PASSWORD` | Key password | `bootstrap-secrets.sh` |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Play Developer API service account (JSON) | owner, Appendix A.3 |
| `GOOGLE_SERVICES_JSON_BASE64` | Firebase `google-services.json`, Base64 | `bootstrap-secrets.sh` / A.4 |
| `GOOGLESERVICE_INFO_PLIST_BASE64` | iOS Firebase config (only when iOS CI exists) | owner |
| `SENTRY_AUTH_TOKEN` (optional) | Source-map / symbol upload | owner |

**Variables** (non-sensitive; Settings → Secrets and variables → Actions → Variables)

| Name | Purpose |
|---|---|
| `ANDROID_PACKAGE_NAME` | Application ID (immutable once published) |
| `UPLOAD_CERT_SHA256` | Expected upload-certificate fingerprint, verified at every build |
| `PLAY_TRACK_RELEASE` | Track for tagged releases (default `internal`) |
| `PLAY_RELEASE_STATUS` | `draft` for the very first release, then empty |
| `PLAY_PUBLISH` | `false` to skip Play upload |
| `VERSION_CODE_OFFSET` | Offset added to `run_number` to build `versionCode` |
| `SITE_URL`, `SUPPORT_EMAIL` | Website URL and public contact (used by legal pages) |
| `NODE_VERSION`, `JAVA_VERSION`, `BUNDLETOOL_VERSION` | Tool versions |
| `GOOGLE_MAPS_API_KEY`, `FIREBASE_WEB_API_KEY`, `GOOGLE_OAUTH_WEB_CLIENT_ID` (as needed) | Restricted **client-side** keys (see 15.3) |

### 15.3 Classifying keys and API keys

| Class | Examples | Where it lives | Protection |
|---|---|---|---|
| **Secret** | keystore + passwords, Play service account, Firebase Admin SDK, server API keys, OAuth client **secrets**, webhook secrets, tokens | GitHub Secrets / backend secret manager (`firebase functions:secrets:set`) | Never in app, repo, or logs |
| **Public but restricted** | Firebase client config, Google Maps key, OAuth client IDs | GitHub Variables or injected at build | Restrict by Android package + SHA-1 (upload **and** Play signing keys) or by HTTP referrer = `SITE_URL`, limit to the needed APIs, enable Firebase **App Check** (Play Integrity) |

Anything shipped inside the app can be extracted. Therefore no secret may ever be compiled into the app: privileged calls go through a backend (Cloud Functions) that holds the secret.

### 15.4 Environments & repository protection

* Environments: `staging`, `production` (required reviewers), `github-pages`.
* Ruleset: tags `v*` cannot be deleted or moved; `main` requires the `quality` and `build-web` checks.
* Settings → Pages → Source: **GitHub Actions**.

### 15.5 Rotation & leaks

* Rotate server secrets and API keys at least yearly and on any suspicion. The upload keystore changes only through Play's reset process.
* On a leak: revoke at the provider first, rotate, update the secret, and (with owner approval) purge git history. Report it in the task summary.

---

## 16. ANDROID SIGNING & GOOGLE PLAY READINESS

Google Play requires an **AAB** for new apps and uses **Play App Signing**. The key in GitHub Secrets is the **upload key**; Google holds the app signing key.

Release rules:

* `release` build type MUST be signed (no debug signing, no unsigned artifact published). The Gradle signing config reads from environment/`key.properties` created **only in CI**.
* `applicationId` is stable and unique; `versionName` follows SemVer; **`versionCode` strictly increases** (derive in CI, e.g. `base + github.run_number`, or from the tag) and is never reused.
* `targetSdk` MUST meet Google Play's current requirement (verify against the official policy before each release cycle; do not rely on memory). `minSdk` is documented and justified.
* Provide 64-bit (arm64-v8a, x86_64) native libraries; AAB handles ABI splits.
* Release build: `isMinifyEnabled = true`, `isShrinkResources = true`, `debuggable = false`, `android:allowBackup` decision documented, cleartext disabled.
* App Bundle contains: native icon (adaptive + monochrome), splash, localized resources for `fr`, `en`, `ar` (declare `resourceConfigurations`/`localeFilters` accordingly).

Signing procedure in GitHub Actions:

1. Checkout, set up Java/Node/Gradle with caching.
2. Generate icon & splash assets (§10).
3. Decode `KEYSTORE_BASE64` to a **temporary** path (`$RUNNER_TEMP`), `chmod 600`.
4. Write temporary signing config; `::add-mask::` all secret values.
5. Build **AAB** (`bundleRelease`) and **APK** (`assembleRelease`).
6. **Verify signing**:
   * APK: `apksigner verify --verbose --print-certs app-release.apk`
   * AAB: `jarsigner -verify -verbose -certs app-release.aab`
   * Compare the certificate SHA-256 with `UPLOAD_CERT_SHA256`; fail on mismatch.
   * `bundletool validate --bundle=app-release.aab`; optionally generate and install a universal APK on an emulator for a smoke test.
7. Upload artifacts and, when configured, publish the AAB to the Play track.
8. **Always** (`if: always()`) delete the keystore and signing files, even on failure.

---

## 17. CI/CD

Workflows live in `.github/workflows/`. The reference implementation is **Appendix C** (`ci-release.yml`); keep the file identical to it. Requirements:

* Triggers: `pull_request` (checks only, **no secrets**), `push` to `main` (build + internal track), tag `v*.*.*` (official release), and `workflow_dispatch` (manual, with inputs for track and rollout %).
* Jobs (parallel where possible): `lint-typecheck` → `test` → `i18n-check` → `assets` → `build-web` → `build-android` → `verify` → `release` / `deploy`.
* Security hardening: `permissions:` minimal per job (default `contents: read`); pin third-party actions to a **commit SHA**; `concurrency` group to cancel superseded runs (but **never** cancel a running release); `timeout-minutes` on every job; cache Gradle/npm.
* **Compliance gates**: tag = `package.json` version; `CHANGELOG.md` section exists; README links; legal pages present in fr/en/ar with no placeholders and `dir="rtl"` for Arabic (§18, §19).
* Fail fast and loudly; upload logs, test reports, and `mapping.txt` as artifacts.
* Produce reproducible builds: lockfiles committed, `npm ci`, pinned Node/Java versions, Gradle wrapper.
* Optional quality gates: Lighthouse CI for web, Android Lint, Detekt/ktlint, unit + instrumented smoke tests on an emulator, size-budget check on AAB/APK.

---

## 18. VERSIONING & RELEASES

Every release is **versioned, traceable, and immutable**.

**Versioning (SemVer 2.0)**

* Format `MAJOR.MINOR.PATCH`; pre-releases use `-beta.N` / `-rc.N`.
* `package.json` `version` is the **single source of truth**. Android `versionName`, web build metadata, and the About screen derive from it. Android `versionCode` strictly increases and is never reused (§16).
* The bump is decided from Conventional Commits since the last tag: `feat!` / `BREAKING CHANGE` → MAJOR; `feat` → MINOR; `fix` / `perf` / `security` → PATCH; only `docs` / `chore` / `ci` / `refactor` / `test` → no release unless requested.
* Show app version + commit SHA in **Settings → About** and in the website footer.

**Release procedure**

1. Confirm CI is green on `main`.
2. Bump the version (`npm version <major|minor|patch> --no-git-tag-version`).
3. Update `CHANGELOG.md` (Keep a Changelog: Added / Changed / Fixed / Removed / Security, with date and compare link) and the localized Play notes `store/whatsnew/whatsnew-{fr-FR,en-US,ar}`.
4. Sync README, website, and legal pages (§19).
5. Commit `chore(release): vX.Y.Z`, push, wait for CI.
6. Create an **annotated** tag and push it: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`.
7. Verify the tag workflow end to end: GitHub Release, versioned artifacts, signature check, Play upload, Pages deploy.

**Immutability**

* NEVER move, delete, or reuse a tag or a published version. A bad release is fixed forward with a new PATCH and a halted rollout.
* If a tag workflow failed before publishing anything, re-run it. Do not retag.

**Artifacts (always versioned)**

```text
<app>-vX.Y.Z.apk
<app>-vX.Y.Z.aab
web-build-vX.Y.Z.zip
mapping.txt
SHA256SUMS.txt
```

* GitHub Release title: `vX.Y.Z`. Body: the CHANGELOG section for that version.
* Tags containing a hyphen (`v1.4.0-beta.1`) are GitHub *pre-releases* and go only to internal/alpha/beta Play tracks.

**Pipeline behavior**

* **Tag `vX.Y.Z`** → GitHub Release + Google Play upload + website deploy.
* **Push to `main`** → CI build, Play **internal** track, website deploy. No GitHub Release and no tag.
* CI **blocks** a release when: the tag differs from `package.json`; `CHANGELOG.md` has no section for that version; the README/legal-page checks of §19 fail.
* Promotion: `internal → alpha/beta → production`, staged rollout (5% → 20% → 50% → 100%), production approval through a GitHub Environment.
* Rollback: halt the rollout, re-promote the previous build, ship a hotfix PATCH. Document in `docs/RELEASE.md`.

After pushing, confirm: workflow green, versioned artifacts present, signature verified, Play upload accepted (or the exact error), Pages deployed, legal URLs return HTTP 200.

---

## 19. README, WEBSITE & MANDATORY LEGAL PAGES

### 19.1 README (always current)

`README.md` is part of the product. Update it in the **same commit** as any user-visible, setup, or release change. It MUST contain:

* name, one-line pitch, feature list, screenshots
* badges: CI status, latest release version, license
* supported platforms and languages (fr / en / ar)
* download links: Google Play, GitHub Releases, website
* quick start: install, dev scripts, tests, env variable **names** (never values)
* links to `docs/ARCHITECTURE.md`, `docs/RELEASE.md`, `CHANGELOG.md`
* links to the **Privacy Policy** (`/privacy/`) and **Delete Account** page (`/delete-account/`)
* contribution notes and license

SHOULD also keep `README.fr.md` and `README.ar.md` in sync (with language links at the top). Create them at bootstrap.

### 19.2 Website (GitHub Pages)

The Pages site is the project's public face and MUST stay in sync with the app:

* landing page: pitch, features, screenshots, Google Play badge, latest version, changelog link
* trilingual (fr / en / ar) with RTL, responsive, accessible, light/dark
* SEO: `<title>`, meta description, Open Graph, `hreflang`, `sitemap.xml`, `robots.txt`, custom 404
* footer links: Privacy, Delete account, Contact, version
* deployed only by CI, on every push to `main` and every tag

### 19.3 Privacy Policy & Account Deletion pages — ALWAYS REQUIRED

**Bootstrap rule.** On the first commit of a project, or whenever an audit finds that the Pages site lacks either page, the agent MUST create both **immediately and without asking permission**, before finishing any other work. Never ship an app, Play listing, or release without them.

Required URLs (static files, e.g. under `public/`, so they exist in the production build):

```text
/privacy/            /privacy/fr/          /privacy/en/          /privacy/ar/
/delete-account/     /delete-account/fr/   /delete-account/en/   /delete-account/ar/
```

The root pages (`/privacy/`, `/delete-account/`) are the URLs given to Google Play. They show a language selector (default from browser language) and link to the three versions. The Arabic versions use `lang="ar" dir="rtl"`.

**Google Play requirements for both pages**

* publicly reachable, no login, not a PDF, not geo-blocked, readable on mobile
* use the **same app and developer name** as the Play listing
* linked from: Play Console (privacy policy URL and Data safety → account deletion URL), app Settings, website footer, README

**Privacy Policy MUST cover**

* who we are (entity name, contact email)
* exactly which data is collected (account/auth data, device & FCM tokens, analytics, crash logs, local ObjectBox data, permissions) and why
* third parties and SDKs (Firebase, Google Sign-In, analytics, ads if any) and what they receive
* storage location, retention periods, security measures
* user rights (access, rectification, deletion, portability; GDPR where relevant)
* children's data statement, policy-change process, "last updated" date

**Delete Account page MUST cover**

* the app name and the steps: in-app (Settings → Account → Delete account, with re-authentication and confirmation) **and** a web request path for users who no longer have the app
* a **working** request channel: a form posting to a real backend endpoint (e.g. a Cloud Function with email verification) or a prefilled `mailto:` link. A static page cannot process a deletion by itself, so never ship a dead form
* what is deleted (auth user, profile/database records, uploaded files, FCM tokens, analytics identifiers, local data) and what is legally retained, with exact retention periods
* the time to complete deletion, confirmation by email, and an identity-verification step

**Accuracy rules**

* Audit the code before writing: auth providers, Firebase usage, analytics, permissions, SDKs, stored data. Never invent claims. Keep `docs/COMPLIANCE.md` as the data inventory and the source for the Play Data Safety answers.
* The deletion flow must really exist in the backend. If it does not, implement it or report the gap; do not publish a page promising something the system cannot do.
* If a fact is unknown (legal entity, contact email, retention period), ask the user **once** before pushing. Never publish placeholder or fabricated contact details.
* Any change that adds data collection, a permission, an SDK, or a login provider MUST update the privacy page, `docs/COMPLIANCE.md`, and the README in the same commit.
* Provide a note in the final report that the legal texts should be reviewed by the owner or a lawyer (the agent is not a legal advisor).

### 19.4 CI enforcement

CI fails when: a legal page is missing in any language; placeholders remain (`TODO`, `REPLACE_ME`, `CHANGE_ME`, `your-email|example\.(com|org)|\{\{`); the Arabic pages lack `dir="rtl"`; the README lacks the privacy/delete-account links; or the deployed URLs do not return HTTP 200.

---

## 20. TESTING

* Unit tests for logic, i18n helpers, and data layer; component tests for critical UI states (loading/empty/error/offline).
* Include **RTL and long-text snapshots** (ar, fr) for key screens.
* Add a regression test for every bug fixed when feasible.
* Smoke test the release artifact (install + launch) in CI on an emulator when available.
* Do not skip or delete failing tests to pass CI.

---

## 21. DOCUMENTATION

Keep current: `README.md` + `README.fr.md` + `README.ar.md` (§19.1), `docs/COMPLIANCE.md` (data inventory, Play Data Safety answers, permissions), `docs/ARCHITECTURE.md`, `docs/RELEASE.md` (signing, secrets, Play process), `docs/I18N.md` (adding a language/key, RTL rules), `docs/BRANDING.md` (asset specs), and `CHANGELOG.md`. Update docs in the same commit as the behavior change. Never document secrets' values.

---

## 22. AGENT BEHAVIOR

* Read before writing: inspect the repo, scripts, CI, and conventions first. Prefer existing patterns.
* When requirements are ambiguous and the cost of being wrong is high (signing, IDs, data migration, destructive actions), ask **one** concise question; otherwise decide, proceed, and state the assumption.
* Work in small verified steps; run lint/tests after each meaningful change.
* Never leave the repository broken, half-migrated, or with debug code.
* Be honest in reports: separate **verified** from **assumed**; list known limitations and follow-ups.
* Marketing/Growth work (ASO, store listing, landing page, analytics events) only when requested; keep it consistent across `fr`, `en`, `ar` and compliant with store policies.

---

## 23. PRE-MERGE CHECKLIST

```text
[ ] Lint, typecheck, tests pass
[ ] i18n parity fr/en/ar OK, no hardcoded strings
[ ] Verified on phone, tablet, desktop web, portrait/landscape, light/dark, LTR/RTL, 200% font scale
[ ] Loading/empty/error/offline states handled
[ ] No secrets in diff; dependencies justified
[ ] Icon/splash source assets valid; generation passes in CI
[ ] SemVer bump correct; package.json, CHANGELOG, Play notes (fr/en/ar) updated; tag immutable
[ ] README (+ fr/ar) and website updated for this change
[ ] /privacy/ and /delete-account/ exist in fr/en/ar, accurate, no placeholders, linked from app, site, README, Play
[ ] Deletion flow really works (in-app + web request) and docs/COMPLIANCE.md is current
[ ] E2E matrix (device × fr/en/ar, RTL, light/dark) green; Lighthouse budgets met
[ ] Health score refreshed in docs/HEALTH.md
[ ] Docs updated
[ ] Conventional commit pushed; CI green; artifacts + signature verified
```

---

## 24. AUTOPILOT PROTOCOL

### 24.1 First-run bootstrap audit
On a new repository (or the first time the agent works on it) run this audit and **create whatever is missing**, in this order:

```text
1. .gitignore, .env.example, LICENSE, CHANGELOG.md
2. README.md (+ README.fr.md, README.ar.md)                        §19.1
3. Website landing + /privacy/ + /delete-account/ in fr/en/ar     §19.3
4. i18n files + `i18n:check` script, RTL support                   §9
5. Branding assets + `assets:generate` script                      §10
6. scripts/bootstrap-secrets.sh                                    Appendix B
7. .github/workflows/ci-release.yml                                Appendix C
8. .github/workflows/quality-advanced.yml, dependabot.yml          Appendix E, F
9. docs/ARCHITECTURE.md, RELEASE.md, I18N.md, BRANDING.md, COMPLIANCE.md, HEALTH.md
10. Gradle signing/versioning config                               Appendix D
```

Then tell the owner which owner-only steps remain (Appendix A) with the exact missing secret/variable names.

### 24.2 Task loop

```text
understand → plan (≤ 7 bullets) → smallest coherent change → self-review the diff against §23
→ verify (lint, types, tests, e2e) → commit → push → watch CI → fix → report
```

* Fix CI failures autonomously, up to **3 attempts per distinct failure**. Then stop and report the logs and a diagnosis. Never weaken checks to get green.
* Prefer reversible changes; never mix unrelated work in one commit.

### 24.3 Stop-and-ask conditions
Ask the owner (one concise question) before: changing `applicationId` or signing; deleting or migrating user data; adding paid services; unknown legal facts (entity, contact, retention); force-push or history rewrite; removing a feature users may rely on.

### 24.4 Health scorecard (`docs/HEALTH.md`)
Score /100, refreshed after every significant task. Never lower it without stating why.

| Area | Pts | Evidence |
|---|---|---|
| Security & secrets | 20 | no leaks, audit clean, CodeQL, restricted keys |
| CI/CD & releases | 20 | signed AAB/APK verified, SemVer, provenance, Play upload |
| Compliance (Play + legal) | 15 | privacy + deletion pages live, Data Safety, in-app deletion |
| i18n + RTL | 10 | fr/en/ar parity, RTL e2e green |
| Responsive + accessibility | 10 | device matrix green, WCAG 2.2 AA checks |
| Performance | 10 | Lighthouse and size budgets |
| Tests | 10 | unit + e2e coverage of critical flows |
| Documentation | 5 | README, docs, changelog current |

### 24.5 Report format and proactive suggestions
Every final report: **Done · Verified (with the run link) · Not verified · Risks · Score · Next 3 suggestions** ranked by impact/effort.

---

## 25. ADVANCED QUALITY & SUPPLY CHAIN

* **E2E matrix** (Appendix E): `phone / tablet / desktop` × `fr / en / ar` (Arabic in RTL), light + dark, with visual-regression snapshots and automated accessibility checks (axe). A layout break in any cell blocks the merge.
* **Lighthouse CI** with budgets in `lighthouserc.json` (performance ≥ 90, accessibility ≥ 95, best-practices ≥ 95, SEO ≥ 90).
* **CodeQL** on PRs and weekly; **Dependabot** weekly (Appendix F); high/critical findings block.
* **Provenance attestations** for every release artifact (APK, AAB, web zip) through Sigstore; consumers can verify with `gh attestation verify`.
* **Localized store screenshots** generated automatically on each tag for `fr-FR`, `en-US`, `ar` (phone + tablet) and uploaded as artifacts to `store/screenshots/<locale>/`. Never hand-made, so the store always matches the app.
* SHOULD produce an SBOM (CycloneDX) per release and attach it.
* Play **pre-launch report** warnings (crashes, accessibility, security) are treated as bugs.

---

## 26. POST-RELEASE MONITORING & ROLLBACK

* Promote a staged rollout to the next step only after **24–48 h** of healthy metrics. Default halt thresholds (tune per app): crash-free users < 99%, ANR rate > 0.4%, or a spike in new Crashlytics issues. If the agent cannot read the metrics, it asks the owner to confirm before promoting.
* Risky features ship behind **Firebase Remote Config** flags with a kill switch. A minimum-supported-version value allows forcing an update (in-app updates API) after a critical fix.
* Rollback = halt rollout → re-promote the previous build → hotfix PATCH (§18). Tags are never deleted.
* Upload `mapping.txt` and native symbols for every release so crashes are readable.
* After each release, record the outcome (rollout %, crash-free rate, issues) in `docs/RELEASE.md`.

---

# APPENDIX A — OWNER BOOTSTRAP: KEYS, SECRETS, VARIABLES, PLAY & FIREBASE

Performed **once by the project owner** (not by the agent). The agent points the owner to this appendix whenever the preflight step or `gh secret list` shows something missing.

**A.1 Prerequisites**: `gh` CLI authenticated (`gh auth login`), a JDK (`keytool`), `openssl`, and the repo cloned.

**A.2 Upload keystore + GitHub secrets/variables/environments**

```bash
bash scripts/bootstrap-secrets.sh        # Appendix B
```

It generates the upload keystore **outside the repo** (`~/.keystores/<package>/`), stores the passwords in a `chmod 600` file next to it, uploads `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` to GitHub Secrets without ever printing them, sets the variables, creates the environments, and prints the **SHA-1 / SHA-256** fingerprints (public values) for Firebase and `UPLOAD_CERT_SHA256`.
Then immediately back up the keystore and its credentials file in **two offline locations** (password manager + encrypted drive) and delete the local plaintext credentials file.

**A.3 Google Play Console**

1. Create the app with a package name equal to `ANDROID_PACKAGE_NAME`. Keep **Play App Signing** enabled (default); our keystore is only the *upload* key.
2. Complete the store listing (fr-FR, en-US, ar), privacy policy URL (`SITE_URL/privacy/`), Data safety form, and **account deletion URL** (`SITE_URL/delete-account/`).
3. Google Cloud Console → enable **Google Play Android Developer API** → IAM → Service accounts → create → Keys → add key (JSON).
4. Play Console → Users and permissions → invite the service-account email with: *Release apps to testing tracks*, *Release to production* (when ready), *Manage store presence*. Permissions can take a few hours to propagate.
5. Store the JSON, then delete the local file:
   ```bash
   gh secret set PLAY_SERVICE_ACCOUNT_JSON < play-service-account.json && shred -u play-service-account.json
   ```
6. The **first** AAB of a new app must reach Play once: set variable `PLAY_RELEASE_STATUS=draft`, run the workflow (`workflow_dispatch`, track `internal`), then clear the variable.

**A.4 Firebase**

1. Add the Android app with the same package name. Register the **SHA-1 and SHA-256 of the upload key** (printed by the script) **and**, after the first upload, of the **Play app signing key** (Play Console → Test and release → App integrity). Google Sign-In and phone auth fail in production without the Play signing fingerprint.
2. Download `google-services.json` and let the script (or `base64 < google-services.json | tr -d '\n' | gh secret set GOOGLE_SERVICES_JSON_BASE64`) store it.
3. Enable the needed Auth providers, **App Check** (Play Integrity), FCM, and deploy Firestore/Storage rules.
4. Server-side secrets for Cloud Functions (including the account-deletion function): `firebase functions:secrets:set NAME`. Never in the repo.

**A.5 Google Cloud API keys**: restrict every client key by Android app (package + both SHA-1) or by referrer (`SITE_URL`), and by API. Store client keys as GitHub Variables; server keys only in the backend secret manager.

**A.6 Repository settings**: Pages source = GitHub Actions; environments `staging`, `production` (add required reviewers; private repos need a paid plan for this); tag ruleset `v*`; branch protection on `main`.

**A.7 Verify**

```bash
gh secret list && gh variable list     # names only
gh workflow run "CI / Release" -f track=internal
gh run watch
```

The logs must show matching APK/AAB certificate fingerprints and a successful bundle validation.

**A.8 Recovery**: lost upload key → Play Console upload-key reset (Play support), generate a new keystore with the script, update the four keystore secrets, `UPLOAD_CERT_SHA256`, and the Firebase fingerprints.

---

# APPENDIX B — `scripts/bootstrap-secrets.sh`

Committed to the repo (contains no secrets). Run by the owner only.

```bash
#!/usr/bin/env bash
# One-time owner bootstrap: upload keystore + GitHub secrets/variables/environments.
# Never prints secrets. Never writes inside the repo.
set -euo pipefail

for bin in gh keytool openssl base64; do
  command -v "$bin" >/dev/null || { echo "Missing tool: $bin"; exit 1; }
done
gh auth status >/dev/null || { echo "Run: gh auth login"; exit 1; }

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo "Repository: $REPO"

read -rp "Android package name (e.g. com.acme.app): " APP_ID
read -rp "Site URL (e.g. https://acme.github.io/app): " SITE_URL
read -rp "Public support email: " SUPPORT_EMAIL
read -rp "Developer / organization name (certificate O=): " ORG
read -rp "Country code (certificate C=, e.g. FR): " CC

KS_DIR="$HOME/.keystores/$APP_ID"
KS="$KS_DIR/upload-keystore.jks"
CREDS="$KS_DIR/credentials.txt"
ALIAS="upload"
mkdir -p "$KS_DIR" && chmod 700 "$KS_DIR"

if [[ -f "$KS" ]]; then
  echo "Keystore already exists at $KS — reusing it."
  [[ -f "$CREDS" ]] || { echo "credentials.txt missing; cannot continue safely."; exit 1; }
  PASS="$(grep '^KEYSTORE_PASSWORD=' "$CREDS" | cut -d= -f2-)"
else
  PASS="$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-24)"
  keytool -genkeypair -v -storetype PKCS12 \
    -keystore "$KS" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" \
    -dname "CN=$ORG, OU=Mobile, O=$ORG, C=$CC" >/dev/null
  chmod 600 "$KS"
  umask 177
  { echo "KEYSTORE_PASSWORD=$PASS"; echo "KEY_ALIAS=$ALIAS"; echo "KEY_PASSWORD=$PASS"; } > "$CREDS"
  echo "Keystore created: $KS"
fi

SHA256="$(keytool -list -v -keystore "$KS" -alias "$ALIAS" -storepass "$PASS" | grep -m1 'SHA256:' | awk '{print $2}')"
SHA1="$(keytool -list -v -keystore "$KS" -alias "$ALIAS" -storepass "$PASS" | grep -m1 'SHA1:' | awk '{print $2}')"

echo "Uploading secrets (values are never printed)…"
base64 < "$KS" | tr -d '\n' | gh secret set KEYSTORE_BASE64
printf '%s' "$PASS"  | gh secret set KEYSTORE_PASSWORD
printf '%s' "$ALIAS" | gh secret set KEY_ALIAS
printf '%s' "$PASS"  | gh secret set KEY_PASSWORD

read -rp "Path to google-services.json (Enter to skip): " GS
if [[ -n "${GS:-}" && -f "$GS" ]]; then
  base64 < "$GS" | tr -d '\n' | gh secret set GOOGLE_SERVICES_JSON_BASE64
fi
read -rp "Path to Play service-account JSON (Enter to skip): " SA
if [[ -n "${SA:-}" && -f "$SA" ]]; then
  gh secret set PLAY_SERVICE_ACCOUNT_JSON < "$SA"
  echo "Delete the local JSON now: shred -u \"$SA\""
fi

echo "Setting variables…"
gh variable set ANDROID_PACKAGE_NAME --body "$APP_ID"
gh variable set UPLOAD_CERT_SHA256   --body "$SHA256"
gh variable set SITE_URL             --body "$SITE_URL"
gh variable set SUPPORT_EMAIL        --body "$SUPPORT_EMAIL"
gh variable set PLAY_TRACK_RELEASE   --body "internal"
gh variable set VERSION_CODE_OFFSET  --body "0"
gh variable set PLAY_RELEASE_STATUS  --body "draft"   # clear after the first Play upload

echo "Creating environments…"
UID_="$(gh api user -q .id)"
gh api -X PUT "repos/$REPO/environments/staging" >/dev/null
echo "{\"reviewers\":[{\"type\":\"User\",\"id\":$UID_}]}" \
  | gh api -X PUT "repos/$REPO/environments/production" --input - >/dev/null || \
  echo "Could not add reviewers to 'production' (private repo on a free plan?). Add them manually."
gh api -X PUT "repos/$REPO/environments/github-pages" >/dev/null || true

echo
echo "Done. Public fingerprints (for Firebase → Android app → SHA certificate fingerprints):"
echo "  SHA-1  : $SHA1"
echo "  SHA-256: $SHA256"
echo
echo "NEXT: back up $KS_DIR in two offline places, then delete $CREDS."
gh secret list
```

---

# APPENDIX C — `.github/workflows/ci-release.yml`

Reference implementation (quality gates, compliance gates, signed APK/AAB, verification, Play upload, versioned GitHub Release, Pages deploy + legal-page smoke checks).

```yaml
name: CI / Release

# Assumed stack: Capacitor (web + android/ folder), Node, Gradle.
# Required npm scripts: lint, typecheck, test, i18n:check, assets:generate, build
# Static site sources live in public/ (copied to dist/): privacy/ and delete-account/, each with fr/ en/ ar/ sub-pages.
# Pin every third-party action to a commit SHA (use Renovate or `pinact` to automate).

on:
  pull_request:
  push:
    branches: [main]
    tags: ['v*.*.*']
  workflow_dispatch:
    inputs:
      track:
        description: Google Play track
        type: choice
        default: internal
        options: [internal, alpha, beta, production]
      rollout:
        description: Production staged rollout fraction (0.01-1.0)
        type: string
        default: '0.05'

# Least privilege by default; jobs elevate only what they need.
permissions:
  contents: read

# Cancel superseded PR runs only. Never cancel a branch/tag run (could kill a release).
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

env:
  NODE_VERSION: ${{ vars.NODE_VERSION || '22' }}
  JAVA_VERSION: ${{ vars.JAVA_VERSION || '21' }}
  ANDROID_DIR: android
  BUNDLETOOL_VERSION: ${{ vars.BUNDLETOOL_VERSION || '1.18.1' }}

jobs:
  # ───────────────────────────── 1. Quality gates ─────────────────────────────
  quality:
    name: Lint · Types · Tests · i18n
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4

      - name: Guard — no credentials tracked in git
        run: |
          if git ls-files | grep -Ei '\.(jks|keystore|p12|pem)$|(^|/)key\.properties$|(^|/)\.env($|\.)|service[-_]account.*\.json$'; then
            echo "::error::Sensitive file tracked in git. Remove it and rotate the secret."
            exit 1
          fi

      - name: Compliance — README, CHANGELOG, legal pages (AGENTS.md §19)
        run: |
          set -u
          fail() { echo "::error::$1"; exit 1; }
          for f in README.md CHANGELOG.md; do [[ -f "$f" ]] || fail "$f is missing"; done
          for p in privacy delete-account; do
            for l in "" fr/ en/ ar/; do
              [[ -f "public/$p/${l}index.html" ]] || fail "Missing public/$p/${l}index.html — create it (AGENTS.md §19.3)"
            done
            grep -q 'dir="rtl"' "public/$p/ar/index.html" || fail "public/$p/ar/index.html must declare dir=\"rtl\""
          done
          grep -qi 'privacy' README.md        || fail "README.md must link the Privacy Policy"
          grep -qi 'delete-account' README.md || fail "README.md must link the Delete Account page"
          if grep -rEn 'TODO|REPLACE_ME|CHANGE_ME|your-email|example\.(com|org)|\{\{' public/privacy public/delete-account; then
            fail "Placeholders remain in legal pages"
          fi

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test --if-present
      - name: i18n parity (fr / en / ar)
        run: npm run i18n:check
      - name: Dependency audit (high+)
        run: npm audit --audit-level=high

  # ───────────────────────────── 2. Web build ─────────────────────────────────
  build-web:
    name: Build web
    needs: quality
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - name: Generate icons & splash (web/PWA)
        run: npm run assets:generate
      - name: Production web build
        run: npm run build
        # Set the base path here if Pages is served from /<repo>/ (e.g. VITE_BASE: /${{ github.event.repository.name }}/)
      - name: Verify legal pages exist in the build output
        run: |
          for p in privacy delete-account; do
            for l in "" fr/ en/ ar/; do
              [[ -f "dist/$p/${l}index.html" ]] || { echo "::error::dist/$p/${l}index.html missing from production build"; exit 1; }
            done
          done
      - name: Zip build
        run: cd dist && zip -qr ../web-build.zip .
      - uses: actions/upload-artifact@v4
        with:
          name: web-build
          path: web-build.zip
          retention-days: 30
      - name: Prepare Pages artifact
        if: github.event_name != 'pull_request'
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  # ───────────────────────────── 3. Android signed build ──────────────────────
  build-android:
    name: Build & sign Android (APK + AAB)
    needs: quality
    # No secrets on pull requests (and never on forks).
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 40
    outputs:
      version-name: ${{ steps.meta.outputs.version_name }}
      version-code: ${{ steps.meta.outputs.version_code }}
      track: ${{ steps.meta.outputs.track }}
    steps:
      - uses: actions/checkout@v4

      - name: Preflight — required secrets & variables
        env:
          KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
          ANDROID_PACKAGE_NAME: ${{ vars.ANDROID_PACKAGE_NAME }}
        run: |
          missing=()
          for n in KEYSTORE_BASE64 KEYSTORE_PASSWORD KEY_ALIAS KEY_PASSWORD ANDROID_PACKAGE_NAME; do
            [[ -n "${!n:-}" ]] || missing+=("$n")
          done
          if (( ${#missing[@]} )); then
            echo "::error::Missing secrets/variables: ${missing[*]} — run scripts/bootstrap-secrets.sh (AGENTS.md, Appendix A/B)"
            exit 1
          fi

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: ${{ env.JAVA_VERSION }}

      - uses: gradle/actions/setup-gradle@v4

      - name: Compute version & track
        id: meta
        run: |
          PKG_VERSION="$(node -p "require('./package.json').version")"
          if [[ "${GITHUB_REF}" == refs/tags/v* ]]; then
            VERSION_NAME="${GITHUB_REF_NAME#v}"
            [[ "$VERSION_NAME" == "$PKG_VERSION" ]] \
              || { echo "::error::Tag v$VERSION_NAME does not match package.json version $PKG_VERSION"; exit 1; }
            grep -Eq "^## \[?${VERSION_NAME}\]?" CHANGELOG.md \
              || { echo "::error::CHANGELOG.md has no section for $VERSION_NAME"; exit 1; }
          else
            VERSION_NAME="$PKG_VERSION"
          fi
          # versionCode MUST strictly increase and never be reused on Google Play.
          VERSION_CODE=$(( ${{ github.run_number }} + ${{ vars.VERSION_CODE_OFFSET || 0 }} ))

          TRACK="${{ inputs.track }}"
          if [[ -z "$TRACK" ]]; then
            if [[ "${GITHUB_REF}" == refs/tags/v* ]]; then TRACK="${{ vars.PLAY_TRACK_RELEASE || 'internal' }}"; else TRACK="internal"; fi
          fi

          echo "version_name=$VERSION_NAME" >> "$GITHUB_OUTPUT"
          echo "version_code=$VERSION_CODE" >> "$GITHUB_OUTPUT"
          echo "track=$TRACK"               >> "$GITHUB_OUTPUT"
          echo "Version: $VERSION_NAME ($VERSION_CODE) → track: $TRACK"

      - run: npm ci

      - name: Generate native icon & splash
        run: npm run assets:generate

      - name: Verify generated native assets
        run: |
          set -e
          test -f "$ANDROID_DIR/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml" \
            || { echo "::error::Adaptive launcher icon missing"; exit 1; }
          ls "$ANDROID_DIR"/app/src/main/res/drawable*/splash* >/dev/null 2>&1 \
            || { echo "::error::Splash resources missing"; exit 1; }
          for f in assets/branding/icon-source.png assets/branding/splash.png; do
            test -f "$f" || { echo "::error::Missing source asset $f"; exit 1; }
          done

      - name: Build web & sync native project
        run: |
          npm run build
          npx cap sync android

      - name: Restore google-services.json (if provided)
        env:
          GOOGLE_SERVICES_JSON_BASE64: ${{ secrets.GOOGLE_SERVICES_JSON_BASE64 }}
        run: |
          if [[ -n "$GOOGLE_SERVICES_JSON_BASE64" ]]; then
            echo "$GOOGLE_SERVICES_JSON_BASE64" | base64 -d > "$ANDROID_DIR/app/google-services.json"
          fi

      - name: Reconstruct upload keystore (temporary)
        env:
          KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
        run: |
          set -euo pipefail
          [[ -n "$KEYSTORE_BASE64" ]] || { echo "::error::KEYSTORE_BASE64 secret is missing"; exit 1; }
          KS="$RUNNER_TEMP/upload-keystore.jks"
          echo "$KEYSTORE_BASE64" | base64 -d > "$KS"
          chmod 600 "$KS"
          echo "KEYSTORE_PATH=$KS" >> "$GITHUB_ENV"

      - name: Build signed AAB + APK
        env:
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        working-directory: ${{ env.ANDROID_DIR }}
        run: |
          chmod +x gradlew
          ./gradlew --no-daemon clean bundleRelease assembleRelease \
            -PversionName="${{ steps.meta.outputs.version_name }}" \
            -PversionCode="${{ steps.meta.outputs.version_code }}"

      - name: Collect artifacts
        run: |
          set -euo pipefail
          mkdir -p dist-android
          OUT="$ANDROID_DIR/app/build/outputs"
          cp "$OUT"/bundle/release/app-release.aab dist-android/app-release.aab
          cp "$OUT"/apk/release/app-release.apk    dist-android/app-release.apk
          MAP="$OUT/mapping/release/mapping.txt"
          [[ -f "$MAP" ]] && cp "$MAP" dist-android/mapping.txt || echo "::warning::No R8 mapping.txt found (is minify enabled?)"

      - name: Verify signatures & bundle
        env:
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          EXPECTED_SHA256: ${{ vars.UPLOAD_CERT_SHA256 }}
        run: |
          set -euo pipefail
          norm() { tr -d ':' | tr '[:upper:]' '[:lower:]'; }

          BT="$ANDROID_HOME/build-tools/$(ls "$ANDROID_HOME/build-tools" | sort -V | tail -1)"

          echo "── APK signature"
          "$BT/apksigner" verify --verbose --print-certs dist-android/app-release.apk | tee apk-cert.txt
          APK_SHA=$(grep -m1 'certificate SHA-256 digest' apk-cert.txt | awk '{print $NF}' | norm)

          echo "── AAB signature"
          jarsigner -verify -certs dist-android/app-release.aab | tail -n 5
          AAB_SHA=$(keytool -printcert -jarfile dist-android/app-release.aab | grep -m1 'SHA256:' | awk '{print $2}' | norm)

          echo "APK cert SHA-256: $APK_SHA"
          echo "AAB cert SHA-256: $AAB_SHA"
          [[ "$APK_SHA" == "$AAB_SHA" ]] || { echo "::error::APK and AAB signed with different certificates"; exit 1; }

          if [[ -n "${EXPECTED_SHA256:-}" ]]; then
            EXP=$(echo "$EXPECTED_SHA256" | norm)
            [[ "$AAB_SHA" == "$EXP" ]] || { echo "::error::Signing certificate does not match UPLOAD_CERT_SHA256"; exit 1; }
          else
            echo "::warning::UPLOAD_CERT_SHA256 variable not set — fingerprint not enforced"
          fi

          echo "── bundletool validate"
          curl -fsSL -o bundletool.jar \
            "https://github.com/google/bundletool/releases/download/${BUNDLETOOL_VERSION}/bundletool-all-${BUNDLETOOL_VERSION}.jar"
          java -jar bundletool.jar validate --bundle=dist-android/app-release.aab

      - name: Checksums
        run: cd dist-android && sha256sum app-release.apk app-release.aab > SHA256SUMS.txt

      - uses: actions/upload-artifact@v4
        with:
          name: android-release
          path: dist-android/
          retention-days: 30
          if-no-files-found: error

      # Always remove sensitive material, even on failure.
      - name: Cleanup sensitive files
        if: always()
        run: |
          rm -f "${KEYSTORE_PATH:-/dev/null}" \
                "$ANDROID_DIR/app/google-services.json" \
                "$ANDROID_DIR/key.properties" 2>/dev/null || true

  # ───────────────────────────── 4. Google Play upload ────────────────────────
  play-upload:
    name: Upload to Google Play
    needs: build-android
    if: github.event_name != 'pull_request' && vars.PLAY_PUBLISH != 'false'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    # Production promotion requires a manual approval configured on the "production" Environment.
    environment: ${{ needs.build-android.outputs.track == 'production' && 'production' || 'staging' }}
    steps:
      - uses: actions/checkout@v4   # for store/whatsnew release notes

      - uses: actions/download-artifact@v4
        with:
          name: android-release
          path: dist-android

      - name: Preflight — Play service account
        env:
          PLAY_SA: ${{ secrets.PLAY_SERVICE_ACCOUNT_JSON }}
        run: |
          [[ -n "$PLAY_SA" ]] || { echo "::error::PLAY_SERVICE_ACCOUNT_JSON is missing (AGENTS.md, Appendix A.3). Set vars.PLAY_PUBLISH=false to skip uploads."; exit 1; }

      - name: Upload AAB
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_SERVICE_ACCOUNT_JSON }}
          packageName: ${{ vars.ANDROID_PACKAGE_NAME }}
          releaseFiles: dist-android/app-release.aab
          track: ${{ needs.build-android.outputs.track }}
          # First-ever release of a new app must be "draft"; set PLAY_RELEASE_STATUS=draft until then.
          status: ${{ vars.PLAY_RELEASE_STATUS || (needs.build-android.outputs.track == 'production' && 'inProgress' || 'completed') }}
          userFraction: ${{ needs.build-android.outputs.track == 'production' && (inputs.rollout || '0.05') || '' }}
          mappingFile: dist-android/mapping.txt
          # Files named whatsnew-fr-FR, whatsnew-en-US, whatsnew-ar (≤ 500 chars each)
          whatsNewDirectory: store/whatsnew

  # ───────────────────────────── 5. GitHub Release (tags only) ────────────────
  github-release:
    name: Publish GitHub Release
    needs: [build-android, build-web]
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write
      id-token: write       # build provenance (Sigstore)
      attestations: write
    steps:
      - uses: actions/checkout@v4   # for CHANGELOG.md

      - uses: actions/download-artifact@v4
        with:
          name: android-release
          path: release
      - uses: actions/download-artifact@v4
        with:
          name: web-build
          path: release

      - name: Version artifact names & release notes
        run: |
          set -euo pipefail
          TAG="${GITHUB_REF_NAME}"; VER="${TAG#v}"; APP="${{ github.event.repository.name }}"
          cd release
          mv app-release.apk "${APP}-${TAG}.apk"
          mv app-release.aab "${APP}-${TAG}.aab"
          mv web-build.zip   "web-build-${TAG}.zip"
          sha256sum "${APP}-${TAG}.apk" "${APP}-${TAG}.aab" "web-build-${TAG}.zip" > SHA256SUMS.txt
          cd ..
          # Release body = CHANGELOG section of this exact version
          awk -v v="$VER" '
            $0 ~ "^## \\[?" v "\\]?" {f=1; next}
            /^## / && f {exit}
            f {print}' CHANGELOG.md > release-notes.md
          [[ -s release-notes.md ]] || { echo "::error::Empty CHANGELOG section for $VER"; exit 1; }

      - name: Attest build provenance (supply chain)
        uses: actions/attest-build-provenance@v2
        with:
          subject-path: |
            release/*.apk
            release/*.aab
            release/web-build-*.zip

      - uses: softprops/action-gh-release@v2
        with:
          name: ${{ github.ref_name }}
          body_path: release-notes.md
          generate_release_notes: true
          prerelease: ${{ contains(github.ref_name, '-') }}
          make_latest: ${{ !contains(github.ref_name, '-') }}
          fail_on_unmatched_files: true
          files: |
            release/*.apk
            release/*.aab
            release/web-build-*.zip
            release/mapping.txt
            release/SHA256SUMS.txt

  # ───────────────────────────── 6. GitHub Pages (tags only) ──────────────────
  deploy-pages:
    name: Deploy website to GitHub Pages
    needs: build-web
    # Website (incl. privacy & delete-account pages) is redeployed on every push to main and every tag.
    # Allow main AND v* tags in Settings → Environments → github-pages → deployment branches/tags.
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4

      - name: Smoke check site + legal pages
        run: |
          BASE="${{ steps.deployment.outputs.page_url }}"; BASE="${BASE%/}/"
          for path in "" privacy/ privacy/fr/ privacy/en/ privacy/ar/ delete-account/ delete-account/fr/ delete-account/en/ delete-account/ar/; do
            ok=0
            for i in 1 2 3 4 5 6; do
              code=$(curl -s -o /dev/null -w '%{http_code}' "${BASE}${path}")
              [[ "$code" == "200" ]] && { ok=1; break; }
              sleep 10
            done
            [[ "$ok" == "1" ]] || { echo "::error::${BASE}${path} did not return HTTP 200"; exit 1; }
            echo "OK ${BASE}${path}"
          done
```

---

# APPENDIX D — Android Gradle signing & versioning (`android/app/build.gradle`)

```groovy
android {
  defaultConfig {
    versionCode (project.findProperty("versionCode") ?: "1").toInteger()
    versionName (project.findProperty("versionName") ?: "0.0.1")
    resConfigs "fr", "en", "ar"
  }
  signingConfigs {
    release {
      if (System.getenv("KEYSTORE_PATH")) {
        storeFile     file(System.getenv("KEYSTORE_PATH"))
        storePassword System.getenv("KEYSTORE_PASSWORD")
        keyAlias      System.getenv("KEY_ALIAS")
        keyPassword   System.getenv("KEY_PASSWORD")
      }
    }
  }
  buildTypes {
    release {
      minifyEnabled true
      shrinkResources true
      debuggable false
      signingConfig signingConfigs.release          // never signingConfigs.debug
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
}

// Fail instead of silently producing an unsigned release artifact.
gradle.taskGraph.whenReady { graph ->
  if (graph.allTasks.any { it.name.toLowerCase().contains("release") && (it.name.startsWith("assemble") || it.name.startsWith("bundle")) }
      && !System.getenv("KEYSTORE_PATH")) {
    throw new GradleException("Release build requires CI signing (KEYSTORE_PATH). Local release builds are forbidden.")
  }
}
```

---

# APPENDIX E — `.github/workflows/quality-advanced.yml`

```yaml
name: Advanced Quality

# E2E device x language matrix (incl. RTL), Lighthouse budgets, CodeQL, store screenshots.
# Assumes: playwright.config.ts with projects phone / tablet / desktop, tests in e2e/,
# env E2E_LOCALE (fr|en|ar) read by the app/tests, lighthouserc.json with budgets,
# npm scripts: build, screenshots.

on:
  pull_request:
  push:
    branches: [main]
    tags: ['v*.*.*']
  schedule:
    - cron: '0 4 * * 1'      # weekly deep scan (CodeQL)
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: adv-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

env:
  NODE_VERSION: ${{ vars.NODE_VERSION || '22' }}

jobs:
  e2e:
    name: E2E ${{ matrix.device }} · ${{ matrix.locale }}
    runs-on: ubuntu-latest
    timeout-minutes: 25
    strategy:
      fail-fast: false
      matrix:
        device: [phone, tablet, desktop]
        locale: [fr, en, ar]          # ar runs in RTL
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps
      - name: Run E2E (light + dark, visual + accessibility checks inside the tests)
        env:
          E2E_LOCALE: ${{ matrix.locale }}
        run: npx playwright test --project=${{ matrix.device }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-report-${{ matrix.device }}-${{ matrix.locale }}
          path: |
            playwright-report/
            test-results/
          retention-days: 14

  lighthouse:
    name: Lighthouse budgets
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: treosh/lighthouse-ci-action@v12
        with:
          configPath: ./lighthouserc.json
          uploadArtifacts: true

  codeql:
    name: CodeQL
    runs-on: ubuntu-latest
    timeout-minutes: 30
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3

  store-screenshots:
    name: Localized store screenshots
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    timeout-minutes: 25
    strategy:
      matrix:
        locale: [fr, en, ar]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Capture phone + tablet screenshots
        env:
          E2E_LOCALE: ${{ matrix.locale }}
        run: npm run screenshots        # writes store/screenshots/${E2E_LOCALE}/{phone,tablet}/*.png
      - uses: actions/upload-artifact@v4
        with:
          name: store-screenshots-${{ matrix.locale }}
          path: store/screenshots/${{ matrix.locale }}/
          retention-days: 90
```

---

# APPENDIX F — `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: { interval: weekly }
    groups:
      minor-and-patch:
        update-types: [minor, patch]
    open-pull-requests-limit: 10
  - package-ecosystem: gradle
    directory: /android
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
```
