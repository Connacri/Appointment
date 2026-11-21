param(
  [Parameter(Mandatory = $true)]
  [string[]]$Paths
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:WINDOWS_CERT_BASE64)) {
  throw "WINDOWS_CERT_BASE64 is required. Production builds must never fall back to a self-signed certificate."
}

$pfxPath = Join-Path $env:TEMP ("appointment-code-signing-" + [guid]::NewGuid().ToString("N") + ".pfx")
$certificate = $null

try {
  [IO.File]::WriteAllBytes($pfxPath, [Convert]::FromBase64String($env:WINDOWS_CERT_BASE64))
  $password = ConvertTo-SecureString ([string]$env:WINDOWS_CERT_PASSWORD) -AsPlainText -Force
  $certificate = Import-PfxCertificate -FilePath $pfxPath -CertStoreLocation "Cert:\CurrentUser\My" -Password $password -Exportable

  if (-not $certificate -or -not $certificate.HasPrivateKey) {
    throw "The configured PFX does not contain an accessible code-signing private key."
  }

  foreach ($path in $Paths) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "Required Windows release artifact not found: $path"
    }

    Set-AuthenticodeSignature -FilePath (Resolve-Path -LiteralPath $path).Path -Certificate $certificate -HashAlgorithm SHA256 -TimestampServer "https://timestamp.digicert.com" | Out-Null
    $verified = Get-AuthenticodeSignature -FilePath $path

    if ($verified.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
      throw "Authenticode verification failed for $path. Status: $($verified.Status). Message: $($verified.StatusMessage)"
    }

    if ($verified.SignerCertificate.Thumbprint -ne $certificate.Thumbprint) {
      throw "Unexpected signing certificate for $path. Expected $($certificate.Thumbprint), got $($verified.SignerCertificate.Thumbprint)."
    }

    Write-Host "Verified Authenticode signature: $path ($($verified.SignerCertificate.Thumbprint))"
  }
}
finally {
  if ($certificate) {
    Remove-Item -LiteralPath ("Cert:\CurrentUser\My\" + $certificate.Thumbprint) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -LiteralPath $pfxPath -Force -ErrorAction SilentlyContinue
}
