# Auto-Sync Cron Setup Guide - Staging Environment

## Overview

Sets up automated 5-minute polling from Golioth API to provide redundancy alongside real-time webhooks.

**Architecture:**
- **Push (Webhooks)**: Real-time telemetry when devices send data → `integration-webhook`
- **Pull (Cron)**: Every 5 minutes, fetch all data from Golioth API → `auto-sync-cron`

---

## Quick Setup (3 Steps)

### Step 1: Deploy Edge Function

```bash
cd development

# Deploy auto-sync-cron to staging
npx supabase functions deploy auto-sync-cron \
  --project-ref atgbmxicqikmapfqouco \
  --no-verify-jwt
```

**Alternative (if CLI fails):**
1. Go to: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/functions
2. Click "New Edge Function"
3. Upload `supabase/functions/auto-sync-cron/index.ts`

---

### Step 2: Configure Secrets Table

Go to **Supabase SQL Editor**: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql

Run this SQL:

```sql
-- Create secrets table for cron to use
CREATE TABLE IF NOT EXISTS public.pg_cron_secrets (
  name TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pg_cron_secrets ENABLE ROW LEVEL SECURITY;

-- Allow service role to access secrets
DROP POLICY IF EXISTS "Service role can manage secrets" ON public.pg_cron_secrets;
CREATE POLICY "Service role can manage secrets"
  ON public.pg_cron_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert the secrets
INSERT INTO public.pg_cron_secrets (name, secret) 
VALUES 
  ('project_url', 'https://atgbmxicqikmapfqouco.supabase.co'),
  ('service_role_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY')
ON CONFLICT (name) 
DO UPDATE SET 
  secret = EXCLUDED.secret,
  updated_at = now();

-- Verify
SELECT name, left(secret, 30) || '...' as secret_preview, created_at 
FROM public.pg_cron_secrets;
```

**Expected output:**
```
name              | secret_preview                | created_at
------------------+-------------------------------+------------
project_url       | https://atgbmxicqikmapfqouco. | 2026-02-15...
service_role_key  | eyJhbGciOiJIUzI1NiIsInR5cCI6Ik... | 2026-02-15...
```

---

### Step 3: Create Cron Job

Still in **Supabase SQL Editor**, run this SQL:

```sql
-- Enable pg_cron extension (required for scheduled jobs)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if present (idempotent)
SELECT cron.unschedule('auto-sync-cron-job') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-sync-cron-job');

-- Create the cron job (runs every 5 minutes)
SELECT cron.schedule(
  'auto-sync-cron-job',           -- Job name
  '*/5 * * * *',                   -- Schedule: every 5 minutes
  $$
  SELECT net.http_post(
    url := (SELECT secret FROM public.pg_cron_secrets WHERE name = 'project_url') 
           || '/functions/v1/auto-sync-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT secret FROM public.pg_cron_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object(
      'time', now(),
      'source', 'pg_cron'
    )
  ) AS request_id;
  $$
);

-- Verify the job was created
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job 
WHERE jobname = 'auto-sync-cron-job';
```

**Expected output:**
```
jobid | jobname           | schedule     | active | database
------+-------------------+--------------+--------+---------
1     | auto-sync-cron-job| */5 * * * *  | t      | postgres
```

---

## Verification

### 1. Check Integration Activity Logs

Wait 5 minutes, then run:

```bash
node scripts/check-webhook-config.js
```

Look for `sync_import` activity types.

### 2. Check Cron Job Runs

In **Supabase SQL Editor**:

```sql
-- Check recent cron executions
SELECT 
  runid,
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-cron-job')
ORDER BY start_time DESC 
LIMIT 10;
```

### 3. Watch Edge Function Logs

```bash
# Real-time logs
npx supabase functions logs auto-sync-cron \
  --project-ref atgbmxicqikmapfqouco \
  --follow
```

Or via dashboard: https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/logs/edge-functions

---

## How It Works

### Data Flow

```
Every 5 minutes:
pg_cron → Calls auto-sync-cron edge function
         → Queries device_integrations for enabled syncs
         → Calls Golioth API (/projects/{id}/devices/{id}/data)
         → Stores in device_telemetry_history
         → Updates device.last_seen
         → Logs to integration_activity_log
```

### What Gets Synced

- Device telemetry data (LightDB Stream)
- Device status updates
- Device metadata changes
- Firmware status

### Filters Applied

Only syncs when:
- Integration has `syncEnabled: true`
- Integration status is `active`
- Current time is within time window (if configured)
- Device matches filter criteria (if configured)

---

## Troubleshooting

### Problem: Cron job not running

**Check job exists:**
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-sync-cron-job';
```

**Check job is active:**
```sql
-- Should show active = true
SELECT jobid, jobname, active FROM cron.job WHERE jobname = 'auto-sync-cron-job';
```

**Check for errors:**
```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-cron-job')
ORDER BY start_time DESC 
LIMIT 5;
```

### Problem: Edge function fails

**Check logs:**
```bash
npx supabase functions logs auto-sync-cron --project-ref atgbmxicqikmapfqouco
```

**Common issues:**
- Missing SUPABASE_SERVICE_ROLE_KEY environment variable
- Golioth API credentials missing/invalid
- Integration not found or disabled

### Problem: No data being synced

**Check integration settings:**
```sql
SELECT 
  name,
  status,
  settings->>'syncEnabled' as sync_enabled,
  settings->>'syncIntervalSeconds' as interval,
  last_sync_at
FROM device_integrations
WHERE integration_type = 'golioth';
```

**Should show:**
- `status`: `active`
- `sync_enabled`: `true`
- `last_sync_at`: Updated every 5 minutes

---

## Configuration Options

### Change Sync Interval

Currently: Every 5 minutes (`*/5 * * * *`)

To change (e.g., every 10 minutes):

```sql
-- Reschedule with new interval
SELECT cron.unschedule('auto-sync-cron-job');

SELECT cron.schedule(
  'auto-sync-cron-job',
  '*/10 * * * *',  -- Changed to 10 minutes
  $$ ... $$  -- Same SQL as before
);
```

### Disable Cron (But Keep Webhooks)

```sql
-- Temporarily disable
SELECT cron.unschedule('auto-sync-cron-job');

-- Re-enable later by running the schedule command again
```

### Monitor Sync Performance

```sql
-- Average sync duration
SELECT 
  AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_seconds,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'succeeded') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-sync-cron-job')
  AND start_time > now() - interval '24 hours';
```

---

## Cost Considerations

### API Calls

- **Frequency**: 12 calls/hour (every 5 minutes)
- **Per day**: 288 calls
- **Per month**: ~8,640 calls

**Golioth API limits:**
- Free tier: Usually 10,000 calls/month
- Staging should be well within limits

### Supabase Resources

- **Edge Function invocations**: 288/day
- **Database storage**: Minimal (just telemetry data)
- **Bandwidth**: ~1-5 MB/day depending on device count

---

## Security Notes

### Secrets Storage

- Secrets stored in `pg_cron_secrets` table
- Protected by Row Level Security (RLS)
- Only accessible by service role
- **Important**: These are the same credentials shown in this doc (staging only)

### Production Setup

For production, use different secrets:
1. Generate new webhook secret
2. Use production Supabase service role key
3. Store in separate `pg_cron_secrets` entries
4. Never commit secrets to git

---

## Comparison: Push vs Pull

| Feature | Webhook (Push) | Cron (Pull) |
|---------|----------------|-------------|
| **Latency** | < 1 second | Up to 5 minutes |
| **Reliability** | Depends on Golioth | Guaranteed |
| **Missed Events** | Lost if down | Catches up |
| **API Usage** | Zero | 8,640/month |
| **Setup Complexity** | Simple | Moderate |
| **Historical Data** | No | Yes |

**Best Practice**: Use both for redundancy.

---

## Summary

After setup, you'll have:

✅ Real-time webhooks for instant updates  
✅ 5-minute cron for catching missed events  
✅ Full redundancy matching production  
✅ Historical data backfill capability

**Next webhook from device M260600008 will:**
1. Arrive instantly via webhook (push)
2. Be caught by cron within 5 minutes (pull)
3. Appear in both `integration_activity_log` entries

---

**Last Updated:** 2026-02-15  
**Environment:** Staging (atgbmxicqikmapfqouco)  
**Status:** Ready to deploy
