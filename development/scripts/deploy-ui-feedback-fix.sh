#!/bin/bash
# ============================================================================
# Deploy UI Feedback Fix to Staging
# ============================================================================
# Deploys migration and updated edge functions to fix false "500 errors"
# in the UI by properly populating device count metadata
# ============================================================================

set -e

echo "🚀 Deploying UI Feedback Fix to Staging..."
echo ""

PROJECT_REF="atgbmxicqikmapfqouco"

# Step 1: Apply database migration
echo "📊 Step 1: Applying database migration..."
echo "Please run the following SQL in Supabase SQL Editor:"
echo "https://supabase.com/dashboard/project/${PROJECT_REF}/sql"
echo ""
echo "SQL to run:"
cat supabase/migrations/20260215000001_add_device_counts_to_activity_log.sql
echo ""
read -p "Press Enter after running the migration..."

# Step 2: Deploy updated edge functions
echo ""
echo "🔧 Step 2: Deploying updated edge functions..."
echo ""

# These functions use the updated activity-logger.ts and base-integration-client.ts
FUNCTIONS=(
  "device-sync"
  "auto-sync-cron"
  "integration-webhook"
)

for func in "${FUNCTIONS[@]}"; do
  echo "Deploying $func..."
  npx supabase functions deploy "$func" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt || {
      echo "❌ Failed to deploy $func via CLI"
      echo "Please deploy manually via Supabase Dashboard:"
      echo "https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
      echo ""
      read -p "Press Enter after deploying $func manually..."
    }
  echo "✅ $func deployed"
  echo ""
done

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Next steps:"
echo "1. Go to staging dashboard: https://atgbmxicqikmapfqouco.supabase.co"
echo "2. Navigate to Integrations → Golioth"
echo "3. Click 'Manual Sync' → 'Bidirectional Sync'"
echo "4. UI should now show: '✅ Synced 18 devices' instead of false errors"
echo ""
