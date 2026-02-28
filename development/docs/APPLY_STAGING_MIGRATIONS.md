# Apply Missing Migrations to Staging

## Problem

AI Analytics page fails with 400 error because `device_telemetry_history` table doesn't exist in staging.

## Critical Missing Migrations

Based on the error, these migrations are definitely missing from staging:

### Telemetry System (Priority: CRITICAL)

- `20250109000002_mqtt_history_tables.sql` - Creates telemetry tables
- `20250109000003_telemetry_all_integrations.sql` - Creates `device_telemetry_history` table
- `20260215000002_fix_telemetry_rls.sql` - RLS policies for telemetry
- `20260215000005_simplify_telemetry_rls.sql` - Simplified RLS
- `20260215000006_ultra_simple_telemetry_rls.sql` - Final RLS fix

### Device Types (Priority: HIGH - just created)

- `20260219000001_device_types.sql` - Creates device_types table
- `20260219000002_devices_device_type_fk.sql` - Links devices to device types
- `20260220000002_auto_create_device_types.sql` - Auto-creates 42 device types

### Recent Features (Priority: MEDIUM)

- `20260216000010_ai_insights_cache.sql` - AI insights caching
- `20260218000003_feedback_table.sql` - User feedback system
- `20260218100000_access_requests.sql` - Access request system
- `20260219000000_ai_insights_cache.sql` - Updated AI insights

## How to Apply Migrations

### Option 1: Via Supabase Dashboard (RECOMMENDED)

1. **Get Service Role Key:**
   - Go to https://supabase.com/dashboard
   - Select staging project: `atgbmxicqikmapfqouco`
   - Settings → API → Copy `service_role` key

2. **Go to SQL Editor:**
   - Dashboard → SQL Editor → New Query

3. **Apply Each Migration:**
   - Open each `.sql` file from `supabase/migrations/`
   - Copy entire contents
   - Paste into SQL Editor
   - Click "Run"
   - Check for errors

4. **Start with Critical Migrations (in order):**

   ```bash
   # 1. MQTT/Telemetry foundation
   20250109000002_mqtt_history_tables.sql

   # 2. Device telemetry (FIXES AI ANALYTICS!)
   20250109000003_telemetry_all_integrations.sql

   # 3. Telemetry RLS (security)
   20260215000002_fix_telemetry_rls.sql
   20260215000005_simplify_telemetry_rls.sql
   20260215000006_ultra_simple_telemetry_rls.sql

   # 4. Device types (FIXES ADD DEVICE!)
   20260219000001_device_types.sql
   20260219000002_devices_device_type_fk.sql
   20260220000002_auto_create_device_types.sql
   ```

### Option 2: Via Script with Manual Key

```bash
# Export the service role key from Supabase dashboard
export STAGING_SERVICE_ROLE_KEY="your-key-here"

# Check which migrations are missing
node scripts/check-staging-migrations.js

# Or apply via our backfill script
SUPABASE_URL=https://atgbmxicqikmapfqouco.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=$STAGING_SERVICE_ROLE_KEY \
node scripts/backfill-device-types-all-orgs.js
```

### Option 3: Automated GitHub Workflow (FUTURE)

Create `.github/workflows/apply-staging-migrations.yml`:

```yaml
name: Apply Migrations to Staging
on:
  workflow_dispatch: # Manual trigger only

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - name: Apply migrations
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        run: |
          cd development
          supabase link --project-ref atgbmxicqikmapfqouco
          supabase db push
```

## Verification

After applying migrations, verify:

```bash
# Check tables exist
# In Supabase Dashboard > SQL Editor:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'device_telemetry_history',
    'device_types'
  );

# Should return both tables
```

## Expected Results

- ✅ AI Analytics page loads without 400 error
- ✅ Shows "No data available" instead of crashing
- ✅ Add Device dialog shows device type dropdown
- ✅ Device types auto-created for new organizations

## Rollback (if needed)

Migrations can be reverted via SQL Editor:

```sql
DROP TABLE IF EXISTS device_telemetry_history CASCADE;
DROP TABLE IF EXISTS device_types CASCADE;
```

## Next Steps

Once critical migrations are applied:

1. Test AI Analytics page (should load cleanly)
2. Test Add Device flow (should show device types)
3. Apply remaining migrations at your convenience
4. Consider automated migration workflow for future deployments
