# Start Jitsi + Jibri (recording — needs extra RAM)
$ErrorActionPreference = "Stop"

$DockerDir = Join-Path $PSScriptRoot "jitsi-docker"
if (-not (Test-Path $DockerDir)) {
  Write-Host "jitsi-docker not found. Run setup first:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1"
  exit 1
}

Write-Host "Preparing Jibri recording scripts + Cloudinary env..."
powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "prepare-recording.ps1")

Set-Location $DockerDir
Write-Host "Starting Jitsi + Jibri..."
docker compose -f docker-compose.yml -f jibri.yml -f ..\jibri-local.yml up -d

# Ensure scripts are executable inside container.
docker exec jitsi-docker-jibri-1 sh -lc "chmod +x /config/finalize-recording.sh /config/upload-to-cloudinary.js"

Write-Host ""
Write-Host "Verify Jibri container:"
docker compose -f docker-compose.yml -f jibri.yml -f ..\jibri-local.yml ps
Write-Host ""
Write-Host "Monitor:"
Write-Host "  docker stats"
Write-Host "  docker compose -f docker-compose.yml -f jibri.yml -f ..\jibri-local.yml logs -f jibri"
Write-Host ""
Write-Host "After a test recording, you should see:"
Write-Host "  [upload] Success: https://res.cloudinary.com/..."
