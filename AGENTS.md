# AGENTS.md

> Operating contract for the autonomous engineering agent of this project.
> Rules marked **MUST / NEVER** are blocking. Rules marked **SHOULD** are strong defaults.
> If a rule conflicts with a user instruction, follow the user, then state the deviation in the commit body.
>
> **This file is the operating contract; the CI/release material lives beside it**: owner bootstrap in `docs/ci/OWNER-BOOTSTRAP.md`, the bootstrap script in `scripts/bootstrap-secrets.sh` (source of truth for secret/variable names), the real release pipeline in `.github/workflows/release-and-deploy.yml` + `docs/RELEASE.md`, the optional advanced-quality reference in `docs/ci/QUALITY-ADVANCED.md`, and the Gradle signing config in Appendix D below. Keep those files in sync in the same commit as any related change; never re-inline them here.

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
10. **NEVER** print, log, read back, or ask the user to paste any secret, key, password, or token in chat. Secrets are created by the **owner** with the bootstrap script (`scripts/bootstrap-secrets.sh`, documented in `docs/ci/OWNER-BOOTSTRAP.md`) and stored only in GitHub Secrets.

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
* **IndexedDB**: use paginated lazy queries with `offset` and `limit`; never load whole collections into memory; index queried properties; run writes off the UI thread.
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
* The **owner** creates keys and secrets (`docs/ci/OWNER-BOOTSTRAP.md`). The agent only **checks that names exist** (`gh secret list`, `gh variable list`; values are never readable) and stops with the exact missing names if something is absent.
* The agent NEVER generates, replaces, rotates, or deletes the upload keystore or any production key by itself. If the upload key is lost: Play Console → upload-key reset, then update the secrets, `UPLOAD_CERT_SHA256`, and Firebase fingerprints.
* Commit `.env.example` (names only, no values). `.env*`, `*.jks`, `*.keystore`, `key.properties`, service-account JSON are git-ignored.
* Names are `UPPER_SNAKE_CASE`, prefixed by area: `ANDROID_`, `PLAY_`, `FIREBASE_`, `GOOGLE_`, `SITE_`.

### 15.2 Inventory

**Secrets** (GitHub → Settings → Secrets and variables → Actions → Secrets)

| Name | Purpose | Created by |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | Upload keystore, Base64 | `bootstrap-secrets.sh` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | `bootstrap-secrets.sh` |
| `ANDROID_KEY_ALIAS` | Key alias | `bootstrap-secrets.sh` |
| `ANDROID_KEY_PASSWORD` | Key password | `bootstrap-secrets.sh` |
| `PLAY_STORE_JSON_KEY` (optional) | Google Play Developer API service account (JSON); enables the Play upload job | owner |
| `GOOGLE_SERVICES_JSON_BASE64` | Firebase `google-services.json`, Base64 (only when the native build consumes it) | `bootstrap-secrets.sh` |
| `WINDOWS_CERT_BASE64` (optional) | Authenticode `.pfx`, Base64; CI falls back to a self-signed certificate | `bootstrap-secrets.sh` |
| `GOOGLESERVICE_INFO_PLIST_BASE64` (optional) | iOS Firebase config (only when iOS CI exists) | owner |

**Variables** (non-sensitive; Settings → Secrets and variables → Actions → Variables)

| Name | Purpose |
|---|---|
| `ANDROID_PACKAGE_NAME` | Application ID (immutable once published) |
| `APPLICATION_ID` | Same value, kept for workflows that still read it |
| `UPLOAD_CERT_SHA256` | Expected upload-certificate fingerprint, verified at every build |
| `PLAY_STORE_JSON_KEY_PRESENT` | `true` to enable the Play upload job |
| `PLAY_TRACK_RELEASE` | Track for tagged releases (default `internal`) |
| `PLAY_RELEASE_STATUS` | `draft` for the very first release, then empty |
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
3. Decode `ANDROID_KEYSTORE_BASE64` to a **temporary** path (`$RUNNER_TEMP`), `chmod 600`.
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

Workflows live in `.github/workflows/`. The reference implementation is `.github/workflows/release-and-deploy.yml` (documented in `docs/RELEASE.md`); there is no other release path. Requirements:

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
* exactly which data is collected (account/auth data, device & FCM tokens, analytics, crash logs, local IndexedDB data, permissions) and why
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

Keep current: `README.md` + `README.fr.md` + `README.ar.md` (§19.1), `docs/COMPLIANCE.md` (data inventory, Play Data Safety answers, permissions), `docs/ARCHITECTURE.md`, `docs/RELEASE.md` (signing, secrets, Play process), `docs/ci/OWNER-BOOTSTRAP.md` (owner-only bootstrap), `docs/ci/QUALITY-ADVANCED.md` (optional quality jobs), `docs/I18N.md` (adding a language/key, RTL rules), `docs/BRANDING.md` (asset specs), and `CHANGELOG.md`. Update docs in the same commit as the behavior change. Never document secrets' values.

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
6. scripts/bootstrap-secrets.sh                                    docs/ci/OWNER-BOOTSTRAP.md
7. .github/workflows/release-and-deploy.yml                        docs/RELEASE.md
8. optional: e2e/, lighthouserc.json, quality-advanced + dependabot  docs/ci/QUALITY-ADVANCED.md
9. docs/ARCHITECTURE.md, RELEASE.md, I18N.md, BRANDING.md, COMPLIANCE.md, HEALTH.md
10. Gradle signing/versioning config                               Appendix D
```

Then tell the owner which owner-only steps remain (`docs/ci/OWNER-BOOTSTRAP.md`) with the exact missing secret/variable names.

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

* **E2E matrix** (`docs/ci/QUALITY-ADVANCED.md`): `phone / tablet / desktop` × `fr / en / ar` (Arabic in RTL), light + dark, with visual-regression snapshots and automated accessibility checks (axe). A layout break in any cell blocks the merge.
* **Lighthouse CI** with budgets in `lighthouserc.json` (performance ≥ 90, accessibility ≥ 95, best-practices ≥ 95, SEO ≥ 90).
* **CodeQL** on PRs and weekly; **Dependabot** weekly (both described in `docs/ci/QUALITY-ADVANCED.md`); high/critical findings block.
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

# APPENDIXES — files moved out of this contract

`AGENTS.md` used to inline the whole CI/release/bootstrap material (~40 KB on every
request). It now lives in dedicated documents; treat those files as the source of
truth and keep them in sync in the same commit as any related change.

| Topic | File |
|---|---|
| Owner-only bootstrap: upload keystore, GitHub secrets/variables/environments, Play Console, Firebase | `docs/ci/OWNER-BOOTSTRAP.md` |
| Bootstrap script (single source of truth for secret/variable **names**) | `scripts/bootstrap-secrets.sh` |
| Real release pipeline (APK · AAB · Windows EXE · GitHub Release · Pages) | `.github/workflows/release-and-deploy.yml` + `docs/RELEASE.md` |
| Optional advanced quality: E2E matrix, Lighthouse, CodeQL, Dependabot, store screenshots | `docs/ci/QUALITY-ADVANCED.md` |

Superseded and intentionally removed: the old Appendix B (stale copy of the
bootstrap script, with outdated secret names), Appendix C (`ci-release.yml`, never
shipped and contradicted the real pipeline), Appendix G (duplicated `docs/RELEASE.md`).
Never reintroduce them.
