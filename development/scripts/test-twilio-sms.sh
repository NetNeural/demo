#!/bin/bash
# Test Twilio SMS Integration
# Sends a test SMS to verify the setup is working

set -e

echo "🧪 Twilio SMS Test Script"
echo "========================="
echo ""

# Get test phone number
read -p "Enter test phone number (format: +1234567890): " TEST_PHONE

if [[ ! $TEST_PHONE =~ ^\+[0-9]{10,15}$ ]]; then
    echo "❌ Invalid phone number format. Use E.164 format: +1234567890"
    exit 1
fi

# Check if Supabase is configured
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "⚠️  Loading environment variables..."
    if [ -f .env.local ]; then
        export $(cat .env.local | grep -v '^#' | xargs)
    fi
fi

SUPABASE_URL=${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL}}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY}}

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Supabase credentials not found. Set SUPABASE_URL and SUPABASE_ANON_KEY"
    exit 1
fi

echo "📡 Supabase URL: ${SUPABASE_URL:0:30}..."
echo "📞 Test number: $TEST_PHONE"
echo ""

# Create a test alert first
echo "1️⃣ Creating test alert..."

# Get a device ID (or use a test one)
DEVICE_ID=${DEVICE_ID:-"test-device-$(date +%s)"}
ORG_ID=${ORG_ID:-"test-org"}

# Create test alert payload
ALERT_PAYLOAD=$(cat <<EOF
{
  "id": "test-alert-$(date +%s)",
  "organization_id": "$ORG_ID",
  "device_id": "$DEVICE_ID",
  "title": "🧪 SMS Test Alert",
  "message": "This is a test SMS alert from NetNeural IoT Platform",
  "severity": "info",
  "status": "active",
  "metadata": {
    "is_test": true,
    "test_timestamp": "$(date -Iseconds)"
  }
}
EOF
)

# Note: You may need to insert this into the database first
# For now, we'll use a mock alert ID
ALERT_ID="test-alert-$(date +%s)"

echo "   Alert ID: $ALERT_ID"
echo ""

# Test SMS sending
echo "2️⃣ Sending test SMS..."

RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/send-alert-notifications" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"alert_id\": \"$ALERT_ID\",
    \"channels\": [\"sms\"],
    \"recipient_phone_numbers\": [\"$TEST_PHONE\"]
  }")

echo ""
echo "📨 Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ SMS test completed!"
    echo ""
    echo "📱 Check your phone for the test message"
    echo "🔍 You can also verify in Twilio Console:"
    echo "   https://console.twilio.com/monitor/logs/sms"
else
    echo "❌ SMS test failed"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   1. Check Twilio credentials: npx supabase secrets list | grep TWILIO"
    echo "   2. View logs: npx supabase functions logs send-alert-notifications"
    echo "   3. Verify phone number format: $TEST_PHONE"
    echo "   4. For trial accounts: Verify number in Twilio Console"
fi
echo ""
