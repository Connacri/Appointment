# COMPLIANCE.md — Data Inventory & Store Compliance

> Source of truth for the privacy policy (`public/privacy/`), the account-deletion page
> (`public/delete-account/`) and the Google Play **Data safety** form.
> Update this file **in the same commit** whenever data collection, a permission, an SDK
> or a login provider changes.

**App**: Appointment PMS — hotel & resort property management (web + Android, `com.planning.oran`).
**Data protection contact**: ramzi.guedouar@gmail.com.
**Last audited**: 2026-11-05 (code audit of `src/`, `public/`, `capacitor.config.json`).

## 1. Design principle

The application is **local-first**. In normal use no account and no remote service are
required, and operational data stays on the device. Remote storage and authentication are
**optional** and only active when a Supabase project is configured.

**No analytics, advertising, crash reporting, telemetry, location or push-notification
SDK is present in the codebase** (verified: no `gtag`, Sentry, Firebase, FCM, Mixpanel,
PostHog, Plausible or Matomo).

## 2. Data inventory

| Data | Where it lives | Why | Retention | User control |
|---|---|---|---|---|
| Reservations, rooms/resources, invoices, preferences, housekeeping and pricing state | IndexedDB `OmniBook_ObjectBox_Store` (localStorage fallback `ob_<store>`) | Core offline functionality | Until deleted on device | In-app purge (Privacy & Account → Local data), or clear site data |
| proUSB issued-card list, encoder audit log, encoder settings, imported `CardLock.mdb` snapshot | localStorage `omnibook_prousb_*`, `appointment_prousb_*` | Lock operation history and re-commissioning safety | Until deleted on device | In-app purge, or clear site data |
| Selected language, onboarding flags, workspace hints | localStorage `omnibook_lang`, `omnibook_*`, `appointment_*` | Preferences | Until deleted on device | In-app purge, or clear site data |
| Account email, password (hashed by Supabase), user id, session token | Supabase Auth (only when Supabase is configured and the user signs up) | Optional sign-in and cross-device workspace | Until account deletion | Delete-account procedure |
| Workspace rows you create (bookings, resources, invoices, tasks, stock, rates, profiles, members, audit events) | Supabase Postgres, 16 public tables with RLS: `audit_events`, `booking_payments`, `bookings`, `dynamic_rates`, `establishments`, `guests`, `invoice_items`, `invoices`, `pms_tasks`, `profiles`, `resource_groups`, `resources`, `stock_items`, `stock_movements`, `workspace_members`, `workspaces` | Optional cloud sync | Until account deletion | Delete-account procedure |
| WebHID device handle for the proUSB encoder | Browser permission (no data transmitted) | Read/write physical encoder cards | Browser permission until revoked | Browser site settings |
| Camera stream for QR scanning | Processed locally, frames never uploaded | QR pass reading | Ephemeral | Browser permission |

## 3. Permissions used

| Permission / capability | Platform | Purpose | Requested |
|---|---|---|---|
| WebHID (`navigator.hid.requestDevice`) | Web, Android WebView | Communicate with the physical proUSB encoder | On explicit user action only |
| Camera (`getUserMedia`) | Web, Android | Scan QR codes | On explicit user action only |

No other sensitive permission (contacts, location, storage, microphone, notifications) is
requested by the application code.

## 4. Third parties

| Provider | What it receives | When |
|---|---|---|
| Supabase (hosted PostgreSQL + Auth) | Authentication record and workspace rows you write | Only if configured with `VITE_SUPABASE_URL` / runtime config |
| GitHub Pages | Serves the static site and bundle (HTTPS) | Always (web deployment) |
| Google Fonts | Font file requests (Plus Jakarta Sans, Cairo, JetBrains Mono) | Always |

No other third party receives application data.

## 5. Deletion flows (must stay real)

| Flow | Implementation | Status |
|---|---|---|
| Local data purge | `AppContext.purgeAllUserData()` called from `LegalModal` (Privacy & Account → Local data → Clear local data) | Implemented |
| Remote account deletion request | `public/delete-account/{fr,en,ar}/index.html` opens a pre-filled `mailto:` to the data protection contact; the user sends it and identity is verified by replying to that address | Implemented (manual backend step) |
| In-app account deletion | **Not implemented** — the app states that the local purge does not replace an account deletion request | Known gap: needs a backend endpoint (Cloud Function / Edge Function) |

**Never publish a deletion promise the system cannot keep.** If a flow is added or removed,
update this table, the privacy policy and the delete-account pages together.

### 5.1 Contract for the future in-app account deletion endpoint

Not deployed. This is the exact behaviour the UI and legal pages may advertise **only after**
the endpoint below exists and has been exercised once end to end. Until then the copy must keep
saying that the in-app purge is local-only.

| Item | Requirement |
|---|---|
| Endpoint | `POST /functions/v1/delete-account` (Supabase Edge Function), authenticated with the caller's Supabase JWT — never a service-role key from the client |
| Input | Empty body. The target user is taken from the verified JWT (`sub`); the client cannot pass another user id |
| Re-authentication | The UI must require a fresh sign-in or password confirmation before calling the function, so a stolen unlocked device cannot erase an account silently |
| Identity check | `auth.getUser(jwt)` must succeed server-side; a missing/expired token returns `401` and deletes nothing |
| Deletion order | 1. `storage.objects` files owned by the workspace, 2. child rows (`booking_payments`, `invoice_items`, `stock_movements`, `pms_tasks`, `audit_events`), 3. parent rows (`bookings`, `invoices`, `resources`, `resource_groups`, `guests`, `dynamic_rates`, `stock_items`, `establishments`), 4. `workspace_members`, 5. `workspaces` owned by the user, 6. `profiles`, 7. `auth.users` via the Admin API |
| Shared workspaces | If the user is not the sole owner, the function must delete only their membership and personal rows and return `409` with the reason instead of destroying a workspace other people use |
| Transactionality | One SQL transaction for the database part; storage cleanup may retry, but a partial run must leave the account intact and report `failed` — never a half-deleted auth record |
| Response | `204` on success, `401` unauthenticated, `409` shared workspace, `500` with a correlation id; no internal detail in the body |
| Audit | Write one `audit_events` row (`action = 'account_deleted'`, actor hash, timestamp) retained separately from the deleted data |
| Legal sync | The same change must update `public/delete-account/{fr,en,ar}/`, `public/privacy/{fr,en,ar}/`, this file and the Play Data safety answer |


## 6. Google Play Data safety mapping

| Play question | Answer |
|---|---|
| Data collected | **No** — the app collects no data for transmission to the developer's servers beyond what you enter in an optional account (email). |
| Data shared | **No** |
| Data sold | **No** |
| Data in transit | HTTPS to Supabase only when an account is used |
| Account deletion supported | Yes — the web request page (`SITE_URL/delete-account/`) with email verification. The in-app purge erases only on-device data and is **not** an account deletion, so it is not claimed as one. |
| Security practices | Transport encryption (HTTPS), data encrypted in transit; local data protected by the device |
| Mandatory declarations | None (no location, no contacts, no photos stored, no ads, no children's data) |

## 7. Open items for the owner

1. **Legal entity name** of the publisher is not stated in the repository; the policy only
   names the data protection contact. Confirm the legal wording with a lawyer.
2. In-app account deletion requires a backend endpoint (contract in §5.1); until it exists, the web
   `mailto:` channel is the only server-side path.
3. Retention of accounting records (invoices) is whatever the operator's own legal
   obligations are — invoices live locally in the app and are not held by us.
4. The legal texts should be reviewed by the owner or a lawyer; the agent is not a legal advisor.
