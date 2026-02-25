#!/bin/bash
# NetNeural MQTT Subscriber - Fresh Server Setup
# Run this as root on a fresh Ubuntu 22.04 droplet:
#   curl -sSL <raw-url> | bash
# Or: scp setup-server.sh root@<new-ip>:~ && ssh root@<new-ip> bash setup-server.sh

set -e

echo "🚀 Setting up NetNeural MQTT Subscriber..."

# ── 1. System packages ────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq git curl docker.io docker-compose npm nodejs

# Use Node 20 if system node is old
node_version=$(node --version 2>/dev/null | cut -d. -f1 | tr -d 'v')
if [ "${node_version:-0}" -lt 18 ]; then
  echo "Installing Node 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

# ── 2. Clone repo ─────────────────────────────────────────────────
DEPLOY_DIR="/opt/mqtt-subscriber"
if [ -d "$DEPLOY_DIR" ]; then
  echo "Directory exists, pulling latest..."
  git -C "$DEPLOY_DIR" pull
else
  echo "Cloning repo..."
  git clone https://github.com/NetNeural/MonoRepo-Staging.git /tmp/monorepo
  mkdir -p "$DEPLOY_DIR"
  cp -r /tmp/monorepo/development/services/mqtt-subscriber/. "$DEPLOY_DIR/"
  rm -rf /tmp/monorepo
fi

# ── 3. Install dependencies ───────────────────────────────────────
cd "$DEPLOY_DIR"
npm install --omit=dev

# ── 4. Write .env ─────────────────────────────────────────────────
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  cat > "$DEPLOY_DIR/.env" <<ENV
SUPABASE_URL=https://atgbmxicqikmapfqouco.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SUPABASE_KEY>
LOG_LEVEL=info
SERVICE_DIR=/opt/mqtt-subscriber
RESTART_POLL_INTERVAL=30
ENV
  echo "✅ .env created"
else
  echo "⚠️  .env already exists, skipping"
fi

# ── 5. Start via PM2 ──────────────────────────────────────────────
cd "$DEPLOY_DIR"
pm2 delete mqtt-subscriber 2>/dev/null || true
pm2 delete restart-monitor 2>/dev/null || true

# Load env vars for PM2
export $(grep -v '^#' .env | xargs)

pm2 start src/index.ts --name mqtt-subscriber \
  --interpreter /usr/bin/npx \
  --interpreter-args "ts-node" \
  -- \
  || pm2 start dist/index.js --name mqtt-subscriber

pm2 start restart-monitor.js --name restart-monitor

pm2 save
pm2 startup | tail -1 | bash  # enable on reboot

echo ""
echo "✅ Setup complete!"
echo ""
pm2 status
echo ""
echo "Useful commands:"
echo "  pm2 logs mqtt-subscriber   # view live logs"
echo "  pm2 logs restart-monitor   # view restart monitor logs"
echo "  pm2 restart mqtt-subscriber"
