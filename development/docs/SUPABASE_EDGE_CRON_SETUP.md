# Supabase Edge Cron Setup

## Overview

The auto-sync functionality requires a Supabase Edge Cron job to trigger the `auto-sync-cron` function every minute. This checks for scheduled syncs that are due to run and executes them.

**Important:** This is a **ONE-TIME** setup per Supabase project, not per integration. Once configured, all Golioth integrations automatically use it.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Supabase Edge Cron (Project-Level Infrastructure)     │
│  Runs: * * * * * (every minute)                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Edge Function: auto-sync-cron                          │
│  • Queries auto_sync_schedules for enabled schedules    │
│  • Checks if next_run_at <= NOW()                       │
│  • Validates time windows                               │
│  • Executes due syncs                                   │
│  • Updates last_run_at and next_run_at                  │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Database: auto_sync_schedules                          │
│  • Created per integration via UI "Sync Settings" tab   │
│  • frequency_minutes, time_window_start/end, enabled    │
│  • Automatically calculates next_run_at via trigger     │
└─────────────────────────────────────────────────────────┘
```

## Setup Options

### Option 1: Supabase Dashboard (Current Recommended)

**Steps:**

1. Go to your Supabase project dashboard: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF/functions`

2. Click on the `auto-sync-cron` function

3. Navigate to the **"Cron"** tab

4. Enable cron scheduling with:
   - **Schedule:** `* * * * *` (every minute)
   - **Enabled:** ✅ Yes

5. Save configuration

**When:** Required for production deployment

**Frequency:** ONE-TIME per Supabase project

### Option 2: Supabase CLI (Future - Check Availability)

```bash
# Check if CLI supports cron scheduling
supabase functions deploy auto-sync-cron \
  --project-ref YOUR_PROJECT_REF \
  --schedule "* * * * *"
```

**Status:** Not yet verified if supported by Supabase CLI. Check Supabase documentation for latest CLI capabilities.

### Option 3: Local Development (Manual Testing)

For local development, the cron job doesn't need to be running. You can:

1. **Test manually:**
   ```bash
   curl http://127.0.0.1:54321/functions/v1/auto-sync-cron
   ```

2. **Use UI:** Auto-sync schedules are created automatically when you enable sync in the "Sync Settings" tab

3. **Verify schedules:**
   ```sql
   SELECT * FROM auto_sync_schedules WHERE enabled = true;
   ```

## Verification

### Check if Cron is Running (Production)

1. Go to Supabase Dashboard → Functions → auto-sync-cron → Logs
2. You should see execution logs every minute
3. Look for entries like: `"Processing X enabled schedules"`

### Check Schedule Execution (Database)

```sql
-- View all schedules
SELECT 
  id,
  integration_id,
  frequency_minutes,
  enabled,
  last_run_at,
  next_run_at,
  time_window_start,
  time_window_end
FROM auto_sync_schedules
ORDER BY next_run_at;

-- Check recent runs
SELECT 
  integration_id,
  last_run_at,
  next_run_at,
  frequency_minutes
FROM auto_sync_schedules 
WHERE last_run_at IS NOT NULL
ORDER BY last_run_at DESC;
```

## Deployment Checklist

### Local Development
- ✅ Edge functions deployed via `npm run supabase:start`
- ✅ Database migration applied (20250109000001_auto_sync_schedules.sql)
- ✅ No cron setup needed (test manually if needed)

### Production Deployment
- ✅ Deploy edge functions: `supabase functions deploy auto-sync-cron`
- ✅ Verify database migration applied
- ⚠️ **ONE-TIME:** Configure Edge Cron via Dashboard (see Option 1 above)
- ✅ Create first sync schedule via UI to test

## Troubleshooting

### Syncs Not Running

1. **Check cron is enabled:**
   - Dashboard → Functions → auto-sync-cron → Cron tab
   - Verify schedule is `* * * * *` and enabled

2. **Check schedules exist:**
   ```sql
   SELECT * FROM auto_sync_schedules WHERE enabled = true;
   ```

3. **Check function logs:**
   - Dashboard → Functions → auto-sync-cron → Logs
   - Look for errors or "No enabled schedules found" messages

4. **Verify time windows:**
   - Schedules only run within configured time_window_start/end
   - Check current time is within window

### Manual Trigger (Testing)

```bash
# Local
curl -X POST http://127.0.0.1:54321/functions/v1/auto-sync-cron

# Production
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-sync-cron \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Security Notes

- Edge Cron runs with **service role** privileges (bypasses RLS)
- The `auto-sync-cron` function has proper error handling and logging
- Schedules are scoped to integrations (user-level isolation)
- Time windows prevent runaway syncs

## Cost Considerations

- Edge Cron executions count against Edge Function invocations quota
- Running every minute = ~43,200 invocations/month
- Each execution is fast (queries + conditional sync)
- Syncs only execute when schedules are due

## Next Steps

1. **For Production:** Follow Option 1 (Dashboard setup) as ONE-TIME configuration
2. **For CI/CD:** Add verification step to deployment workflow
3. **For Monitoring:** Set up alerts on function errors or missed executions
4. **Documentation:** Link this guide in main README deployment section

---

**Last Updated:** 2025-01-13  
**Supabase Version:** Compatible with Edge Runtime v1.x  
**Status:** Production-ready (requires manual cron setup in dashboard)
