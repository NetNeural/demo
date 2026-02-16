#!/bin/bash

# Import Sensor Telemetry Data from Production to Staging
# 
# Usage: 
#   ./scripts/import-sensor-data.sh
#
# Required Environment Variables:
#   PROD_SUPABASE_URL - Production Supabase URL
#   PROD_SUPABASE_SERVICE_ROLE_KEY - Production service role key
#   STAGE_SUPABASE_SERVICE_ROLE_KEY - Staging service role key
#
# Optional:
#   DAYS_TO_IMPORT - Number of days of history (default: 30)

set -e

cd "$(dirname "$0")/.."

echo "🔐 Checking for required credentials..."

if [ -z "$PROD_SUPABASE_URL" ]; then
  echo "❌ Missing PROD_SUPABASE_URL"
  echo ""
  echo "Usage:"
  echo "  export PROD_SUPABASE_URL='https://yourproject.supabase.co'"
  echo "  export PROD_SUPABASE_SERVICE_ROLE_KEY='your-prod-service-role-key'"
  echo "  export STAGE_SUPABASE_SERVICE_ROLE_KEY='your-stage-service-role-key'"
  echo "  ./scripts/import-sensor-data.sh"
  exit 1
fi

if [ -z "$PROD_SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing PROD_SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

if [ -z "$STAGE_SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Missing STAGE_SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

# Default staging URL
export STAGE_SUPABASE_URL="${STAGE_SUPABASE_URL:-https://atgbmxicqikmapfqouco.supabase.co}"

# Default days to import
export DAYS_TO_IMPORT="${DAYS_TO_IMPORT:-30}"

echo "✅ Credentials verified"
echo ""
echo "🚀 Starting import..."
echo ""

# Run the Node.js script
node scripts/import-sensor-data-prod-to-stage.js

echo ""
echo "✅ Import script completed!"
