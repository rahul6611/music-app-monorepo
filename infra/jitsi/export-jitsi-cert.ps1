# Copy Jitsi web TLS cert into app assets (optional extra trust)
$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$CertSrc = Join-Path $Root "jitsi-meet-cfg\web\keys\cert.crt"
$DestDir = Join-Path $Root "..\..\apps\mobile\assets\certs"
$Dest = Join-Path $DestDir "jitsi_meet_ca.crt"

if (-not (Test-Path $CertSrc)) {
  Write-Host "Cert not found. Start Jitsi once first:"
  Write-Host "  cd infra\jitsi"
  Write-Host "  .\start.ps1"
  Write-Host "Expected: $CertSrc"
  exit 1
}

New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
Copy-Item -Force $CertSrc $Dest
Write-Host "Copied to $Dest"
