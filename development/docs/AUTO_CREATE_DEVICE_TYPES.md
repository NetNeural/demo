# Auto-Create Device Types for Organizations

## Overview

Every organization in the NetNeural IoT Platform automatically receives **42 standard device types** when created. This ensures consistent sensor definitions across all customers.

## ✅ What's Implemented

### 1. **Database Trigger (Automatic)**
- **Migration**: `supabase/migrations/20260220000000_auto_create_device_types.sql`
- **Trigger**: `auto_seed_device_types_on_org_creation`
- **When**: Fires automatically when a new organization is inserted
- **What**: Creates all 42 device types for the new organization

### 2. **Backfill Script (Manual)**
- **Script**: `scripts/backfill-device-types-all-orgs.js`
- **Purpose**: Add device types to existing organizations that don't have them yet
- **Usage**: See commands below

## 📋 Device Type Categories (42 Total)

The system includes industry-standard device types across 13 categories:

| Category | Count | Examples |
|----------|-------|----------|
| Temperature | 6 | Indoor (°C/°F), Cold Storage, Freezer, Server Room, Industrial |
| Humidity | 4 | Indoor, Data Center, Cold Storage, Manufacturing |
| Pressure | 3 | Atmospheric, Cleanroom Differential, HVAC |
| Air Quality | 8 | CO₂, CO, PM2.5, PM10, VOC, Ozone, Formaldehyde, Radon |
| Light | 2 | Indoor Illuminance, Outdoor Illuminance |
| Electrical | 6 | AC 120V/230V, DC 12V, Current, Power, Battery |
| Occupancy | 2 | Binary Motion, People Count |
| Water/Liquid | 3 | Flow Rate, Leak Detection, Level |
| Sound | 1 | Sound Level (dBA) |
| Vibration | 1 | Vibration RMS |
| Distance | 2 | Ultrasonic, Time-of-Flight |
| Environmental | 2 | Soil Moisture, Wind Speed |
| Safety | 2 | Smoke Detection, Natural Gas |

All types include:
- Normal operating ranges (based on industry standards)
- Alert thresholds
- Measurement units
- Precision settings
- Compliance references (ASHRAE, WHO, OSHA, FDA, etc.)

## 🚀 Usage

### For New Organizations (Automatic)

No action required! When you create a new organization via any method:

```typescript
// Frontend
const { data } = await supabase
  .from('organizations')
  .insert({ name: 'Acme Corp', slug: 'acme' })
  .select()
  .single()

// ✅ 42 device types are automatically created!
```

### For Existing Organizations (Backfill)

#### Local Development

```bash
cd development

# Get service role key
npm run supabase:status

# Run backfill (will skip orgs that already have device types)
SUPABASE_SERVICE_ROLE_KEY=<key> npm run seed:device-types
```

#### Staging Environment

```bash
cd development

# Use staging service role key
SUPABASE_SERVICE_ROLE_KEY=<staging-key> npm run seed:device-types:staging
```

#### Production Environment

```bash
cd development

# Use production keys carefully!
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<prod-key> \
node scripts/backfill-device-types-all-orgs.js
```

## 🔍 Verification

### Check if an Organization Has Device Types

```sql
SELECT COUNT(*) 
FROM device_types 
WHERE organization_id = '<org-id>';
-- Expected: 42
```

### View All Device Types for an Organization

```sql
SELECT name, device_class, unit, lower_normal, upper_normal
FROM device_types
WHERE organization_id = '<org-id>'
ORDER BY device_class, name;
```

### Test the Trigger

```sql
-- Create a test organization
INSERT INTO organizations (name, slug)
VALUES ('Test Org', 'test-org-' || gen_random_uuid())
RETURNING id;

-- Check that device types were created
SELECT COUNT(*) FROM device_types WHERE organization_id = '<returned-id>';
-- Should show: 42
```

## 📊 Backfill Script Output

The backfill script provides detailed feedback:

```
🔧 Backfill Device Types for All Organizations

📡 Supabase URL: http://127.0.0.1:54321

📋 Fetching all organizations...
✅ Found 5 organizations

🌱 Seeding device types for "NetNeural"...
✅ Created 42 device types for "NetNeural"

⏭️  Skipping "Acme Corp" (already has 42 device types)

════════════════════════════════════════════════════════════
📊 BACKFILL SUMMARY
════════════════════════════════════════════════════════════
Total organizations: 5
✅ Successfully backfilled: 3
⏭️  Skipped (already had types): 2
❌ Errors: 0
════════════════════════════════════════════════════════════

✅ Backfill complete! All organizations now have standard device types.
```

## 🎯 Benefits

1. **Consistency**: All orgs have the same device type standards
2. **Compliance**: Types based on industry standards (ASHRAE, WHO, OSHA)
3. **Zero Manual Work**: New orgs get types automatically
4. **Safe Backfill**: Script skips orgs that already have types
5. **Immediate Usage**: Users can create devices right away

## 🔧 Customization

After receiving the 42 standard types, each organization can:
- ✅ Create additional custom device types
- ✅ Edit standard types to fit their needs
- ✅ Delete types they don't use
- ✅ All changes are org-scoped (don't affect other orgs)

The standard types are just a starting point!

## 📝 Maintenance

The device type definitions are stored in:
- **Migration SQL**: `/supabase/migrations/20260220000000_auto_create_device_types.sql`

To update the standard types:
1. Edit the migration file
2. Create a new migration with changes
3. Run backfill script to update existing orgs (if needed)

## ⚠️ Important Notes

- **Duplicate Prevention**: Backfill script checks existing types and skips orgs that already have them
- **Idempotent**: Safe to run backfill multiple times
- **Service Role Key**: Required for backfill (bypasses RLS policies)
- **Transaction Safety**: If trigger fails, organization creation rolls back
- **Performance**: Trigger adds ~200ms to organization creation time (acceptable for rare operation)

## 🧪 Testing

```bash
# Test locally
cd development
npm run supabase:start
SUPABASE_SERVICE_ROLE_KEY=$(npm run supabase:status | grep service_role | awk '{print $3}') \
  npm run seed:device-types

# Test trigger
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "
INSERT INTO organizations (name, slug) 
VALUES ('Test Trigger', 'test-' || substr(md5(random()::text), 1, 8)) 
RETURNING id;
"

# Verify
psql "postgresql://postgres:postgres@localhost:54322/postgres" -c "
SELECT organization_id, COUNT(*) as device_type_count 
FROM device_types 
GROUP BY organization_id
ORDER BY device_type_count DESC;
"
```

## 📚 Related Documentation

- [Device Types Schema](/development/supabase/migrations/20241201000001_init_schema.sql)
- [Device Type Component](/development/src/components/devices/AddDeviceDialog.tsx)
- [Device Types API Hooks](/development/src/hooks/queries/useDeviceTypes.ts)
- [Original 42 Types Script](/development/scripts/seed-42-device-types.js)
