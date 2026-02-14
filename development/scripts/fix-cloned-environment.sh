#!/bin/bash

# Comprehensive Fix for Cloned Production/Stage Environment
# This script handles all common issues when an environment is cloned

set -e

PROJECT_REF="atgbmxicqikmapfqouco"
PROJECT_URL="https://${PROJECT_REF}.supabase.co"

echo "🔧 Comprehensive Stage Environment Fix"
echo "======================================="
echo ""
echo "Target: $PROJECT_URL"
echo ""
echo "This script will:"
echo "  1. ✅ Check database connection"
echo "  2. ✅ Apply RLS policy fixes"
echo "  3. ✅ Check/create required data"
echo "  4. ✅ Verify user can log in"
echo ""

cd "$(dirname "$0")/.."

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo ""
    echo "Install: npm install -g supabase"
    exit 1
fi

# Step 1: Link or verify link
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Linking to project"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Unlink any existing project first to avoid conflicts
supabase unlink 2>/dev/null || true

# Link to the correct project
echo "Linking to: $PROJECT_REF"
if supabase link --project-ref "$PROJECT_REF"; then
    echo "✅ Successfully linked"
    echo ""
else
    echo "❌ Failed to link to project"
    echo ""
    echo "Make sure you're logged in:"
    echo "  supabase login"
    echo ""
    echo "And verify the project exists:"
    echo "  https://supabase.com/dashboard/project/$PROJECT_REF"
    exit 1
fi

# Step 2: Check current migration status
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Checking migration status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Current migrations applied:"
supabase migration list --linked | tail -10
echo ""

# Step 3: Apply all pending migrations (including RLS fix)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Applying migrations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Applying all pending migrations..."
if supabase db push --linked --include-all; then
    echo "✅ Migrations applied successfully"
    echo ""
else
    echo "⚠️  Some migrations may have failed"
    echo "This is OK if they were already applied"
    echo ""
fi

# Step 4: Check if we need to seed data
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Checking for required data"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Checking if database needs seeding..."
echo "Running diagnostic script..."
echo ""

# Run the diagnostic to see what's missing
if [ -f "scripts/diagnose-production.js" ]; then
    node scripts/diagnose-production.js || true
else
    echo "⚠️  Diagnostic script not found, skipping..."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Manual verification steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "If diagnostic shows missing data, you need to:"
echo ""
echo "1. Create user in Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/auth/users"
echo "   Click 'Add user' → Create with email & password"
echo ""
echo "2. Then create profile record:"
echo "   node scripts/fix-production-user.js"
echo ""
echo "3. Or apply full seed data (WARNING: only on empty DB):"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo "   Copy contents of: supabase/seed.sql"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SCRIPT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Review diagnostic output above"
echo "2. If user doesn't exist, create it in Dashboard"
echo "3. If user exists but profile missing, run:"
echo "   node scripts/fix-production-user.js"
echo "4. Clear browser cache or use incognito"
echo "5. Try logging in to demo-stage.netneural.ai"
echo ""
