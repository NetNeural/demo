#!/bin/bash
# Get Supabase production database connection string
# This uses the Supabase CLI to get the pooler connection string

PROJECT_REF="bldojxpockljyivldxwf"

echo "🔍 Fetching Supabase production connection details..."
echo ""

# Get connection pooler string (Transaction mode - port 6543)
echo "📋 Connection Pooler (Transaction Mode - for SQLTools):"
supabase db show --project-ref $PROJECT_REF --format=text 2>/dev/null | grep -i "pooler" || {
    echo "❌ Supabase CLI not authenticated or project not found"
    echo ""
    echo "To authenticate, run:"
    echo "  supabase login"
    echo ""
    echo "Or get the connection string from:"
    echo "  https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
    echo ""
    echo "For SQLTools, use:"
    echo "  Host: db.$PROJECT_REF.supabase.co"
    echo "  Port: 6543 (Transaction pooler)"
    echo "  Database: postgres"
    echo "  Username: postgres.${PROJECT_REF}"
    echo "  Password: [Get from Supabase Dashboard → Settings → Database → Database password]"
    exit 1
}

echo ""
echo "📝 For SQLTools configuration:"
echo "  Server: db.$PROJECT_REF.supabase.co"
echo "  Port: 6543"
echo "  Database: postgres"
echo "  Username: postgres.$PROJECT_REF"
echo "  Password: [Your database password from Supabase Dashboard]"
echo ""
echo "🔐 To get your database password:"
echo "  1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo "  2. Look for 'Database Settings' → 'Connection string'"
echo "  3. Click 'Reset database password' if you don't have it"
echo ""
