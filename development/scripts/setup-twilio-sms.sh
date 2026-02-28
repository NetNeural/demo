#!/bin/bash
# Twilio SMS Setup Script
# This script helps you quickly configure Twilio SMS for the NetNeural IoT Platform

set -e

echo "🚀 NetNeural IoT Platform - Twilio SMS Setup"
echo "============================================="
echo ""

# Check if required commands are available
command -v gh >/dev/null 2>&1 || { echo "❌ GitHub CLI (gh) not found. Install: https://cli.github.com/"; exit 1; }
command -v npx >/dev/null 2>&1 || { echo "❌ npx not found. Install Node.js: https://nodejs.org/"; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Get Twilio credentials
echo "📝 Enter your Twilio credentials"
echo "   (Get these from: https://console.twilio.com/)"
echo ""

read -p "Twilio Account SID (ACxxxxx...): " TWILIO_ACCOUNT_SID
read -sp "Twilio Auth Token: " TWILIO_AUTH_TOKEN
echo ""
read -p "Twilio Phone Number (format: +1234567890): " TWILIO_FROM_NUMBER
echo ""

# Validate inputs
if [[ ! $TWILIO_ACCOUNT_SID =~ ^AC[a-f0-9]{32}$ ]]; then
    echo "⚠️  Warning: Account SID format looks incorrect (should start with AC and be 34 characters)"
fi

if [[ ! $TWILIO_FROM_NUMBER =~ ^\+[0-9]{10,15}$ ]]; then
    echo "⚠️  Warning: Phone number should be in E.164 format (e.g., +1234567890)"
fi

echo ""
echo "📋 Configuration Summary:"
echo "   Account SID: ${TWILIO_ACCOUNT_SID:0:10}..."
echo "   Auth Token: ****"
echo "   From Number: $TWILIO_FROM_NUMBER"
echo ""

read -p "Continue with setup? (y/n): " CONFIRM
if [[ $CONFIRM != "y" ]]; then
    echo "❌ Setup cancelled"
    exit 0
fi

echo ""
echo "🔧 Setting up Twilio SMS..."
echo ""

# 1. Add to .env.local (for local development)
echo "1️⃣ Updating .env.local for local development..."
if [ -f .env.local ]; then
    # Remove old Twilio entries if they exist
    sed -i '/^TWILIO_/d' .env.local
fi

cat >> .env.local << EOF

# Twilio SMS Configuration (added $(date))
TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER=$TWILIO_FROM_NUMBER
EOF

echo "   ✅ Local environment configured"

# 2. Add to GitHub Secrets (for production deployment)
echo ""
echo "2️⃣ Adding secrets to GitHub repository..."

gh secret set TWILIO_ACCOUNT_SID --body "$TWILIO_ACCOUNT_SID" && echo "   ✅ TWILIO_ACCOUNT_SID added"
gh secret set TWILIO_AUTH_TOKEN --body "$TWILIO_AUTH_TOKEN" && echo "   ✅ TWILIO_AUTH_TOKEN added"
gh secret set TWILIO_FROM_NUMBER --body "$TWILIO_FROM_NUMBER" && echo "   ✅ TWILIO_FROM_NUMBER added"

# 3. Add to Supabase Secrets (for Edge Functions)
echo ""
echo "3️⃣ Adding secrets to Supabase (for Edge Functions)..."

# Check if linked to Supabase project
if npx supabase projects list >/dev/null 2>&1; then
    npx supabase secrets set TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" && echo "   ✅ TWILIO_ACCOUNT_SID set in Supabase"
    npx supabase secrets set TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" && echo "   ✅ TWILIO_AUTH_TOKEN set in Supabase"
    npx supabase secrets set TWILIO_FROM_NUMBER="$TWILIO_FROM_NUMBER" && echo "   ✅ TWILIO_FROM_NUMBER set in Supabase"
else
    echo "   ⚠️  Supabase project not linked. Run 'npx supabase link' first, then:"
    echo "      npx supabase secrets set TWILIO_ACCOUNT_SID=\"$TWILIO_ACCOUNT_SID\""
    echo "      npx supabase secrets set TWILIO_AUTH_TOKEN=\"$TWILIO_AUTH_TOKEN\""
    echo "      npx supabase secrets set TWILIO_FROM_NUMBER=\"$TWILIO_FROM_NUMBER\""
fi

echo ""
echo "✅ Twilio SMS Setup Complete!"
echo ""
echo "📚 Next Steps:"
echo "   1. Deploy the Edge Function: npx supabase functions deploy send-alert-notifications"
echo "   2. Test SMS: See docs/TWILIO_SMS_SETUP.md for testing instructions"
echo "   3. Configure alerts: Add phone numbers to sensor thresholds"
echo ""
echo "📖 Documentation: docs/TWILIO_SMS_SETUP.md"
echo "🔍 Verify setup: npx supabase secrets list | grep TWILIO"
echo ""
echo "🎉 Happy alerting!"
