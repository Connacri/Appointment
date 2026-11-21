# CI/CD hardening

## Workflow entry points

- `.github/workflows/quality-checks.yml`: runs on pull requests and branch pushes, and is reusable through `workflow_call`.
- `.github/workflows/deploy-web.yml`: deploys GitHub Pages from `main` only after the reusable quality gate succeeds.
- The Pages job uses `upload-pages-artifact@v4`, verifies the returned artifact ID is visible through the workflow-artifacts API before deployment, and keeps `deploy-pages@v4` within its documented 600,000 ms timeout. This preflight distinguishes artifact publication/visibility failures from Pages deployment failures.
- `.github/workflows/release-and-deploy.yml`: creates Android and Windows releases only for `vX.Y.Z` tags or an explicit manual dispatch. Both entry points run the quality gate first.

A push to `main` no longer publishes Android and Windows binaries. Create a semantic version tag after the change is accepted to start a production binary release. Manual dispatch remains available for controlled release builds.

## Required repository secrets and variables

### Android signing

Secrets:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Repository variable:
- `UPLOAD_CERT_SHA256`: SHA-256 certificate fingerprint printed by `apksigner`, normalized by the workflow before comparison. A missing value fails the production release.

### Windows Authenticode signing

Secrets:
- `WINDOWS_CERT_BASE64`: base64-encoded PFX containing the production code-signing certificate and private key.
- `WINDOWS_CERT_PASSWORD`: PFX password. Set an empty secret only when the PFX itself has no password.

The Windows release fails unless the PFX can be imported, contains a private key, and every published EXE has a valid Authenticode signature from that certificate. A self-signed fallback is intentionally prohibited. The signing step applies a SHA-256 timestamp from DigiCert.

### Optional Google Play upload

Secret:
- `PLAY_STORE_JSON_KEY`

Variables:
- `PLAY_STORE_JSON_KEY_PRESENT=true`
- `ANDROID_PACKAGE_NAME`
- `PLAY_TRACK_RELEASE` (fallback when a workflow-dispatch track is not selected)
- `PLAY_RELEASE_STATUS`

The manual `release_track` input takes precedence over `PLAY_TRACK_RELEASE`.

### Neon preview branches

Secret:
- `NEON_API_KEY`

Variable:
- `NEON_PROJECT_ID`

## Current limitations requiring a separate follow-up

- The repository intentionally ignores `package-lock.json`. The npm cache added by this hardening reduces repeat downloads but does not make dependency resolution reproducible. A cross-platform lockfile must be generated and verified from a clean Linux Node 22 environment, then committed before switching installs to `npm ci`.
- The Windows EXE is still a small launcher that opens the bundled SPA in Microsoft Edge app mode. This work hardens its packaging and signing; it does not convert it into a native WebView2/.NET desktop host or provide native filesystem and Windows Credential Manager APIs.
- Neon preview provisioning currently creates/deletes branches; PostgreSQL migration execution and RLS/workspace-isolation integration tests remain separate work.
- Repository branch-protection settings and required status checks must be configured in GitHub repository settings. The workflow definitions alone cannot enforce merge protection.
