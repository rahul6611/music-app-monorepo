# Multi-Device Load Testing Guide

Use this protocol to evaluate Jitsi stability, lag, and server CPU before production.

## Test matrix

| Device | Browser/App | Network | Role |
|--------|-------------|---------|------|
| Laptop | Chrome (web) | WiFi | Instructor + moderator |
| Desktop | Firefox (web) | Ethernet | Student |
| Phone | Musiki app (native WebView) | LTE/5G | Student |
| Tablet | Musiki app or Safari | WiFi | Student |
| Second phone | Expo web in mobile browser | Cellular | Observer |

## Setup

1. Deploy Jitsi (or use `meet.jit.si` for connectivity-only tests).
2. Create a practice plan in Musiki → tap **Join Live Class**.
3. Share the room name (shown in class header) with testers on other devices.
4. On the server, run `docker stats` in a separate terminal.

## Test scenarios

### Scenario A — Baseline (2 participants)

- Instructor + 1 student join with video + audio.
- Speak/play instrument for 2 minutes.
- **Measure:** Can both hear each other? Video sync acceptable?

### Scenario B — Scale up (5 participants)

- Add 3 more devices one at a time, 30 seconds apart.
- **Measure:** `docker stats` CPU on `jvb` container, subjective A/V lag.

### Scenario C — Recording under load

- With 3+ participants, instructor starts recording (self-hosted only).
- Continue 5 minutes.
- **Measure:** Jibri CPU/RAM (`docker stats jibri`), recording completes without drop.

### Scenario D — Content panel stress

- Toggle the **Content** side panel while video is active.
- Scroll through raag/exercise items.
- **Measure:** UI jank on mobile, meeting stays connected.

### Scenario E — Network degradation

- One participant switches WiFi → cellular mid-call.
- **Measure:** Reconnect time, audio continuity.

## Metrics to record

| Metric | How to capture |
|--------|----------------|
| Server CPU % | `docker stats --no-stream` every 30s |
| Server RAM | Same |
| Join time | Stopwatch from tap Join → video visible |
| End-to-end lag | Clap test — delay heard on remote device |
| Disconnects | Count unexpected drops in 10 min |
| Recording upload | Cloudinary URL returned? File size reasonable? |

## Sample log template

```
Date: ___________
Server: DO 8GB / meet.jit.si
Participants: ___

Join times:  Laptop __s  Phone __s  Tablet __s
Peak JVB CPU: ___%
Peak RAM: ___ GB
Disconnects: ___
Lag (clap test): ___ ms (subjective: low/medium/high)
Recording: pass/fail — URL: ___________
Notes: ___________
```

## Expected rough benchmarks (self-hosted 8 vCPU / 16 GB)

| Participants | JVB CPU (approx) | Notes |
|--------------|------------------|-------|
| 2 | 5–15% | Smooth |
| 5 | 15–35% | Good on 720p |
| 10 | 40–70% | Consider 720p cap |
| 10 + recording | +1 Jibri @ 60–80% CPU | Needs separate Jibri or bigger droplet |

Public `meet.jit.si` won't reflect your production CPU — always re-test on your own server.

## Known prototype limitations

- Native app uses WebView (not `@jitsi/react-native-sdk`) for RN version compatibility — slightly higher latency than native SDK.
- Recording requires self-hosted Jibri; public server won't upload to Cloudinary.
- Expo Go won't work — use `expo run:android` / `expo run:ios` or web.
