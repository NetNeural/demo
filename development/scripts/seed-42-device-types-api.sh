#!/bin/bash
# Seed 42 device types via Supabase REST API
# Converts the SQL seed data to API calls

SUPABASE_URL="https://atgbmxicqikmapfqouco.supabase.co"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
ORG_ID="00000000-0000-0000-0000-000000000001"

# First, clear existing device types
echo "🧹 Clearing existing device types for org ${ORG_ID}..."
curl -X DELETE "${SUPABASE_URL}/rest/v1/device_types?organization_id=eq.${ORG_ID}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json"

echo -e "\n\n🌱 Seeding 42 device types..."

# Parse SQL file and convert to JSON array for bulk insert
SQL_FILE="scripts/seed-device-types.sql"

# For now, let's use the JavaScript approach with extracted data
node scripts/seed-42-types.js

