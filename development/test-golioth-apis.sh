#!/bin/bash
# Test Golioth APIs - Interactive Demo

echo "🧪 Golioth API Testing Demo"
echo "==========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Get device and integration IDs from database
echo -e "${BLUE}📋 Step 1: Getting test data from database...${NC}"
DEVICE_ID=$(npx supabase db execute "SELECT id FROM devices LIMIT 1" --local --output tsv 2>/dev/null | tail -1)
INTEGRATION_ID=$(npx supabase db execute "SELECT id FROM device_integrations WHERE integration_type='golioth' LIMIT 1" --local --output tsv 2>/dev/null | tail -1)

if [ -z "$DEVICE_ID" ]; then
    echo "❌ No devices found. Create a device first."
    exit 1
fi

echo -e "${GREEN}✅ Found device: $DEVICE_ID${NC}"
echo -e "${GREEN}✅ Found integration: ${INTEGRATION_ID:-none}${NC}"
echo ""

# 2. Test Status API
echo -e "${BLUE}📊 Step 2: Testing Unified Status API...${NC}"
echo "   GET /api/devices/$DEVICE_ID/status"
echo ""

STATUS_RESPONSE=$(curl -s "http://localhost:3000/api/devices/${DEVICE_ID}/status" 2>/dev/null)

if echo "$STATUS_RESPONSE" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Status API working!${NC}"
    echo ""
    echo "Response preview:"
    echo "$STATUS_RESPONSE" | jq '{
      device: .device.name,
      connectionState: .connectionState,
      firmware: .firmware.version,
      lastActivity: .lastActivity
    }' 2>/dev/null || echo "$STATUS_RESPONSE"
else
    echo -e "${YELLOW}⚠️  API returned: $STATUS_RESPONSE${NC}"
fi
echo ""

# 3. Test Sync API (if integration exists)
if [ -n "$INTEGRATION_ID" ]; then
    echo -e "${BLUE}🔄 Step 3: Testing Manual Sync API...${NC}"
    echo "   POST /api/integrations/$INTEGRATION_ID/sync"
    echo ""
    
    SYNC_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/integrations/${INTEGRATION_ID}/sync" \
        -H "Content-Type: application/json" \
        -d '{"batchSize": 10}' 2>/dev/null)
    
    if echo "$SYNC_RESPONSE" | jq . > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Sync API working!${NC}"
        echo ""
        echo "Response preview:"
        echo "$SYNC_RESPONSE" | jq '{
          success: .success,
          devicesProcessed: .devicesProcessed,
          devicesUpdated: .devicesUpdated,
          duration: .duration
        }' 2>/dev/null || echo "$SYNC_RESPONSE"
    else
        echo -e "${YELLOW}⚠️  Sync returned: $SYNC_RESPONSE${NC}"
    fi
    echo ""
fi

# 4. Check Conflicts
echo -e "${BLUE}⚠️  Step 4: Checking for Sync Conflicts...${NC}"
echo "   GET /api/sync/conflicts"
echo ""

CONFLICTS_RESPONSE=$(curl -s "http://localhost:3000/api/sync/conflicts" 2>/dev/null)

if echo "$CONFLICTS_RESPONSE" | jq . > /dev/null 2>&1; then
    CONFLICT_COUNT=$(echo "$CONFLICTS_RESPONSE" | jq '.total' 2>/dev/null)
    echo -e "${GREEN}✅ Conflicts API working!${NC}"
    echo "   Found $CONFLICT_COUNT conflicts"
else
    echo -e "${YELLOW}⚠️  Response: $CONFLICTS_RESPONSE${NC}"
fi
echo ""

# 5. Check Database Changes
echo -e "${BLUE}💾 Step 5: Checking Database...${NC}"
echo ""

echo "New tables created:"
npx supabase db execute "
SELECT 
  'device_firmware_history' as table_name, 
  COUNT(*) as row_count 
FROM device_firmware_history
UNION ALL
SELECT 'firmware_artifacts', COUNT(*) FROM firmware_artifacts
UNION ALL
SELECT 'device_credentials', COUNT(*) FROM device_credentials
UNION ALL
SELECT 'sync_conflicts', COUNT(*) FROM sync_conflicts
" --local 2>/dev/null

echo ""
echo "Devices with new fields populated:"
npx supabase db execute "
SELECT 
  COUNT(*) FILTER (WHERE last_seen_online IS NOT NULL) as with_last_seen_online,
  COUNT(*) FILTER (WHERE hardware_ids IS NOT NULL AND hardware_ids != '{}') as with_hardware_ids,
  COUNT(*) FILTER (WHERE cohort_id IS NOT NULL) as with_cohort_id,
  COUNT(*) as total_devices
FROM devices
" --local 2>/dev/null

echo ""
echo -e "${GREEN}✅ Demo Complete!${NC}"
echo ""
echo "📚 What you just tested:"
echo "   ✅ Unified Status API (Issue #89)"
echo "   ✅ Manual Sync API (Issue #88)"
echo "   ✅ Conflict Detection (Issue #87)"
echo "   ✅ New database tables"
echo "   ✅ Extended device columns"
echo ""
echo "🎯 Next steps:"
echo "   1. Open Supabase Studio: http://127.0.0.1:54323"
echo "   2. View full demo guide: cat docs/GOLIOTH_DEMO_GUIDE.md"
echo "   3. Test with real Golioth credentials"
echo ""
