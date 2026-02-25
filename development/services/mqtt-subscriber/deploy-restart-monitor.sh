#!/bin/bash
# Deploy restart-monitor.js to demo-stage server
# Run this script from your local machine with SSH access to demo-stage

set -e

# Configuration
SERVER_HOST="${MQTT_SERVER_HOST:-demo-stage.netneural.ai}"
SERVER_USER="${MQTT_SERVER_USER:-root}"
SERVER_DIR="/opt/mqtt-subscriber"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Deploying MQTT Restart Monitor"
echo "📡 Target: $SERVER_USER@$SERVER_HOST:$SERVER_DIR"
echo ""

# Check if we can reach the server
echo "🔍 Testing SSH connection..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$SERVER_USER@$SERVER_HOST" "echo 'SSH OK'" 2>/dev/null; then
    echo "❌ Cannot connect to $SERVER_HOST"
    echo ""
    echo "Please ensure:"
    echo "  1. You have SSH access configured"
    echo "  2. The server is reachable"
    echo "  3. SSH key is authorized"
    echo ""
    echo "Alternative: Copy files manually using console access"
    echo ""
    echo "Files to copy:"
    echo "  1. restart-monitor.js → $SERVER_DIR/"
    echo "  2. docker-compose.yml → $SERVER_DIR/"
    echo "  3. package.json → $SERVER_DIR/"
    echo ""
    echo "Then run on server:"
    echo "  cd $SERVER_DIR"
    echo "  npm install"
    echo "  docker-compose up -d --force-recreate"
    exit 1
fi

echo "✅ SSH connection successful"
echo ""

# Copy restart monitor
echo "📦 Copying restart-monitor.js..."
scp "$LOCAL_DIR/restart-monitor.js" "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/"

# Copy updated docker-compose.yml
echo "📦 Copying docker-compose.yml..."
scp "$LOCAL_DIR/docker-compose.yml" "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/"

# Copy package.json (for dependencies)
echo "📦 Copying package.json..."
scp "$LOCAL_DIR/package.json" "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/"

echo ""
echo "⚙️  Installing dependencies and restarting services..."
ssh "$SERVER_USER@$SERVER_HOST" bash <<'ENDSSH'
    set -e
    cd /opt/mqtt-subscriber
    
    echo "📦 Installing dependencies..."
    npm install
    
    echo "🔄 Restarting services with new configuration..."
    docker-compose up -d --force-recreate
    
    echo ""
    echo "⏳ Waiting for services to start..."
    sleep 5
    
    echo "🔍 Checking service status..."
    docker-compose ps
    
    echo ""
    echo "📋 Recent logs:"
    docker-compose logs --tail=20
ENDSSH

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Verify deployment:"
echo "  1. Check logs: docker-compose logs -f restart-monitor"
echo "  2. Test button: https://demo-stage.netneural.ai/dashboard/support"
echo "  3. View database: service_restart_requests table"
echo ""
echo "🎯 The 'Request Restart' button should now work!"
