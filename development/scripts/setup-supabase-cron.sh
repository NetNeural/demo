#!/bin/bash
# ===========================================================================
# Supabase Edge Cron Setup Script
# ===========================================================================
# This script configures the Supabase Edge Cron to run auto-sync jobs
# This is a ONE-TIME setup per Supabase project (not per integration)
# ===========================================================================

set -e

echo "🔧 Setting up Supabase Edge Cron for auto-sync..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Get project reference (for production)
PROJECT_REF="${SUPABASE_PROJECT_REF}"

if [ -z "$PROJECT_REF" ]; then
    echo "⚠️  SUPABASE_PROJECT_REF not set. Running for local development only."
    echo ""
    echo "For production, set SUPABASE_PROJECT_REF and run again:"
    echo "  export SUPABASE_PROJECT_REF=your-project-ref"
    echo "  ./scripts/setup-supabase-cron.sh"
    echo ""
else
    echo "📦 Project Reference: $PROJECT_REF"
fi

echo ""
echo "🎯 Cron Job Configuration:"
echo "   Function: auto-sync-cron"
echo "   Schedule: * * * * * (every minute)"
echo "   Purpose: Check for due sync schedules and execute them"
echo ""

if [ -n "$PROJECT_REF" ]; then
    echo "⚠️  NOTE: Supabase Edge Cron is currently configured via Dashboard"
    echo ""
    echo "📋 Manual Setup Steps (ONE-TIME):"
    echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/functions"
    echo "2. Click on 'auto-sync-cron' function"
    echo "3. Go to 'Cron' tab"
    echo "4. Enable cron with schedule: * * * * *"
    echo "5. Save configuration"
    echo ""
    echo "Or use Supabase CLI (when available):"
    echo "  supabase functions deploy auto-sync-cron --project-ref $PROJECT_REF"
    echo ""
else
    echo "✅ For local development:"
    echo "   The auto-sync-cron function is already deployed."
    echo "   To test manually, run:"
    echo "   curl http://127.0.0.1:54321/functions/v1/auto-sync-cron"
    echo ""
    echo "   Auto-sync will work when schedules are created via the UI."
fi

echo ""
echo "ℹ️  This setup is done ONCE per Supabase project."
echo "   All integrations will use the same cron job."
echo ""
echo "✅ Setup instructions complete!"
