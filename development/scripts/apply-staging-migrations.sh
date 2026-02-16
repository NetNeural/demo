#!/bin/bash
# Apply pending migrations to staging Supabase database
# Run this script to sync local migrations to the staging environment

set -e

echo "🔗 Connecting to staging Supabase..."
echo "Project ID: atgbmxicqikmapfqouco"
echo ""

# Check if SUPABASE_ACCESS_TOKEN is set
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌ Error: SUPABASE_ACCESS_TOKEN environment variable not set"
  echo ""
  echo "To set it, run:"
  echo "  export SUPABASE_ACCESS_TOKEN=your_token_here"
  echo ""
  echo "Get your token from: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "📤 Linking to staging project..."
npx supabase link --project-ref atgbmxicqikmapfqouco

echo ""
echo "📋 Checking migration status..."
npx supabase migration list

echo ""
echo "🚀 Pushing migrations to staging database..."
npx supabase db push

echo ""
echo "✅ Migrations applied successfully!"
echo ""
echo "📝 Generating TypeScript types..."
npx supabase gen types typescript --linked > src/lib/database.types.ts

echo ""
echo "✅ All done! Staging database is now up to date."
