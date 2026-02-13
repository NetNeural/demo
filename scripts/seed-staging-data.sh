#!/bin/bash
# Seed Staging Database with Test Data
# Usage: ./scripts/seed-staging-data.sh

set -e

echo "🌱 Seeding Staging Database"
echo "============================"
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

DEV_DIR="/workspaces/MonoRepo/development"
cd "$DEV_DIR"

# Create seed SQL file
SEED_FILE="/tmp/staging_seed.sql"
echo -e "${BLUE}📝 Creating seed data SQL...${NC}"

cat > "$SEED_FILE" << 'EOSQL'
-- Staging Database Seed Data
-- Creates test organizations, users, devices, and sample data

-- 1. Create test organizations
INSERT INTO organizations (id, name, slug, created_at, updated_at)
VALUES 
  ('org-test-001', 'Acme IoT Solutions', 'acme-iot', NOW(), NOW()),
  ('org-test-002', 'Global Sensors Inc', 'global-sensors', NOW(), NOW()),
  ('org-test-003', 'Smart City Lab', 'smart-city', NOW(), NOW()),
  ('org-test-004', 'AgriTech Network', 'agritech', NOW(), NOW()),
  ('org-test-005', 'Industrial Monitoring', 'industrial-mon', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. Create test devices (20 total, 4 per organization)
INSERT INTO devices (id, name, organization_id, device_type, status, metadata, created_at, updated_at)
VALUES 
  -- Acme IoT Solutions
  ('dev-acme-001', 'Temperature Sensor A1', 'org-test-001', 'temperature_sensor', 'active', '{"location": "Building A", "floor": 1}', NOW(), NOW()),
  ('dev-acme-002', 'Humidity Monitor H1', 'org-test-001', 'humidity_sensor', 'active', '{"location": "Building A", "floor": 2}', NOW(), NOW()),
  ('dev-acme-003', 'Motion Detector M1', 'org-test-001', 'motion_sensor', 'active', '{"location": "Entrance", "zone": "North"}', NOW(), NOW()),
  ('dev-acme-004', 'Air Quality Sensor Q1', 'org-test-001', 'air_quality', 'inactive', '{"location": "Building B", "floor": 1}', NOW(), NOW()),
  
  -- Global Sensors Inc
  ('dev-global-001', 'GPS Tracker Unit 1', 'org-test-002', 'gps_tracker', 'active', '{"vehicle": "Fleet-001", "driver": "John"}', NOW(), NOW()),
  ('dev-global-002', 'GPS Tracker Unit 2', 'org-test-002', 'gps_tracker', 'active', '{"vehicle": "Fleet-002", "driver": "Jane"}', NOW(), NOW()),
  ('dev-global-003', 'Fuel Level Monitor F1', 'org-test-002', 'fuel_sensor', 'active', '{"tank_capacity": 100}', NOW(), NOW()),
  ('dev-global-004', 'Vibration Sensor V1', 'org-test-002', 'vibration_sensor', 'maintenance', '{"maintenance_due": "2026-03-01"}', NOW(), NOW()),
  
  -- Smart City Lab
  ('dev-city-001', 'Traffic Counter T1', 'org-test-003', 'traffic_sensor', 'active', '{"intersection": "Main & 1st"}', NOW(), NOW()),
  ('dev-city-002', 'Parking Sensor P1', 'org-test-003', 'parking_sensor', 'active', '{"lot": "Downtown A", "spot": 15}', NOW(), NOW()),
  ('dev-city-003', 'Street Light L1', 'org-test-003', 'smart_light', 'active', '{"street": "Main St", "pole": 101}', NOW(), NOW()),
  ('dev-city-004', 'Weather Station W1', 'org-test-003', 'weather_station', 'active', '{"location": "City Hall"}', NOW(), NOW()),
  
  -- AgriTech Network
  ('dev-agri-001', 'Soil Moisture S1', 'org-test-004', 'soil_sensor', 'active', '{"farm": "North Field", "crop": "Corn"}', NOW(), NOW()),
  ('dev-agri-002', 'Soil Moisture S2', 'org-test-004', 'soil_sensor', 'active', '{"farm": "South Field", "crop": "Wheat"}', NOW(), NOW()),
  ('dev-agri-003', 'Irrigation Controller I1', 'org-test-004', 'irrigation', 'active', '{"zone": 1, "schedule": "daily"}', NOW(), NOW()),
  ('dev-agri-004', 'Tank Level Monitor T1', 'org-test-004', 'level_sensor', 'active', '{"tank": "Water Storage", "capacity": 5000}', NOW(), NOW()),
  
  -- Industrial Monitoring
  ('dev-ind-001', 'Pressure Gauge P1', 'org-test-005', 'pressure_sensor', 'active', '{"line": "Main", "max_psi": 150}', NOW(), NOW()),
  ('dev-ind-002', 'Temperature Monitor T1', 'org-test-005', 'temperature_sensor', 'active', '{"equipment": "Boiler #1"}', NOW(), NOW()),
  ('dev-ind-003', 'Flow Meter F1', 'org-test-005', 'flow_sensor', 'active', '{"line": "Supply", "units": "GPM"}', NOW(), NOW()),
  ('dev-ind-004', 'Power Monitor E1', 'org-test-005', 'power_meter', 'warning', '{"circuit": "Main Panel", "alert": "High load"}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 3. Create sample telemetry data (last 7 days)
INSERT INTO telemetry (device_id, timestamp, data)
SELECT 
  d.id,
  NOW() - (random() * INTERVAL '7 days'),
  jsonb_build_object(
    'temperature', 20 + (random() * 10),
    'humidity', 40 + (random() * 30),
    'battery', 70 + (random() * 30),
    'signal_strength', -50 - (random() * 40)
  )
FROM devices d
CROSS JOIN generate_series(1, 5) -- 5 readings per device
ON CONFLICT DO NOTHING;

-- 4. Create test user accounts (for manual testing)
-- Note: These require proper auth setup, may need manual creation via Supabase Auth
-- Documented here for reference

-- Test User 1: Admin
-- Email: staging-admin@netneural.ai
-- Password: StagingTest2026!
-- Role: admin
-- Organization: org-test-001

-- Test User 2: Standard User
-- Email: staging-user@netneural.ai
-- Password: StagingTest2026!
-- Role: user
-- Organization: org-test-002

-- 5. Create sample integration configurations
INSERT INTO integrations (id, organization_id, integration_type, config, status, created_at)
VALUES 
  ('int-golioth-001', 'org-test-001', 'golioth', '{"project_id": "test-project", "api_key": "test-key"}', 'active', NOW()),
  ('int-webhook-001', 'org-test-002', 'webhook', '{"url": "https://webhook.example.com/staging", "method": "POST"}', 'active', NOW()),
  ('int-mqtt-001', 'org-test-003', 'mqtt', '{"broker": "test.mosquitto.org", "port": 1883}', 'inactive', NOW())
ON CONFLICT (id) DO NOTHING;

-- 6. Create sample alerts
INSERT INTO alerts (id, organization_id, device_id, alert_type, severity, message, triggered_at, acknowledged_at)
VALUES 
  ('alert-001', 'org-test-001', 'dev-acme-001', 'high_temperature', 'warning', 'Temperature exceeds threshold (85°F)', NOW() - INTERVAL '2 hours', NULL),
  ('alert-002', 'org-test-005', 'dev-ind-004', 'power_overload', 'critical', 'Circuit load at 95% capacity', NOW() - INTERVAL '30 minutes', NULL),
  ('alert-003', 'org-test-002', 'dev-global-004', 'maintenance_due', 'info', 'Scheduled maintenance approaching', NOW() - INTERVAL '1 day', NOW())
ON CONFLICT (id) DO NOTHING;

-- Summary
SELECT 
  'Organizations' as entity, COUNT(*) as count FROM organizations
UNION ALL SELECT 'Devices', COUNT(*) FROM devices
UNION ALL SELECT 'Telemetry', COUNT(*) FROM telemetry
UNION ALL SELECT 'Integrations', COUNT(*) FROM integrations
UNION ALL SELECT 'Alerts', COUNT(*) FROM alerts;
EOSQL

echo -e "${GREEN}✅ Seed SQL created${NC}"

# Prompt for project reference
echo ""
echo -e "${YELLOW}📋 Enter Staging Supabase Project Reference:${NC}"
read -p "Project Ref: " STAGING_PROJECT_REF

if [ -z "$STAGING_PROJECT_REF" ]; then
    echo -e "${RED}❌ Project reference required${NC}"
    exit 1
fi

# Execute seed SQL
echo ""
echo -e "${BLUE}🚀 Executing seed data...${NC}"

# Determine which supabase command to use
if command -v supabase &> /dev/null; then
    SUPABASE_CMD="supabase"
elif command -v npx &> /dev/null && npx supabase --version &> /dev/null 2>&1; then
    SUPABASE_CMD="npx supabase"
else
    echo -e "${RED}❌ Supabase CLI not available${NC}"
    exit 1
fi

$SUPABASE_CMD db remote exec < "$SEED_FILE" --linked

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Staging data seeded successfully!${NC}"
else
    echo -e "${RED}❌ Failed to seed data${NC}"
    exit 1
fi

# Cleanup
rm -f "$SEED_FILE"

# Display summary
echo ""
echo -e "${BLUE}📊 Seed Data Summary:${NC}"
echo "  ✅ 5 test organizations"
echo "  ✅ 20 test devices"
echo "  ✅ 100 telemetry records"
echo "  ✅ 3 integration configurations"
echo "  ✅ 3 sample alerts"
echo ""
echo -e "${YELLOW}👤 Test User Accounts (create manually in Supabase Auth):${NC}"
echo "  Admin:"
echo "    Email: staging-admin@netneural.ai"
echo "    Password: StagingTest2026!"
echo "  User:"
echo "    Email: staging-user@netneural.ai"
echo "    Password: StagingTest2026!"
echo ""
echo -e "${GREEN}🎉 Ready to test at https://demo-stage.netneural.ai${NC}"
