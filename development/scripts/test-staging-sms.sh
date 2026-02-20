#!/bin/bash
# Test SMS notifications on staging environment

set -e

STAGING_URL="https://atgbmxicqikmapfqouco.supabase.co"
STAGING_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMTc4MDksImV4cCI6MjA4NjU5MzgwOX0.V-nVEkKdoNbzl_9bmS0d4X7QbNt7raxEYuevpaPEYwg"

echo "🧪 Testing Staging SMS Notifications"
echo "====================================="
echo ""

# Get test phone number
read -p "Enter test phone number (format: +1234567890): " TEST_PHONE

if [[ ! $TEST_PHONE =~ ^\+[0-9]{10,15}$ ]]; then
    echo "❌ Invalid phone number format. Use E.164 format: +1234567890"
    exit 1
fi

echo ""
echo "1️⃣ Creating test alert in staging..."

# Create alert
ALERT_RESPONSE=$(curl -s -X POST "${STAGING_URL}/rest/v1/alerts" \
  -H "apikey: ${STAGING_ANON_KEY}" \
  -H "Authorization: Bearer ${STAGING_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"organization_id\":\"00000000-0000-0000-0000-000000000001\",\"alert_type\":\"test\",\"severity\":\"high\",\"title\":\"Staging SMS Test\",\"message\":\"Testing SMS from staging - $(date)\",\"category\":\"system\"}")

ALERT_ID=$(echo "$ALERT_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$ALERT_ID" ]; then
    echo "❌ Failed to create alert"
    echo "Response: $ALERT_RESPONSE"
    exit 1
fi

echo "   ✅ Alert created: $ALERT_ID"
echo ""
echo "2️⃣ Sending SMS notification..."

# Send SMS
SMS_RESPONSE=$(curl -s -X POST "${STAGING_URL}/functions/v1/send-alert-notifications" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${STAGING_ANON_KEY}" \
  -d "{\"alert_id\":\"${ALERT_ID}\",\"channels\":[\"sms\"],\"recipient_phone_numbers\":[\"${TEST_PHONE}\"]}")

echo ""
echo "📨 Response:"
echo "$SMS_RESPONSE" | jq . 2>/dev/null || echo "$SMS_RESPONSE"
echo ""

# Check if successful
if echo "$SMS_RESPONSE" | grep -q '"success":true'; then
    if echo "$SMS_RESPONSE" | grep -q '"channels_succeeded":1'; then
        echo "✅ SMS sent successfully!"
        echo "📱 Check your phone: $TEST_PHONE"
    else
        echo "⚠️  SMS dispatched but may have failed. Check response above."
    fi
else
    echo "❌ SMS test failed"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   1. Verify Twilio secrets are set in Supabase Dashboard"
    echo "   2. Check function logs: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/functions/send-alert-notifications/logs"
    echo "   3. Verify phone number format: $TEST_PHONE"
fi
echo ""
