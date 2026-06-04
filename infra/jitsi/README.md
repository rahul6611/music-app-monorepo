# Jitsi Self-Hosted Setup (Musiki Prototype)

This folder contains everything needed to run your own Jitsi Meet server with recording (Jibri) and automatic Cloudinary upload.

## Why self-host?

| Feature | meet.jit.si (public) | Self-hosted |
|---------|------------------------|-------------|
| Video calls | Yes | Yes |
| Custom domain/branding | No | Yes |
| Recording to Cloudinary | No | Yes (via Jibri) |
| Load/CPU testing | Shared, unreliable | Your own metrics |
| Custom UI in app | Yes (iframe/WebView) | Yes |

The app defaults to `meet.jit.si` for quick prototyping. Switch to your server once deployed.

---

## Local setup (Docker)

### Prerequisites

- Docker + Docker Compose v2
- 4 GB RAM minimum (8 GB+ recommended with Jibri)
- A domain pointing to your server (production) OR `localhost` + `/etc/hosts` trick for local dev

### 1. Clone official Jitsi Docker stack

```bash
cd infra/jitsi
git clone https://github.com/jitsi/docker-jitsi-meet.git jitsi-docker
cd jitsi-docker
cp env.example .env
```

### 2. Configure `.env`

Copy values from `.env.example` in this folder, or set at minimum:

```bash
# Public URL users will open (use your DigitalOcean IP/domain in production)
PUBLIC_URL=https://meet.yourdomain.com

# Strong passwords — run ./gen-passwords.sh after editing
ENABLE_AUTH=0          # set 1 + configure for production
ENABLE_RECORDING=1
ENABLE_TRANSCRIPTIONS=0

# Recording output
JIBRI_RECORDING_DIR=/config/recordings
JIBRI_FINALIZE_RECORDING_SCRIPT_PATH=/config/finalize-recording.sh
```

Run `./gen-passwords.sh` inside `jitsi-docker/` to generate secrets.

### 3. Add recording + Cloudinary scripts

Copy scripts from this repo into the Jibri config volume:

```bash
mkdir -p ~/.jitsi-meet-cfg/jibri
cp ../scripts/finalize-recording.sh ~/.jitsi-meet-cfg/jibri/
cp ../scripts/upload-to-cloudinary.js ~/.jitsi-meet-cfg/jibri/
chmod +x ~/.jitsi-meet-cfg/jibri/finalize-recording.sh
```

Create `~/.jitsi-meet-cfg/jibri/cloudinary.env`:

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_UPLOAD_PRESET=your_unsigned_or_signed_preset
# Optional: POST recording URL back to your backend
RECORDING_WEBHOOK_URL=
```

### 4. Start services

```bash
# Core stack only (no recording)
docker compose up -d

# With Jibri recording (needs extra RAM — see requirements below)
docker compose -f docker-compose.yml -f jibri.yml up -d
```

### Windows shortcut scripts (recommended)

From `infra/jitsi`:

```powershell
# Core video call services
.\start.ps1

# Recording + Cloudinary (auto-prepares scripts/env before startup)
.\start-with-recording.ps1
```

### 5. Point the app at your server

In `apps/mobile/.env`:

```
EXPO_PUBLIC_JITSI_SERVER_URL=https://meet.yourdomain.com
```

Restart Expo after changing env vars.

---

## DigitalOcean deployment

When you're ready to spin up a server:

| Spec | Minimum | Recommended (5–10 concurrent users) |
|------|---------|-------------------------------------|
| Droplet | 4 vCPU / 8 GB | 8 vCPU / 16 GB |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Disk | 80 GB SSD | 160 GB SSD |

**Steps:**

1. Create droplet, open ports **80, 443, 10000/udp** (JVB media).
2. Point DNS `meet.yourdomain.com` → droplet IP.
3. SSH in, install Docker, clone `docker-jitsi-meet`, configure `.env` with real domain + TLS (Let's Encrypt via Jitsi docker config).
4. Copy Jibri scripts, set Cloudinary env.
5. Start with `docker compose -f docker-compose.yml -f jibri.yml up -d`.
6. Set `EXPO_PUBLIC_JITSI_SERVER_URL` in the app.

**Jibri note:** One Jibri instance = one simultaneous recording. For multiple concurrent recorded classes, run multiple Jibri containers or a separate Jibri droplet (4 vCPU / 8 GB each).

---

## Recording flow

```
Instructor clicks Record in Jitsi
        ↓
Jibri joins as hidden participant, encodes MP4
        ↓
finalize-recording.sh runs on completion
        ↓
upload-to-cloudinary.js uploads video
        ↓
(Optional) webhook POST with secure_url → Firestore classAssignment.recordingUrl
```

Moderators see the record button when `ENABLE_RECORDING=1` and Jibri is connected.

---

## Monitoring CPU / stability (multi-device test)

See [LOAD_TESTING.md](./LOAD_TESTING.md) for the full multi-device test protocol.

Quick checks on the server:

```bash
# Overall CPU/RAM while people join
docker stats

# JVB (video bridge) logs
docker compose logs -f jvb

# Jibri during recording
docker compose logs -f jibri
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| No record button | `ENABLE_RECORDING=1`, Jibri running, user is moderator |
| Recording fails | Jibri needs 8 GB RAM; check `docker compose logs jibri` |
| Mobile can't join | Ensure UDP 10000 open; try `config.resolution=720` |
| WebView mic/camera blocked | Grant permissions in app settings; use dev client not Expo Go |
| High lag with 5+ users | Upgrade droplet; check `docker stats jvb` CPU |
