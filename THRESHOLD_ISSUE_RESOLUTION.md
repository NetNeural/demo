# Temperature Threshold Not Triggering - Resolution

**Date:** February 17, 2026  
**Staging URL:** https://demo-stage.netneural.ai  
**Supabase Project:** atgbmxicqikmapfqouco

## Problem Summary

Temperature thresholds configured in the system were not triggering email alerts when breached.

## Root Causes Found

### ✅ 1. **Local Development: No Database Schema**
- **Issue:** Local Supabase had no tables (migrations not applied)
- **Fix:** Ran `npx supabase db reset` to apply all migrations

### ✅ 2. **Edge Function Bug**
- **Issue:** `alertData` was undefined because `.insert()` didn't return data
- **Fix:** Added `.select().single()` to get the inserted alert data
- **File:** `/workspaces/MonoRepo/development/supabase/functions/sensor-threshold-evaluator/index.ts`

### ✅ 3. **Staging Cron Job Configuration Error**
- **Issue:** Cron job failing with error: `unrecognized configuration parameter "app.supabase_url"`
- **Root Cause:** Database parameters not set, job tried to use `current_setting()` which failed
- **Fix:** Recreated cron job with hardcoded URLs instead of configuration parameters
- **SQL Fix Applied:**
```sql
SELECT cron.unschedule('evaluate-sensor-thresholds');

SELECT cron.schedule(
  'evaluate-sensor-thresholds',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://atgbmxicqikmapfqouco.supabase.co/functions/v1/sensor-threshold-evaluator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### 🔍 4. **Pending: Edge Function Deployment Status**
- **Next Step:** Verify if `sensor-threshold-evaluator` is deployed to staging
- **Check:** https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/functions
- **If Missing:** Deploy using GitHub Actions or Supabase CLI

## Current Threshold Configuration (Staging)

| Device | Sensor | Threshold | Notify |
|--------|--------|-----------|--------|
| M260600005 | Temperature | critical_max: 32°C | ✅ Email: chris@itwgs.com |
| M260600008 | Temperature | 30-36°C (warning: 33-34°C) | ✅ Email: chris@itwgs.com |
| M260600008 | Humidity | 75-95% (warning: 80-90%) | ✅ Multiple users |

## Next Steps

### Option 1: Deploy via GitHub Actions ⭐ **RECOMMENDED**

1. Go to: https://github.com/NetNeural/MonoRepo-Staging/actions/workflows/deploy-staging-edge-functions.yml
2. Click **"Run workflow"**
3. Select:
   - Branch: `main`
   - Function: `sensor-threshold-evaluator` (or `all`)
4. Wait for completion (~2 minutes)

### Option 2: Deploy via Supabase CLI

```bash
cd /workspaces/MonoRepo/development

# Login to Supabase (one-time)
npx supabase login

# Deploy the fixed function
npx supabase functions deploy sensor-threshold-evaluator \
  --project-ref atgbmxicqikmapfqouco \
  --no-verify-jwt

# Also deploy the email function
npx supabase functions deploy send-alert-email \
  --project-ref atgbmxicqikmapfqouco \
  --no-verify-jwt
```

### Option 3: Manual Trigger Test (Before Deployment)

Check cron logs to see what's happening:

```sql
-- Check if recent cron runs show errors
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'evaluate-sensor-thresholds')
ORDER BY start_time DESC
LIMIT 5;
```

## Verification Steps

After deploying the edge function:

### 1. Wait 5 minutes for next cron execution

### 2. Check cron logs for success:
```sql
SELECT status, return_message, start_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'evaluate-sensor-thresholds')
ORDER BY start_time DESC
LIMIT 3;
```

### 3. Check for new alerts:
```sql
SELECT id, title, severity, created_at, metadata->>'is_test' as is_test
FROM alerts
WHERE created_at > NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;
```

### 4. Check edge function logs:
- Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/functions/sensor-threshold-evaluator
- Look for recent invocations and errors

## Known Issues & Workarounds

### Issue: `telemetry_data` table doesn't exist
- **Status:** Unresolved
- **Impact:** Edge function will fail if telemetry table name is wrong
- **Fix Needed:** Find correct table name and update edge function query

**Query to find correct table:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%telemetry%' OR table_name LIKE '%device%data%')
ORDER BY table_name;
```

Likely candidates:
- `device_telemetry_history`
- `device_data`

## Files Modified

1. `/workspaces/MonoRepo/development/supabase/functions/sensor-threshold-evaluator/index.ts`
   - Added `.select().single()` to capture `alertData`

## Summary

**Status:** 🟡 **In Progress**

✅ Local development fixed (migrations applied)  
✅ Edge function code fixed (bug resolved)  
✅ Cron job configuration fixed (hardcoded URLs)  
🔍 **Pending:** Deploy edge function to staging  
🔍 **Pending:** Verify telemetry table name  
⏳ **Pending:** Test end-to-end threshold triggering

**Estimated Time to Resolution:** 10-15 minutes (deploy + test)
