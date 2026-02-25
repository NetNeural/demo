# Import Sensor Telemetry Data (Production → Staging)

**Purpose:** Import historical telemetry data from production Supabase to staging for sensors that already exist in staging.

**Important:** This script does NOT create new sensors - it only imports telemetry data for existing devices.

---

## Prerequisites

You need access to:
1. **Production Supabase credentials** (URL + Service Role Key)
2. **Staging Supabase credentials** (Service Role Key)

---

## Quick Start

### 1. Set Environment Variables

```bash
export PROD_SUPABASE_URL='https://your-prod-project.supabase.co'
export PROD_SUPABASE_SERVICE_ROLE_KEY='eyJhbGc...'
export STAGE_SUPABASE_SERVICE_ROLE_KEY='eyJhbGc...'

# Optional: Number of days to import (default: 30)
export DAYS_TO_IMPORT=30
```

### 2. Run the Import

```bash
cd development
./scripts/import-sensor-data.sh
```

---

## What It Does

1. **Fetches all devices** from staging database
2. **Matches each staging device** to production by `serial_number` or `external_device_id`
3. **Retrieves telemetry data** from production for the last N days (default: 30)
4. **Checks for duplicates** - skips timestamps that already exist in staging
5. **Imports new records** in batches of 500
6. **Reports summary** - devices processed and records imported

---

## Example Output

```
🔍 Starting sensor data import from production to staging...

📊 Configuration:
   Production: https://xxxxxx.supabase.co
   Staging:    https://atgbmxicqikmapfqouco.supabase.co
   Days:       30

📋 Step 1: Fetching staging devices...
   ✅ Found 3 devices in staging

🔄 Processing: Sensor A (M260600005)
   ✅ Found matching production device (ID: abc123)
   📥 Fetching telemetry data from production (last 30 days)...
   📊 Found 1500 telemetry records
   📤 Importing 1200 new telemetry records...
   ✅ Imported 1200/1200 records

🔄 Processing: Sensor B (M260600008)
   ✅ Found matching production device (ID: def456)
   📥 Fetching telemetry data from production (last 30 days)...
   📊 Found 800 telemetry records
   ✅ All telemetry data already exists in staging

✅ Import complete!
📊 Summary:
   Devices processed: 3
   Total records imported: 1200
   Date range: 2026-01-17T... to now
```

---

## Configuration Options

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PROD_SUPABASE_URL` | ✅ Yes | - | Production Supabase project URL |
| `PROD_SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | - | Production service role key |
| `STAGE_SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes | - | Staging service role key |
| `STAGE_SUPABASE_URL` | No | `atgbmxicqikmapfqouco` | Staging Supabase URL |
| `DAYS_TO_IMPORT` | No | `30` | Number of days of history |

---

## Safety Features

✅ **No sensor creation** - Only imports data for existing devices  
✅ **Duplicate detection** - Skips telemetry records that already exist  
✅ **Batch processing** - Imports in batches of 500 to avoid timeouts  
✅ **Error handling** - Continues processing other devices if one fails  
✅ **Read-only on prod** - Only reads from production, never writes  

---

## Troubleshooting

### "No matching device in production"
- The staging device doesn't exist in production
- Check that `serial_number` or `external_device_id` match between environments

### "Failed to fetch staging devices"
- Check `STAGE_SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify staging URL is accessible

### "Error fetching telemetry"
- Check `PROD_SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify production URL is accessible
- Check that service role key has read permissions on `device_telemetry_history`

### Import is slow
- Reduce `DAYS_TO_IMPORT` to import less history
- This is normal for large datasets (batches of 500 records)

---

## How to Get Service Role Keys

### Production Supabase
1. Go to: https://supabase.com/dashboard/project/YOUR-PROD-PROJECT/settings/api
2. Scroll to "Project API keys"
3. Copy the `service_role` key (starts with `eyJhbGc...`)

### Staging Supabase
1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/settings/api
2. Scroll to "Project API keys"
3. Copy the `service_role` key

⚠️ **Security Note:** Service role keys bypass RLS. Never commit them to git or expose them publicly.

---

## Re-running the Import

You can safely re-run this script multiple times. It will:
- ✅ Skip telemetry records that already exist (by timestamp)
- ✅ Only import new data since last run
- ✅ Not create duplicate records

---

## Alternative: Import Specific Date Range

```bash
# Import only last 7 days
export DAYS_TO_IMPORT=7
./scripts/import-sensor-data.sh

# Import last 90 days
export DAYS_TO_IMPORT=90
./scripts/import-sensor-data.sh
```

---

**Last Updated:** February 16, 2026  
**Status:** Ready to use  
**Environment:** Staging (atgbmxicqikmapfqouco)
