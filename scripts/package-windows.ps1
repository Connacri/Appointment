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
Write-Host "Packaging Windows application launcher for version $Version (file version $FileVersion)"

New-Item -ItemType Directory -Force -Path "dist-windows" | Out-Null

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

[assembly: AssemblyTitle("Appointment PMS Autonomous Cockpit")]
[assembly: AssemblyProduct("Appointment PMS")]
[assembly: AssemblyCompany("Appointment PMS Lab")]
[assembly: AssemblyVersion("$FileVersion")]
[assembly: AssemblyFileVersion("$FileVersion")]

namespace AppointmentPms {
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
                MessageBox.Show("Erreur au lancement: " + ex.Message, "Appointment PMS", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
    }
}
"@
Set-Content -Path "dist-windows\Program.cs" -Value $sourceCSharp

# Canonical (unversioned) launcher kept for scripts/installer.iss, plus a versioned
# copy published in the GitHub Release (AGENTS.md 18: artifacts are always versioned).
$launcherExe = "dist-windows\Appointment-PMS-Setup.exe"
$versionedExe = "dist-windows\Appointment-PMS-Setup-v$Version.exe"

$csc = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /platform:anycpu /out:"$launcherExe" /r:"System.Windows.Forms.dll" "dist-windows\Program.cs"
Copy-Item -Path $launcherExe -Destination $versionedExe -Force

Write-Host "Windows artifacts:"
Get-ChildItem "dist-windows" -Filter "Appointment-PMS-*" | Select-Object Name, Length | Format-Table -AutoSize
