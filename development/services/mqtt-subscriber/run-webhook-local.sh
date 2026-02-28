#!/bin/bash
# Simple script to run webhook server locally for testing
# This runs in the dev container, not on demo-stage

cd "$(dirname "$0")"

# Generate test token
export RESTART_TOKEN="${RESTART_TOKEN:-test-token-$(openssl rand -hex 16)}"
export WEBHOOK_PORT="${WEBHOOK_PORT:-9999}"
export SERVICE_DIR="${SERVICE_DIR:-$(pwd)}"

echo "🚀 Starting MQTT Restart Webhook (TEST MODE)"
echo "📡 Port: $WEBHOOK_PORT"
echo "🔐 Token: $RESTART_TOKEN"
echo "📁 Service Dir: $SERVICE_DIR"
echo ""
echo "⚠️  This is running locally for testing only!"
echo "   For production, deploy to demo-stage server."
echo ""
echo "Test with:"
echo "  curl http://localhost:$WEBHOOK_PORT/health"
echo "  curl -X POST http://localhost:$WEBHOOK_PORT/restart -H 'X-Restart-Token: $RESTART_TOKEN'"
echo ""

# Run webhook server
node restart-webhook.js
