#!/bin/bash
# Quick Golioth Demo Script

echo "🚀 Golioth Integration Demo"
echo "=========================="
echo ""

# Check if services are running
echo "1️⃣  Checking services..."
if curl -s http://127.0.0.1:54321/health > /dev/null 2>&1; then
    echo "   ✅ Supabase is running"
else
    echo "   ❌ Supabase not running - start with: npm run dev:full:debug"
    exit 1
fi

if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "   ✅ Next.js is running"
else
    echo "   ❌ Next.js not running - start with: npm run dev"
    exit 1
fi

echo ""
echo "2️⃣  Checking new database tables..."
npx supabase db execute "SELECT 'device_firmware_history' as table_name, COUNT(*) as rows FROM device_firmware_history 
UNION ALL SELECT 'firmware_artifacts', COUNT(*) FROM firmware_artifacts
UNION ALL SELECT 'device_credentials', COUNT(*) FROM device_credentials
UNION ALL SELECT 'sync_conflicts', COUNT(*) FROM sync_conflicts" --local 2>/dev/null

echo ""
echo "3️⃣  Checking new columns in devices table..."
npx supabase db execute "SELECT 
  COUNT(*) FILTER (WHERE last_seen_online IS NOT NULL) as has_last_seen_online,
  COUNT(*) FILTER (WHERE hardware_ids IS NOT NULL AND hardware_ids != '{}') as has_hardware_ids,
  COUNT(*) FILTER (WHERE cohort_id IS NOT NULL) as has_cohort_id,
  COUNT(*) as total_devices
FROM devices" --local 2>/dev/null

echo ""
echo "4️⃣  Sample device with new fields..."
npx supabase db execute "SELECT 
  name, 
  serial_number,
  last_seen_online,
  hardware_ids,
  cohort_id
FROM devices 
WHERE last_seen_online IS NOT NULL OR hardware_ids IS NOT NULL
LIMIT 1" --local 2>/dev/null

echo ""
echo "5️⃣  Available integrations..."
npx supabase db execute "SELECT 
  id, 
  name, 
  integration_type,
  status
FROM device_integrations" --local 2>/dev/null

echo ""
echo "✅ Demo check complete!"
echo ""
echo "📚 Next steps:"
echo "   • View full demo guide: docs/GOLIOTH_DEMO_GUIDE.md"
echo "   • Open Supabase Studio: http://127.0.0.1:54323"
echo "   • Open app: http://localhost:3000"
echo ""
