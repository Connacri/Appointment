$ErrorActionPreference = 'Stop'

$sourceDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$sourceExecutable = Join-Path $sourceDirectory 'appointment-pms-native.exe'
if (-not (Test-Path -LiteralPath $sourceExecutable -PathType Leaf)) {
    throw "appointment-pms-native.exe is missing. Extract the complete Windows Native ZIP before running this script."
}

if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw "LOCALAPPDATA is not available for this Windows user. Sign in with a normal Windows user profile and retry."
}

$running = Get-Process -Name 'appointment-pms-native' -ErrorAction SilentlyContinue
if ($running) {
    throw "Appointment PMS is running. Close it completely, then run this installer again."
}

$installDirectory = Join-Path $env:LOCALAPPDATA 'Programs\Appointment PMS'
$targetExecutable = Join-Path $installDirectory 'appointment-pms-native.exe'
$startMenuDirectory = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$shortcutPath = Join-Path $startMenuDirectory 'Appointment PMS.lnk'

New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
Copy-Item -LiteralPath $sourceExecutable -Destination $targetExecutable -Force

if (Test-Path -LiteralPath $startMenuDirectory -PathType Container) {
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $targetExecutable
    $shortcut.WorkingDirectory = $installDirectory
    $shortcut.Description = 'Appointment PMS — Native Windows x64'
    $shortcut.Save()
}

Write-Host "Appointment PMS installed for the current Windows user:"
Write-Host $targetExecutable
Write-Host "User data remains in %LOCALAPPDATA%\Connacri\Appointment."
$launch = Read-Host 'Launch Appointment PMS now? [Y/n]'
if ([string]::IsNullOrWhiteSpace($launch) -or $launch -match '^(y|yes|o|oui)$') {
    Start-Process -FilePath $targetExecutable -WorkingDirectory $installDirectory
}
