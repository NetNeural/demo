#!/bin/bash

# Quick RLS Fix for Production
# This applies the RLS circular dependency fix to the correct project

set -e

PROJECT_REF="atgbmxicqikmapfqouco"

echo "🔧 Quick Fix: RLS Circular Dependency"
echo "======================================"
echo ""
echo "Target Project: $PROJECT_REF"
echo ""

cd "$(dirname "$0")/.."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo ""
    echo "Install it with:"
    echo "  npm install -g supabase"
    exit 1
fi

# Link to production
echo "🔗 Linking to production project: $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF" || {
    echo ""
    echo "⚠️  If you see 'already linked to a different project', run:"
    echo "   supabase unlink"
    echo "   Then try again"
    exit 1
}

echo ""
echo "✅ Linked successfully"
echo ""

# Apply migrations
echo "🚀 Applying RLS fix migration..."
echo ""
supabase db push --linked

if [ $? -eq 0 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ SUCCESS! RLS Fix Applied"
    echo ""
    echo "The circular dependency has been fixed."
    echo ""
    echo "Next steps:"
    echo "1. Clear browser cache or use incognito mode"
    echo "2. Try logging in again at demo-stage.netneural.ai"
    echo "   Email: admin@netneural.com"
    echo "   Password: password123"
    echo ""
    echo "If you still have issues, run:"
    echo "   node scripts/fix-production-user.js"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo ""
    echo "❌ Failed to apply migration"
    echo ""
    echo "Check the error above. Common issues:"
    echo "- Not logged in to Supabase: Run 'supabase login'"
    echo "- Wrong project: Verify project ref is $PROJECT_REF"
    echo "- Permission denied: Check your Supabase access token"
    exit 1
fi
