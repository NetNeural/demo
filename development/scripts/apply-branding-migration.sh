#!/bin/bash
# Apply organization branding storage migration to staging database

set -e

echo "Applying organization branding storage migration..."

# Source the environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Use STAGE_SUPABASE_SERVICE_ROLE_KEY environment variable
PGPASSWORD="${STAGE_SUPABASE_SERVICE_ROLE_KEY}" psql \
  -h aws-0-us-east-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.atgbmxicqikmapfqouco \
  -d postgres \
  -f supabase/migrations/20260216000000_organization_branding_storage.sql

echo "✅ Migration applied successfully!"
echo ""
echo "Storage bucket 'organization-assets' created with policies:"
echo "  - Public read access for all authenticated users"
echo "  - Upload/update/delete access for organization owners only"
echo ""
echo "Test the feature at: https://demo-stage.netneural.ai/dashboard/organizations/?tab=settings"
