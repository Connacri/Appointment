$ErrorActionPreference = 'Stop'

$sourceDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$installer = Get-ChildItem -LiteralPath $sourceDirectory -Filter 'Appointment-PMS-Setup-v*.exe' -File |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $installer) {
    throw 'Appointment-PMS-Setup-v*.exe was not found. Extract the complete Windows Native ZIP and retry.'
}
if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'LOCALAPPDATA is unavailable. Sign in with a normal Windows user profile and retry.'
}

# SetupLdr extracts itself below the process temp path. Avoid a damaged %TEMP%.
$tempDirectory = Join-Path $env:LOCALAPPDATA 'Connacri\Appointment\InstallerTemp'
New-Item -ItemType Directory -Path $tempDirectory -Force | Out-Null
$probe = Join-Path $tempDirectory ('.write-test-' + [Guid]::NewGuid().ToString('N'))
try {
    [System.IO.File]::WriteAllText($probe, 'Appointment PMS installer temp check')
}
finally {
    if (Test-Path -LiteralPath $probe) { Remove-Item -LiteralPath $probe -Force }
}

$env:TMP = $tempDirectory
$env:TEMP = $tempDirectory
Write-Host "Using writable installer temp directory: $tempDirectory"
Write-Host "Starting $($installer.Name)..."

$process = Start-Process -FilePath $installer.FullName -ArgumentList '/LOG' -PassThru -Wait
if ($process.ExitCode -ne 0) {
    Write-Warning "Setup exited with code $($process.ExitCode)."
    Write-Warning 'If Windows still denies temporary-directory access, run Install-Portable.ps1 from this extracted ZIP.'
    exit $process.ExitCode
}
Write-Host 'Appointment PMS setup completed.'
