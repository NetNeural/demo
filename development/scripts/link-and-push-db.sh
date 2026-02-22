#!/bin/bash
# Link Supabase CLI to staging project and apply migration

set -e

cd /workspaces/MonoRepo/development

# Project details
PROJECT_REF="atgbmxicqikmapfqouco"
DB_PASSWORD="${SUPABASE_DB_PASSWORD:-your-db-password}"

echo "🔗 Linking Supabase project..."
echo "   Project: $PROJECT_REF"
echo ""

# Link project (will prompt for password if not set)
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "⚠️  SUPABASE_ACCESS_TOKEN not set"
    echo "   Get it from: https://supabase.com/dashboard/account/tokens"
    echo ""
    exit 1
fi

# Link using access token
npx supabase link --project-ref "$PROJECT_REF"

echo ""
echo "✅ Project linked!"
echo ""
echo "📤 Applying migration..."
npx supabase db push

echo ""
echo "✅ Migration applied successfully!"
