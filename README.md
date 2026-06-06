# music-app-monorepo


## Running on macOS

# 1) Install
brew install node && brew install --cask docker

# 2) Clone & install app
git clone git@github.com:sohchy/music-app-monorepo-test.git
cd music-app
npm install

# 3) Add env file
# Optional: EXPO_PUBLIC_JITSI_SERVER_URL=https://YOUR_MAC_IP:8443

# 4) Start app
npm run dev
# Then press: w (web) or i (iOS)

# --- JITSI (optional, for self-hosted video) ---
cd infra/jitsi
git clone https://github.com/jitsi/docker-jitsi-meet.git jitsi-docker
cd jitsi-docker
cp env.example .env
./gen-passwords.sh

# Set your Mac IP
export MAC_IP=$(ipconfig getifaddr en0)

# Update .env (quick local setup)
sed -i '' "s|#PUBLIC_URL=.*|PUBLIC_URL=https://${MAC_IP}:8443|" .env
sed -i '' "s|#DOCKER_HOST_ADDRESS=.*|DOCKER_HOST_ADDRESS=${MAC_IP}|" .env
echo "JVB_ADVERTISE_IPS=${MAC_IP}" >> .env
echo "ENABLE_LETSENCRYPT=0" >> .env
echo "ENABLE_AUTH=0" >> .env

mkdir -p ~/.jitsi-meet-cfg/{web,transcripts,prosody/config,prosody/prosody-plugins-custom,jicofo,jvb,jigasi,jibri}
docker compose up -d
docker compose ps

# 5) Test Jitsi in browser
open "https://${MAC_IP}:8443/TestRoom"

# 6) Point app to local Jitsi (in apps/mobile/.env)
# EXPO_PUBLIC_JITSI_SERVER_URL=https://YOUR_MAC_IP:8443
# Then restart:
cd ../../..
cd apps/mobile && npx expo start -c
