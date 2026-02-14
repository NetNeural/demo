#!/bin/bash

# Fix Production RLS Circular Dependency Issue
# This script applies the RLS fix migration to production

set -e

echo "🔧 Fixing RLS Circular Dependency in Production"
echo "================================================"
echo ""

# Check if we have production credentials
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing production credentials"
    echo ""
    echo "Please set the following environment variables:"
    echo "  export NEXT_PUBLIC_SUPABASE_URL=https://atgbmxicqikmapfqouco.supabase.co"
    echo "  export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
    echo ""
    echo "Or source your .env.production file:"
    echo "  source .env.production"
    exit 1
fi

echo "✅ Production credentials found"
echo "   URL: $NEXT_PUBLIC_SUPABASE_URL"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo ""
    echo "Install it with:"
    echo "  npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Link to production (if not already linked)
echo "🔗 Linking to production project..."
if ! supabase link --project-ref atgbmxicqikmapfqouco 2>&1 | grep -q "already linked"; then
    echo "✅ Linked to production"
else
    echo "✅ Already linked to production"
fi
echo ""

# Show pending migrations
echo "📋 Checking migration status..."
supabase migration list --linked
echo ""

# Apply the RLS fix migration
echo "🚀 Applying RLS fix migration..."
supabase db push --linked

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🎉 FIX COMPLETE"
    echo ""
    echo "The circular dependency in users table RLS policies has been fixed."
    echo ""
    echo "Try logging in again:"
    echo "  URL: https://demo-stage.netneural.ai"
    echo "  Email: admin@netneural.com"
    echo "  Password: password123"
    echo ""
    echo "Clear your browser cache or use incognito mode for best results."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo ""
    echo "❌ Migration failed"
    echo ""
    echo "Please check the error above and try again."
    exit 1
fi
