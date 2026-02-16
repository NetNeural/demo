#!/bin/bash

# Deploy webhook fix to staging for Issue #1
# Run from development/ directory

echo "🚀 Deploying integration-webhook edge function to staging..."
echo ""

npx supabase functions deploy integration-webhook \
  --project-ref atgbmxicqikmapfqouco \
  --no-verify-jwt

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Deployment successful!"
  echo ""
  echo "Next steps:"
  echo "1. Run cleanup SQL in Supabase SQL Editor:"
  echo "   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql"
  echo ""
  echo "2. Copy SQL from: docs/fix-duplicate-devices-issue-1.sql"
  echo ""
  echo "3. Verify: https://demo-stage.netneural.ai/dashboard/devices/"
  echo "   - M260600005 should appear only once"
  echo "   - M260600008 should appear only once"
else
  echo ""
  echo "❌ Deployment failed"
  echo ""
  echo "Alternative: Deploy via Supabase Dashboard"
  echo "https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/functions"
fi
