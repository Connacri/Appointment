param(
  [string]$Version
)

$ErrorActionPreference = "Stop"

# Single source of truth for the version: package.json (AGENTS.md 18).
if (-not $Version) {
  $Version = (Get-Content -Raw "package.json" | ConvertFrom-Json).version
}
if ([string]::IsNullOrWhiteSpace($Version)) {
  throw "Unable to determine the application version (package.json / -Version)."
}
$FileVersion = "$Version.0"
Write-Host "Packaging Windows launcher for version $Version (file version $FileVersion)"

New-Item -ItemType Directory -Force -Path "dist-windows" | Out-Null

Compress-Archive -Path "dist\*" -DestinationPath "dist-windows\app-assets.zip" -Force

$launcherScript = @"
Add-Type -AssemblyName System.Windows.Forms
`$url = "file:///" + (`$PSScriptRoot -replace '\\', '/') + "/dist/index.html"
Start-Process "msedge.exe" -ArgumentList "--app=`$url --window-size=1280,820"
"@
Set-Content -Path "dist-windows\launch.ps1" -Value $launcherScript

$sourceCSharp = @"
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

[assembly: AssemblyTitle("Planning Oran Autonomous Cockpit")]
[assembly: AssemblyProduct("Planning Oran")]
[assembly: AssemblyCompany("Planning Oran Lab")]
[assembly: AssemblyVersion("$FileVersion")]
[assembly: AssemblyFileVersion("$FileVersion")]

namespace PlanningOran {
    static class Program {
        [STAThread]
        static void Main() {
            try {
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string indexPath = Path.Combine(appDir, "dist", "index.html");
                if (!File.Exists(indexPath)) {
                    indexPath = Path.Combine(appDir, "index.html");
                }
                string url = File.Exists(indexPath) ? new Uri(indexPath).AbsoluteUri : "https://connacri.github.io/Appointment/";

                ProcessStartInfo psi = new ProcessStartInfo {
                    FileName = "msedge.exe",
                    Arguments = "--app=\"" + url + "\" --window-size=1360,860",
                    UseShellExecute = true
                };
                Process.Start(psi);
            } catch (Exception ex) {
                MessageBox.Show("Erreur au lancement: " + ex.Message, "Planning Oran", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
"@
Set-Content -Path "dist-windows\Program.cs" -Value $sourceCSharp

# Canonical (unversioned) launcher kept for scripts/installer.iss, plus a versioned
# copy published in the GitHub Release (AGENTS.md 18: artifacts are always versioned).
$launcherExe = "dist-windows\Planning-Oran-Setup.exe"
$versionedExe = "dist-windows\Planning-Oran-Setup-v$Version.exe"

$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /platform:anycpu /out:"$launcherExe" /r:"System.Windows.Forms.dll" "dist-windows\Program.cs"
Copy-Item -Path $launcherExe -Destination $versionedExe -Force

Write-Host "Cryptographic Code Signing for Windows Binary (.exe)..."
if ($env:WINDOWS_CERT_BASE64) {
  Write-Host "Using official WINDOWS_CERT_BASE64 from GitHub Secrets."
  [IO.File]::WriteAllBytes("$env:TEMP\cert.pfx", [Convert]::FromBase64String($env:WINDOWS_CERT_BASE64))
  Set-AuthenticodeSignature -FilePath $launcherExe -Certificate (Get-PfxCertificate -FilePath "$env:TEMP\cert.pfx") -HashAlgorithm SHA256 | Out-Null
  Set-AuthenticodeSignature -FilePath $versionedExe -Certificate (Get-PfxCertificate -FilePath "$env:TEMP\cert.pfx") -HashAlgorithm SHA256 | Out-Null
  Remove-Item "$env:TEMP\cert.pfx" -Force
} else {
  Write-Host "Generation of CI Code-Signing Authenticode Certificate (self-signed)..."
  $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Planning Oran Official, O=Planning Oran, C=DZ" -CertStoreLocation "Cert:\CurrentUser\My" -HashAlgorithm SHA256
  Set-AuthenticodeSignature -FilePath $launcherExe -Certificate $cert -HashAlgorithm SHA256 | Out-Null
  Set-AuthenticodeSignature -FilePath $versionedExe -Certificate $cert -HashAlgorithm SHA256 | Out-Null
}

Get-AuthenticodeSignature $launcherExe | Format-List
Get-AuthenticodeSignature $versionedExe | Format-List

New-Item -ItemType Directory -Force -Path "dist-windows\package" | Out-Null
Copy-Item -Path $launcherExe -Destination "dist-windows\package\"
Copy-Item -Path "dist" -Destination "dist-windows\package\dist" -Recurse
Compress-Archive -Path "dist-windows\package\*" -DestinationPath "dist-windows\Planning-Oran-Windows-v$Version.zip" -Force

Write-Host "Windows artifacts:"
Get-ChildItem "dist-windows" -Filter "Planning-Oran-*" | Select-Object Name, Length | Format-Table -AutoSize
