#!/bin/bash

# =============================================================================
# Production Database Reset - Quick Start
# =============================================================================

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║  Production Database Reset - NetNeural IoT Platform                 ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "⚠️  WARNING: This will reset the production database!"
echo "✅ Backup created: backups/production_backup_20251014_021430.sql"
echo ""

# Check if user wants to continue
read -p "Do you want to continue with the reset? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Reset cancelled"
    exit 0
fi

echo ""
echo "📋 Step 1: Opening Supabase SQL Editor..."
echo "   URL: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/sql/new"
echo ""
echo "📄 Step 2: Copy the SQL script..."
echo "   File: production_reset.sql"
echo ""

# Display the file contents
cat production_reset.sql

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo "👆 COPY THE ABOVE SQL SCRIPT"
echo ""
echo "Then:"
echo "  1. Go to: https://supabase.com/dashboard/project/bldojxpockljyivldxwf/sql/new"
echo "  2. Paste the SQL script"
echo "  3. Click the 'Run' button"
echo "  4. Wait for completion (should see 'Tables remaining: 0')"
echo ""
echo "After the SQL completes, press Enter to continue with migrations..."
read -p ""

echo ""
echo "🚀 Step 3: Pushing IoT schema to production..."
npx supabase db push --linked

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Schema pushed successfully!"
    echo ""
    echo "📊 Step 4: Verifying migrations..."
    npx supabase migration list --linked
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════"
    echo "✅ Database reset and migrations complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy edge functions: npx supabase functions deploy --linked"
    echo "  2. Configure secrets"
    echo "  3. Deploy to GitHub Pages"
    echo ""
else
    echo ""
    echo "❌ Schema push failed!"
    echo "Check the error messages above"
    exit 1
fi
