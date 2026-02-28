#!/bin/bash

# List all local migrations and note which ones might be critical for production

echo "📋 All Migrations in /supabase/migrations (103 total)"
echo ""
echo "🔴 CRITICAL for AI Analytics:"
echo ""
ls -1 supabase/migrations/ | grep -E "telemetry|mqtt_history"
echo ""
echo "🔵 Device Type Migrations (just created):"
echo ""
ls -1 supabase/migrations/ | grep -E "device_types|auto_create"
echo ""
echo "🟡 All Other Migrations:"
echo ""
ls -1 supabase/migrations/*.sql | wc -l
echo "migrations found"
echo ""
echo "💡 To apply all migrations to staging:"
echo "   1. Link to staging: npx supabase link --project-ref <staging-ref>"
echo "   2. Push migrations: npx supabase db push"
echo ""
echo "💡 Or apply manually via Supabase Dashboard:"
echo "   Dashboard > SQL Editor > copy/paste migration contents"
