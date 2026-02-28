#!/bin/bash

# =============================================================================
# Setup Auto-Sync Cron for Staging Environment
# =============================================================================
# Sets up the 5-minute cron job to pull data from Golioth API
# Provides redundancy alongside the real-time webhook push
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Staging configuration
STAGING_PROJECT_REF="atgbmxicqikmapfqouco"
STAGING_URL="https://atgbmxicqikmapfqouco.supabase.co"
STAGING_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Auto-Sync Cron Setup for Staging${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Step 1: Check if edge function exists locally
echo -e "${YELLOW}Step 1: Checking edge function...${NC}"
if [ ! -f "supabase/functions/auto-sync-cron/index.ts" ]; then
    echo -e "${RED}❌ auto-sync-cron edge function not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Edge function found${NC}\n"

# Step 2: Deploy edge function
echo -e "${YELLOW}Step 2: Deploying auto-sync-cron edge function...${NC}"
echo -e "${BLUE}Note: This requires Supabase CLI authentication${NC}"
echo -e "${BLUE}If this fails, deploy manually via Supabase Dashboard${NC}\n"

# Try to deploy (may fail if not authenticated)
if npx supabase functions deploy auto-sync-cron --project-ref "$STAGING_PROJECT_REF" --no-verify-jwt 2>/dev/null; then
    echo -e "${GREEN}✅ Edge function deployed${NC}\n"
else
    echo -e "${YELLOW}⚠️  CLI deployment failed (authentication required)${NC}"
    echo -e "${BLUE}Manual deployment steps:${NC}"
    echo -e "  1. Go to: https://supabase.com/dashboard/project/${STAGING_PROJECT_REF}/functions"
    echo -e "  2. Click 'Deploy new function'"
    echo -e "  3. Select 'auto-sync-cron' from local files"
    echo -e "  4. Deploy\n"
    read -p "Press Enter after manual deployment, or Ctrl+C to exit..."
fi

# Step 3: Set up pg_cron_secrets table
echo -e "${YELLOW}Step 3: Setting up cron secrets...${NC}"

cat > /tmp/setup_cron_secrets.sql << 'EOF'
-- Create pg_cron_secrets table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.pg_cron_secrets (
    name TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (but allow pg_cron to access)
ALTER TABLE public.pg_cron_secrets ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage secrets
CREATE POLICY IF NOT EXISTS "Service role can manage secrets"
    ON public.pg_cron_secrets
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Insert or update the secrets
INSERT INTO public.pg_cron_secrets (name, secret) 
VALUES 
    ('project_url', 'https://atgbmxicqikmapfqouco.supabase.co'),
    ('service_role_key', ${SUPABASE_SERVICE_ROLE_KEY})
ON CONFLICT (name) 
DO UPDATE SET 
    secret = EXCLUDED.secret,
    updated_at = now();

-- Verify
SELECT name, 
       left(secret, 20) || '...' as secret_preview,
       created_at 
FROM public.pg_cron_secrets;
EOF

echo -e "${BLUE}Executing SQL to set up secrets table...${NC}"
if command -v psql &> /dev/null; then
    psql "${STAGING_DB_URL:?Set STAGING_DB_URL env var}" \
        -f /tmp/setup_cron_secrets.sql
    echo -e "${GREEN}✅ Secrets configured${NC}\n"
else
    echo -e "${YELLOW}⚠️  psql not found${NC}"
    echo -e "${BLUE}Run this SQL manually in Supabase SQL Editor:${NC}\n"
    cat /tmp/setup_cron_secrets.sql
    echo ""
    read -p "Press Enter after running the SQL manually, or Ctrl+C to exit..."
fi

rm -f /tmp/setup_cron_secrets.sql

# Step 4: Create the cron job
echo -e "${YELLOW}Step 4: Creating cron job (runs every 5 minutes)...${NC}"

cat > /tmp/setup_cron_job.sql << 'EOF'
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any existing job with the same name
SELECT cron.unschedule('auto-sync-cron-job') 
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'auto-sync-cron-job'
);

-- Create the cron job to run every 5 minutes
SELECT cron.schedule(
    'auto-sync-cron-job',           -- Job name
    '*/5 * * * *',                   -- Every 5 minutes
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
    command,
    nodename,
    nodeport,
    database,
    username,
    active
FROM cron.job 
WHERE jobname = 'auto-sync-cron-job';
EOF

echo -e "${BLUE}Executing SQL to create cron job...${NC}"
if command -v psql &> /dev/null; then
    psql "${STAGING_DB_URL:?Set STAGING_DB_URL env var}" \
        -f /tmp/setup_cron_job.sql
    echo -e "${GREEN}✅ Cron job created${NC}\n"
else
    echo -e "${YELLOW}⚠️  psql not found${NC}"
    echo -e "${BLUE}Run this SQL manually in Supabase SQL Editor:${NC}\n"
    cat /tmp/setup_cron_job.sql
    echo ""
    read -p "Press Enter after running the SQL manually, or Ctrl+C to exit..."
fi

rm -f /tmp/setup_cron_job.sql

# Step 5: Verify setup
echo -e "${YELLOW}Step 5: Verifying setup...${NC}"

cat > /tmp/verify_setup.sql << 'EOF'
-- Check if cron job exists and is active
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Cron job is configured'
        ELSE '❌ Cron job not found'
    END as cron_status,
    MAX(schedule) as schedule,
    MAX(active::text) as active
FROM cron.job 
WHERE jobname = 'auto-sync-cron-job';

-- Check recent job runs
SELECT 
    '📊 Recent cron runs:' as info;

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
LIMIT 5;

-- Check Golioth integration settings
SELECT 
    '🔄 Golioth sync settings:' as info;

SELECT 
    name,
    integration_type,
    status,
    (settings->>'syncEnabled')::boolean as sync_enabled,
    (settings->>'syncIntervalSeconds')::int as interval_seconds,
    settings->>'syncDirection' as direction,
    last_sync_at
FROM device_integrations
WHERE integration_type = 'golioth';
EOF

if command -v psql &> /dev/null; then
    psql "${STAGING_DB_URL:?Set STAGING_DB_URL env var}" \
        -f /tmp/verify_setup.sql
else
    echo -e "${YELLOW}⚠️  psql not found - skipping verification${NC}"
    echo -e "${BLUE}Run verify_setup.sql manually to check status${NC}"
fi

rm -f /tmp/verify_setup.sql

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}What was configured:${NC}"
echo -e "  ✅ auto-sync-cron edge function deployed"
echo -e "  ✅ pg_cron_secrets table created"
echo -e "  ✅ Cron job scheduled (every 5 minutes)"
echo -e "  ✅ Pulling from Golioth API enabled\n"

echo -e "${BLUE}Data flow now:${NC}"
echo -e "  📥 Push: Golioth webhooks → integration-webhook (real-time)"
echo -e "  📥 Pull: Cron job → auto-sync-cron → Golioth API (every 5 min)\n"

echo -e "${BLUE}Monitor the sync:${NC}"
echo -e "  # Check cron job status"
echo -e "  node scripts/check-webhook-config.js"
echo -e ""
echo -e "  # Watch edge function logs"
echo -e "  npx supabase functions logs auto-sync-cron --project-ref $STAGING_PROJECT_REF\n"

echo -e "${BLUE}Next steps:${NC}"
echo -e "  1. Wait 5 minutes for first cron run"
echo -e "  2. Check integration_activity_log for 'sync_import' events"
echo -e "  3. Verify device_telemetry_history has new data\n"

echo -e "${YELLOW}Note: The cron will start pulling data every 5 minutes automatically.${NC}"
echo -e "${YELLOW}This provides redundancy alongside your webhook push.${NC}\n"
