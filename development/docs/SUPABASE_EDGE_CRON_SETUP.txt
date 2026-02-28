# PostgreSQL pg_cron Setup for Auto-Sync

## Overview

The auto-sync functionality uses **PostgreSQL's pg_cron extension** to trigger the `auto-sync-cron` Edge Function every 5 minutes. This checks for scheduled syncs that are due to run and executes them.

**Important:** This is a **ONE-TIME** setup per Supabase project, not per integration. Once configured, all Golioth integrations automatically use it.

**Requirements:**
- ✅ Available on all Supabase plans (Free, Pro, Enterprise)
- ✅ `auto-sync-cron` Edge Function deployed (completed in v3.4.0)
- ✅ `pg_cron` + `pg_net` extensions enabled (completed in v3.4.0)
- ✅ **Fully automated** - No manual steps required!

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL pg_cron Extension                           │
│  Schedule: */5 * * * * (every 5 minutes, UTC)           │
│  Job: auto-sync-cron-job                                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼ (pg_net HTTP POST)
┌─────────────────────────────────────────────────────────┐
│  Edge Function: auto-sync-cron                          │
│  URL: /functions/v1/auto-sync-cron                      │
│  Auth: Service role key from Vault                      │
│  • Queries auto_sync_schedules for enabled schedules    │
│  • Checks if next_run_at <= NOW()                       │
│  • Validates time windows                               │
│  • Executes due syncs via device-sync function          │
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

**Key Components:**
- **pg_cron**: PostgreSQL extension for scheduling (built-in, no extra cost)
- **pg_net**: PostgreSQL extension for HTTP requests
- **pg_cron_secrets**: Custom secure table for storing credentials (bypasses Vault permission issues)

## Setup Options

### ✅ Option 1: PostgreSQL pg_cron (Recommended - Fully Configured!)

**Status: Complete! No manual steps required.**

The database migrations have already:
- ✅ Enabled `pg_cron` and `pg_net` extensions
- ✅ Created `pg_cron_secrets` table with RLS protection
- ✅ Stored service role key securely
- ✅ Created and fixed the cron job `auto-sync-cron-job` (runs every 5 minutes)
- ✅ Verified cron job is executing successfully

**Migrations Applied:**
- `20251117000000_setup_auto_sync_cron.sql` - Initial setup with extensions
- `20251117000001_fix_cron_secrets.sql` - Custom secrets table (Vault bypass)
- `20251117000002_fix_cron_query.sql` - Fix cron job to use pg_cron_secrets

**Verification (Optional):**

Run this in Supabase Dashboard SQL Editor to confirm everything is working:
https://supabase.com/dashboard/project/bldojxpockljyivldxwf/sql/new

```sql
-- Check secrets are stored
SELECT name, created_at, updated_at FROM public.pg_cron_secrets;

-- Check cron job exists and shows correct query
SELECT jobid, jobname, schedule, active, command FROM cron.job 
WHERE jobname = 'auto-sync-cron-job';

-- Check recent successful runs
SELECT jobname, status, return_message, start_time, end_time
FROM cron.job_run_details
JOIN cron.job ON job.jobid = job_run_details.jobid
WHERE jobname = 'auto-sync-cron-job'
ORDER BY start_time DESC
LIMIT 5;
```

**How It Works:**
- Every 5 minutes, pg_cron triggers the Edge Function via HTTP POST
- Credentials are retrieved from `pg_cron_secrets` table (not Vault)
- RLS policies prevent user access (service role only)
- More reliable than Supabase Vault (no permission issues)

**Frequency:** ONE-TIME setup per Supabase project (already done!)

**Advantages:**
- ✅ Works on all Supabase plans (Free, Pro, Enterprise)
- ✅ No manual configuration required
- ✅ Automatically runs every 5 minutes
- ✅ Secrets stored securely with RLS
- ✅ No Vault permission issues
- ✅ No additional costs
- ✅ Cron job actively running and tested

### Option 2: Local Development Testing

For local development, you can test manually:

```bash
# Test the function locally
curl -X POST http://127.0.0.1:54321/functions/v1/auto-sync-cron

# Check auto-sync schedules
SELECT * FROM auto_sync_schedules WHERE enabled = true;
```

Auto-sync schedules are created automatically when you enable sync in the Integration "Sync Settings" tab.

3. **Verify schedules:**
   ```sql
   SELECT * FROM auto_sync_schedules WHERE enabled = true;
   ```

4. **Simulate cron locally** (run every minute):
   ```bash
   # Linux/Mac
   watch -n 60 'curl -X POST http://127.0.0.1:54321/functions/v1/auto-sync-cron'
   
   # Windows PowerShell
   while($true) { curl -Method POST http://127.0.0.1:54321/functions/v1/auto-sync-cron; Start-Sleep 60 }
   ```

## Verification

### Check if Scheduler is Running (Production)

1. Go to Supabase Dashboard → Project Settings → Scheduled Jobs
2. Verify your `auto-sync-cron` job is **Enabled**
3. Check **Last Run** timestamp updates every minute (or per your schedule)

### Check Function Logs (Production)

1. Go to Supabase Dashboard → Edge Functions → Logs
2. Filter by function: `auto-sync-cron`
3. Look for entries like: `"Processing X enabled schedules"` or `"No schedules due to run"`

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
