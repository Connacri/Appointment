# Windows native release

## Build topology

The Windows artifact is a Tauri 2 NSIS installer. The frontend remains React/Vite in WebView2, while the Rust host owns native file access and Windows Credential Manager operations. The previous C# process that launched `msedge.exe --app` is no longer the intended desktop artifact.

## Local development

Requirements:
- Node.js 22 and npm.
- Rust stable toolchain.
- Microsoft C++ Build Tools / MSVC.
- WebView2 Runtime (normally installed on supported Windows systems).

Commands:
```powershell
npm install --legacy-peer-deps
npm run tauri:dev
npm run tauri:build
```

## CI

- `.github/workflows/native-windows-ci.yml` validates typecheck, tests and the Tauri Windows bundle on pull requests.
- `.github/workflows/release-and-deploy.yml` builds the versioned Windows installer on a Windows runner as part of the established release pipeline.
- `scripts/package-windows.ps1` invokes `npm run tauri:build`, copies the NSIS setup executable to versioned artifact names and signs it.
- NSIS `installMode = both` supports per-user and per-machine installation. Per-machine installation may require administrator approval.
- The build reuses `assets/icon.png`.

## Signing

Set GitHub Secret `WINDOWS_CERT_BASE64` to a trusted Authenticode PFX (and configure its password handling in CI if required). Without this secret, CI may sign with a self-signed certificate for diagnostic builds; Windows customers will not automatically trust that publisher. Do not describe a self-signed build as a trusted production signature.

Production artifacts must be built and signed in GitHub Actions. Never build/sign release artifacts locally. Verify the exact workflow run, installer signature status and release asset checksum before distribution.

## Security notes

- Native file access runs under the logged-in Windows user and obeys NTFS ACLs.
- CardLock import is read-only and limited to the selected/known MDB file.
- Neon strings are stored in Windows Credential Manager only after an actual TLS PostgreSQL test.
- A connection test is not a data synchronization test. Do not display a synchronized state without acknowledged Push and completed Pull operations.
