param(
  [string]$Version
)

$ErrorActionPreference = "Stop"

if (-not $Version) {
  $Version = (Get-Content -Raw "package.json" | ConvertFrom-Json).version
}
if ([string]::IsNullOrWhiteSpace($Version)) {
  throw "Unable to determine the application version (package.json / -Version)."
}

$FileVersion = "$Version.0"
$bundleDir = "src-tauri\target\release\bundle\nsis"
$canonicalExe = "dist-windows\Planning-Oran-Setup.exe"
$versionedExe = "dist-windows\Planning-Oran-Setup-v$Version.exe"

Write-Host "Building Appointment native Windows runtime with Tauri v2 ($Version)"
Write-Host "This build embeds the web UI in WebView2 and adds native Rust filesystem and Credential Manager commands."

New-Item -ItemType Directory -Force -Path "dist-windows" | Out-Null
npm run tauri:build

if (-not (Test-Path $bundleDir)) {
  throw "Tauri NSIS bundle directory not found: $bundleDir"
}
$tauriSetup = Get-ChildItem -Path $bundleDir -Filter "*-setup.exe" -File |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $tauriSetup) {
  throw "Tauri did not produce an NSIS setup executable."
}

Copy-Item -Path $tauriSetup.FullName -Destination $canonicalExe -Force
Copy-Item -Path $tauriSetup.FullName -Destination $versionedExe -Force

Write-Host "Authenticode signing native Tauri installer..."
if ($env:WINDOWS_CERT_BASE64) {
  $certPath = Join-Path $env:TEMP "appointment-signing.pfx"
  try {
    [IO.File]::WriteAllBytes($certPath, [Convert]::FromBase64String($env:WINDOWS_CERT_BASE64))
    $cert = Get-PfxCertificate -FilePath $certPath
    Set-AuthenticodeSignature -FilePath $canonicalExe -Certificate $cert -HashAlgorithm SHA256 | Out-Null
    Set-AuthenticodeSignature -FilePath $versionedExe -Certificate $cert -HashAlgorithm SHA256 | Out-Null
  } finally {
    if (Test-Path $certPath) { Remove-Item $certPath -Force }
  }
} else {
  Write-Warning "WINDOWS_CERT_BASE64 is not configured. A self-signed certificate will not establish a trusted publisher on customer PCs."
  $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Appointment Official, O=Connacri, C=DZ" -CertStoreLocation "Cert:\CurrentUser\My" -HashAlgorithm SHA256
  Set-AuthenticodeSignature -FilePath $canonicalExe -Certificate $cert -HashAlgorithm SHA256 | Out-Null
  Set-AuthenticodeSignature -FilePath $versionedExe -Certificate $cert -HashAlgorithm SHA256 | Out-Null
}

$signature = Get-AuthenticodeSignature $versionedExe
$signature | Format-List
if ($signature.Status -ne "Valid") {
  throw "Native Windows installer signature verification failed: $($signature.Status)"
}

$packageDir = "dist-windows\package"
New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
Copy-Item -Path $versionedExe -Destination $packageDir -Force
Compress-Archive -Path "$packageDir\*" -DestinationPath "dist-windows\Planning-Oran-Windows-v$Version.zip" -Force

Get-ChildItem "dist-windows" -Filter "Planning-Oran-*" |
  Select-Object Name, Length |
  Format-Table -AutoSize
