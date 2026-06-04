$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$CfgRoot = Join-Path $Root "jitsi-meet-cfg"
$JibriCfg = Join-Path $CfgRoot "jibri"
$ScriptsDir = Join-Path $Root "scripts"
$AppEnv = Join-Path $Root "..\..\apps\mobile\.env"

New-Item -ItemType Directory -Force -Path $JibriCfg | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $JibriCfg "recordings") | Out-Null

Copy-Item -Force (Join-Path $ScriptsDir "finalize-recording.sh") (Join-Path $JibriCfg "finalize-recording.sh")
Copy-Item -Force (Join-Path $ScriptsDir "upload-to-cloudinary.js") (Join-Path $JibriCfg "upload-to-cloudinary.js")

$cloudName = ""
$uploadPreset = ""
$apiKey = ""
$apiSecret = ""
$webhookUrl = ""
if (Test-Path $AppEnv) {
  $lines = Get-Content $AppEnv
  foreach ($line in $lines) {
    if ($line.StartsWith("EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=")) {
      $cloudName = $line.Substring("EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=".Length).Trim()
    }
    if ($line.StartsWith("EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=")) {
      $uploadPreset = $line.Substring("EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=".Length).Trim()
    }
    if ($line.StartsWith("CLOUDINARY_API_KEY=")) {
      $apiKey = $line.Substring("CLOUDINARY_API_KEY=".Length).Trim()
    }
    if ($line.StartsWith("CLOUDINARY_API_SECRET=")) {
      $apiSecret = $line.Substring("CLOUDINARY_API_SECRET=".Length).Trim()
    }
    if ($line.StartsWith("RECORDING_WEBHOOK_URL=")) {
      $webhookUrl = $line.Substring("RECORDING_WEBHOOK_URL=".Length).Trim()
    }
  }
}

$cloudEnvPath = Join-Path $JibriCfg "cloudinary.env"
$existing = @{}
if (Test-Path $cloudEnvPath) {
  foreach ($line in Get-Content $cloudEnvPath) {
    if ($line -match "^\s*#") { continue }
    if ($line -notmatch "=") { continue }
    $pair = $line.Split("=", 2)
    $existing[$pair[0].Trim()] = $pair[1].Trim()
  }
}

if (-not $cloudName -and $existing.ContainsKey("CLOUDINARY_CLOUD_NAME")) {
  $cloudName = $existing["CLOUDINARY_CLOUD_NAME"]
}
if (-not $uploadPreset -and $existing.ContainsKey("CLOUDINARY_UPLOAD_PRESET")) {
  $uploadPreset = $existing["CLOUDINARY_UPLOAD_PRESET"]
}
if (-not $apiKey -and $existing.ContainsKey("CLOUDINARY_API_KEY")) {
  $apiKey = $existing["CLOUDINARY_API_KEY"]
}
if (-not $apiSecret -and $existing.ContainsKey("CLOUDINARY_API_SECRET")) {
  $apiSecret = $existing["CLOUDINARY_API_SECRET"]
}
if (-not $webhookUrl -and $existing.ContainsKey("RECORDING_WEBHOOK_URL")) {
  $webhookUrl = $existing["RECORDING_WEBHOOK_URL"]
}

# Write with Unix LF endings — this file is sourced inside the Linux Jibri
# container, and CRLF would leave stray \r chars in env values.
$cloudEnvLines = @(
  "CLOUDINARY_CLOUD_NAME=$cloudName"
  "CLOUDINARY_UPLOAD_PRESET=$uploadPreset"
  "CLOUDINARY_API_KEY=$apiKey"
  "CLOUDINARY_API_SECRET=$apiSecret"
  "RECORDING_WEBHOOK_URL=$webhookUrl"
  "# If upload preset is unsigned, API key/secret can stay empty."
)
[System.IO.File]::WriteAllText($cloudEnvPath, ($cloudEnvLines -join "`n") + "`n")

Write-Host "Prepared Jibri recording files:"
Write-Host "  $JibriCfg\finalize-recording.sh"
Write-Host "  $JibriCfg\upload-to-cloudinary.js"
Write-Host "  $JibriCfg\cloudinary.env"
