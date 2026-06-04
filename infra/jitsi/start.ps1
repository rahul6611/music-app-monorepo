# Start Jitsi (video calls — web, prosody, jicofo, jvb)
$ErrorActionPreference = "Stop"

$DockerDir = Join-Path $PSScriptRoot "jitsi-docker"
if (-not (Test-Path $DockerDir)) {
  Write-Host "jitsi-docker not found. Run setup first:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1"
  exit 1
}

Set-Location $DockerDir
Write-Host "Starting Jitsi core stack..."
docker compose up -d

Write-Host ""
Write-Host "Done. Check status:"
Write-Host "  docker compose ps"
Write-Host ""
Write-Host "Stop with:"
Write-Host "  docker compose down"
