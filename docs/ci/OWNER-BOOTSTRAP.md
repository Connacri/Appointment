# Owner bootstrap — keys, secrets, variables, Play & Firebase

Performed **once by the project owner**, never by the agent. Read this page whenever
the CI preflight step or `gh secret list` reports something missing.

The **source of truth for secret and variable names** is
[`scripts/bootstrap-secrets.sh`](../../scripts/bootstrap-secrets.sh); this page only
explains what the script does and which manual steps remain.

## 1. Prerequisites

- `gh` CLI authenticated (`gh auth login`), a JDK (`keytool`), `openssl`, repo cloned.
- Never paste a secret, key, password, or token into a chat, an issue, or a commit.

## 2. Upload keystore + GitHub secrets, variables, environments

```bash
bash scripts/bootstrap-secrets.sh
```

The script generates the upload keystore **outside the repo** (`~/.keystores/<package>/`),
stores the passwords in a `chmod 600` file next to it, uploads the secrets below
without printing any value, sets the variables, creates the `staging`,
`production` and `github-pages` environments, and prints the public
**SHA-1 / SHA-256** fingerprints used by Firebase and `UPLOAD_CERT_SHA256`.

Then back the keystore and its credentials file up in **two offline locations**
(password manager + encrypted drive) and delete the local plaintext credentials file.

### Secrets (values never readable back)

```text
ANDROID_KEYSTORE_BASE64      upload keystore, Base64
ANDROID_KEYSTORE_PASSWORD    keystore password
ANDROID_KEY_ALIAS            key alias
ANDROID_KEY_PASSWORD         key password
PLAY_STORE_JSON_KEY          Play Developer API service account (optional: enables Play upload)
GOOGLE_SERVICES_JSON_BASE64  google-services.json, Base64 (when Firebase is used)
WINDOWS_CERT_BASE64          Authenticode code-signing .pfx, Base64 (optional: CI falls back to self-signed)
```

### Variables

```text
APPLICATION_ID / ANDROID_PACKAGE_NAME   application ID (immutable once published)
UPLOAD_CERT_SHA256                      expected upload-certificate fingerprint
PLAY_STORE_JSON_KEY_PRESENT             true to enable the Play upload job
PLAY_TRACK_RELEASE                      track for tagged releases (default internal)
PLAY_RELEASE_STATUS                     draft until the first Play upload is accepted
VERSION_CODE_OFFSET                     offset added to github.run_number
SITE_URL / SUPPORT_EMAIL                public site URL and contact
```

## 3. Google Play Console

1. Create the app with a package name equal to `APPLICATION_ID`. Keep **Play App
   Signing** enabled (default); our keystore is only the *upload* key.
2. Store listing for `fr-FR`, `en-US`, `ar`; privacy policy URL
   (`SITE_URL/privacy/`); Data safety form; **account deletion URL**
   (`SITE_URL/delete-account/`).
3. Google Cloud Console → enable **Google Play Android Developer API** → IAM →
   Service accounts → create → Keys → add key (JSON).
4. Play Console → Users and permissions → invite the service-account email with
   *Release apps to testing tracks*, *Release to production* (when ready), and
   *Manage store presence*. Permissions can take a few hours to propagate.
5. Store the JSON as a secret, then delete the local file:
   ```bash
   gh secret set PLAY_STORE_JSON_KEY < play-service-account.json
   gh variable set PLAY_STORE_JSON_KEY_PRESENT --body "true"
   shred -u play-service-account.json
   ```
6. The **first** AAB of a new app must reach Play once: keep
   `PLAY_RELEASE_STATUS=draft`, run the workflow (`workflow_dispatch`, track
   `internal`), then clear the variable.

## 4. Firebase

1. Add the Android app with the same package name. Register the **SHA-1 and SHA-256
   of the upload key** (printed by the script) **and**, after the first upload, the
   **Play app signing key** fingerprint (Play Console → Test and release → App
   integrity). Google Sign-In fails in production without it.
2. Download `google-services.json` and let the script store it (or
   `base64 < google-services.json | tr -d '\n' | gh secret set GOOGLE_SERVICES_JSON_BASE64`).
3. Enable the needed Auth providers, **App Check** (Play Integrity), FCM, and deploy
   Firestore/Storage rules.
4. Server-side secrets for Cloud Functions (including account deletion):
   `firebase functions:secrets:set NAME`. Never in the repo.

## 5. Google Cloud API keys

Restrict every client key by Android app (package + both SHA-1) or by referrer
(`SITE_URL`), and by API. Client keys go to GitHub Variables; server keys stay in the
backend secret manager.

## 6. Repository settings

Pages source = GitHub Actions; environments `staging`, `production` (required
reviewers), `github-pages`; tag ruleset `v*`; branch protection on `main`.

## 7. Verify

```bash
gh secret list && gh variable list     # names only
gh workflow run "Release & Deploy" -f release_track=internal
gh run watch
```

The logs must show matching APK/AAB certificate fingerprints and a successful bundle
validation.

## 8. Recovery

Lost upload key → Play Console upload-key reset (Play support), generate a new
keystore with the script, update the four `ANDROID_*` secrets,
`UPLOAD_CERT_SHA256`, and the Firebase fingerprints.
