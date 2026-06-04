# Jitsi private server — Android APK + Web test (step by step)

## What must be true

| # | Requirement |
|---|-------------|
| 1 | Docker Desktop **Running** |
| 2 | Jitsi containers **up** (`.\start.ps1`) |
| 3 | Phone + laptop on **same Wi-Fi** |
| 4 | `apps/mobile/.env` has `EXPO_PUBLIC_JITSI_SERVER_URL=https://YOUR_PC_IP:8443` |
| 5 | APK built **after** `.env` change + `expo prebuild` |

---

## Part A — Start private Jitsi (PC)

```powershell
cd "E:\Projects\Expo React Native\music-app\infra\jitsi"
.\start.ps1
```

Check:

```powershell
cd jitsi-docker
docker compose ps
```

All should be **running**.

Browser test (laptop):

1. Open `https://192.168.29.138:8443` (use **your** IP from `ipconfig`)
2. **Advanced** → **Proceed** (self-signed cert)
3. You must see Jitsi home — **not** “WebRTC not available”

---

## Part B — Build Android APK (correct way)

### 1. Set server URL in `.env`

`apps/mobile/.env`:

```
EXPO_PUBLIC_JITSI_SERVER_URL=https://192.168.29.138:8443
```

Replace `192.168.29.138` with your PC IPv4 from `ipconfig`.

### 2. Apply Android SSL fix + WebView patch (required for private HTTPS)

```powershell
cd "E:\Projects\Expo React Native\music-app\apps\mobile"
npx expo prebuild --platform android --clean
```

This patches `react-native-webview` to trust **192.168.x.x** Jitsi self-signed certs (fixes "certificate authority is not trusted").

Optional — copy Jitsi cert:
```powershell
cd "E:\Projects\Expo React Native\music-app\infra\jitsi"
powershell -ExecutionPolicy Bypass -File .\export-jitsi-cert.ps1
npx expo prebuild --platform android
```

### 3. Build release APK

```powershell
cd android
.\gradlew assembleRelease
```

APK:

```
apps\mobile\android\app\build\outputs\apk\release\app-release.apk
```

Install on phone.

---

## Part C — Use app (Android)

1. Open **Musiki** → log in  
2. Tab **Students** or **Class**  
3. (Instructor) select student if needed  
4. On a practice plan card → **Join Live Class**  
5. Allow **Camera** + **Microphone**  
6. Wait for video UI (Jitsi inside app)  
7. Tap **copy icon** (top right) → link copied  

Example link:

```
https://192.168.29.138:8443/MusikiClassXXXX#config.prejoinPageEnabled=false&...
```

---

## Part D — Second device (laptop browser)

1. Paste copied link in **Chrome**  
2. Accept certificate if asked  
3. Allow camera + mic  
4. You should see **2 participants** (phone + laptop)

---

## Part E — Web app (optional, same machine)

```powershell
cd "E:\Projects\Expo React Native\music-app\apps\mobile"
npm run web
```

Open Expo URL → **Students/Class** → **Join Live Class**.

---

## If Android shows red error box

| Message | Fix |
|---------|-----|
| SSL / certificate not trusted | **Must** run `npx expo prebuild --platform android --clean` then rebuild APK |
| HTTP / WebRTC | URL must be **https://** port **8443** |
| Wrong server | Rebuild APK after changing `.env` |
| Tap to retry | Switches embed mode — try both |

---

## Re-check IP changed

```powershell
cd "E:\Projects\Expo React Native\music-app\infra\jitsi"
powershell -ExecutionPolicy Bypass -File .\setup-windows.ps1
.\start.ps1
```

Update `.env`, `expo prebuild`, `gradlew assembleRelease` again.

---

## Quick checklist

- [ ] `https://IP:8443` works in Chrome on laptop  
- [ ] Docker `docker compose ps` all running  
- [ ] APK installed after latest build  
- [ ] Phone on same Wi-Fi as PC  
- [ ] Join Live Class → video works  
- [ ] Copy link → open on laptop → 2-way audio/video  
