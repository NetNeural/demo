#!/bin/bash
# Trigger production Golioth device sync manually

# Get service role key from GitHub secrets
SERVICE_ROLE_KEY=$(gh secret get SUPABASE_SERVICE_ROLE_KEY)

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ Could not retrieve SUPABASE_SERVICE_ROLE_KEY from GitHub secrets"
  exit 1
fi

echo "🚀 Triggering production device sync..."
echo "Integration ID: 02152062-3010-4313-9277-4fd7c4640cf3"
echo "Organization ID: 11ec1e5c-a9df-4313-8ca3-15675f35f673"
echo ""

curl -X POST "https://bldojxpockljyivldxwf.supabase.co/functions/v1/device-sync" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "integrationId": "02152062-3010-4313-9277-4fd7c4640cf3",
    "organizationId": "11ec1e5c-a9df-4313-8ca3-15675f35f673",
    "operation": "import"
  }' | jq '.'

echo ""
echo "✅ Sync request completed"
