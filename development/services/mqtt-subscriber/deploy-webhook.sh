#!/bin/bash
set -e

# Configuration
SERVER_HOST="${MQTT_SERVER_HOST:-demo-stage.netneural.ai}"
SERVER_USER="${MQTT_SERVER_USER:-root}"
SERVER_DIR="/opt/mqtt-subscriber"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Deploying MQTT Restart Webhook"
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
    echo "To setup SSH access, add your key:"
    echo "  ssh-copy-id $SERVER_USER@$SERVER_HOST"
    exit 1
fi

echo "✅ SSH connection successful"
echo ""

# Generate restart token
echo "🔐 Generating restart token..."
RESTART_TOKEN=$(openssl rand -hex 32)
echo "Token: $RESTART_TOKEN"
echo ""
echo "⚠️  SAVE THIS TOKEN! You'll need it for Supabase secrets."
echo ""

# Create temporary service file with token
TEMP_SERVICE=$(mktemp)
sed "s/__REPLACE_WITH_SECRET_TOKEN__/$RESTART_TOKEN/" "$LOCAL_DIR/restart-webhook.service" > "$TEMP_SERVICE"

echo "📦 Copying files to server..."
# Copy webhook script
scp "$LOCAL_DIR/restart-webhook.js" "$SERVER_USER@$SERVER_HOST:$SERVER_DIR/"
# Copy systemd service
scp "$TEMP_SERVICE" "$SERVER_USER@$SERVER_HOST:/tmp/restart-webhook.service"
rm "$TEMP_SERVICE"

echo "⚙️  Configuring systemd service..."
ssh "$SERVER_USER@$SERVER_HOST" bash <<'ENDSSH'
    set -e
    
    # Install service
    sudo mv /tmp/restart-webhook.service /etc/systemd/system/
    sudo chmod 644 /etc/systemd/system/restart-webhook.service
    
    # Reload and start
    sudo systemctl daemon-reload
    sudo systemctl enable restart-webhook
    sudo systemctl restart restart-webhook
    
    # Wait for startup
    sleep 2
    
    # Check status
    sudo systemctl status restart-webhook --no-pager || true
    
    echo ""
    echo "🔍 Testing webhook..."
    curl -s http://localhost:9999/health || echo "❌ Webhook not responding"
ENDSSH

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Set the token in Supabase:"
echo "   cd /workspaces/MonoRepo/development"
echo "   npx supabase secrets set MQTT_RESTART_TOKEN=\"$RESTART_TOKEN\""
echo ""
echo "2. Deploy Edge Function:"
echo "   npx supabase functions deploy restart-mqtt-service --no-verify-jwt"
echo ""
echo "3. Deploy frontend:"
echo "   gh workflow run deploy-staging.yml -f force_deploy=true"
echo ""
echo "4. Test the webhook externally:"
echo "   curl http://$SERVER_HOST:9999/health"
echo ""

# Save token to file for reference (optional)
echo "$RESTART_TOKEN" > .restart-token.secret
echo "💾 Token saved to: .restart-token.secret (gitignored)"
echo "   Delete this file after setting in Supabase!"
