#!/bin/bash
# Deploy MQTT VMark Parser Fixes to GitHub

set -e

echo "🔧 Deploying MQTT VMark Parser Fixes..."
echo ""

# Check if we're in the right directory
if [ ! -d "development/services/mqtt-subscriber" ]; then
    echo "❌ Error: Not in MonoRepo root directory"
    exit 1
fi

# Show what changed
echo "📝 Files modified:"
git status --short

echo ""
echo "📦 Committing changes..."
git add development/services/mqtt-subscriber/src/message-processor.ts
git add development/diagnose-mqtt-integration.sql
git add development/MQTT_VMARK_PARSER_FIX.md

git commit -m "fix(mqtt): VMark protocol parser for device 2400390030314701

- Fixed parseVMarkMessage to read from 'paras' field (not 'data')
- Fixed extractDeviceId to check 'device' field first
- Added VMark timestamp parsing (YYYY-MM-DD_HH:MM:SS.mmm format)
- Added diagnostic SQL queries
- Resolves log display issue in integration dashboard

Fixes: https://demo-stage.netneural.ai/dashboard/integrations/view/?id=a6d0e905-0532-4178-9ed0-2aae24a896f6"

echo "✅ Changes committed!"
echo ""
echo "🚀 Pushing to GitHub..."
git push origin main

echo ""
echo "✅ Code pushed successfully to GitHub!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  DEPLOYMENT REQUIRED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The MQTT subscriber service is a backend service that needs"
echo "to be deployed separately from the frontend."
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. SSH into your staging server:"
echo "   ssh your-staging-server"
echo ""
echo "2. Navigate to the MQTT subscriber directory:"
echo "   cd /path/to/MonoRepo/development/services/mqtt-subscriber"
echo ""
echo "3. Pull the latest code:"
echo "   git pull origin main"
echo ""
echo "4. Rebuild and restart the Docker container:"
echo "   docker-compose down"
echo "   docker-compose build"
echo "   docker-compose up -d"
echo ""
echo "5. Verify it's running:"
echo "   docker-compose logs -f mqtt-subscriber"
echo ""
echo "6. Test with your device (2400390030314701):"
echo "   - Send a test message from your MQTT device"
echo "   - Check dashboard: https://demo-stage.netneural.ai/dashboard/integrations/view/?id=a6d0e905-0532-4178-9ed0-2aae24a896f6"
echo ""
echo "7. Run diagnostic query (optional):"
echo "   - Open Supabase SQL Editor"
echo "   - Run: development/diagnose-mqtt-integration.sql"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
