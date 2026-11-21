param(
  [Parameter(Mandatory = $true)]
  [string]$Version
)

$ErrorActionPreference = "Stop"
$launcher = "dist-windows\Appointment-PMS-Setup.exe"
if (-not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
  throw "Signed Windows launcher is missing: $launcher"
}
if (-not (Test-Path -LiteralPath "dist\index.html" -PathType Leaf)) {
  throw "Production web assets are missing: dist\index.html"
}

$packageDir = "dist-windows\package"
$archive = "dist-windows\Appointment-PMS-Windows-v$Version.zip"
if (Test-Path $packageDir) { Remove-Item $packageDir -Recurse -Force }
if (Test-Path $archive) { Remove-Item $archive -Force }

New-Item -ItemType Directory -Force -Path $packageDir | Out-Null
Copy-Item -LiteralPath $launcher -Destination $packageDir
Copy-Item -LiteralPath "dist" -Destination (Join-Path $packageDir "dist") -Recurse
Compress-Archive -Path (Join-Path $packageDir "*") -DestinationPath $archive -Force

if (-not (Test-Path -LiteralPath $archive -PathType Leaf)) {
  throw "Windows distribution archive was not created: $archive"
}
Write-Host "Created signed Windows distribution archive: $archive"
