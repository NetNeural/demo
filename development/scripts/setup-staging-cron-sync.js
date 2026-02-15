#!/usr/bin/env node

/**
 * Setup Auto-Sync Cron for Staging (Node.js version)
 * Sets up 5-minute cron job to pull data from Golioth API
 */

const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const STAGING_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY';

const supabase = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY);

async function setupCronSync() {
  console.log('🚀 Setting up Auto-Sync Cron for Staging\n');
  console.log('=' .repeat(70));

  try {
    // Step 1: Create pg_cron_secrets table
    console.log('\n📋 Step 1: Creating pg_cron_secrets table...');
    
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.pg_cron_secrets (
          name TEXT PRIMARY KEY,
          secret TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
        
        ALTER TABLE public.pg_cron_secrets ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Service role can manage secrets" ON public.pg_cron_secrets;
        CREATE POLICY "Service role can manage secrets"
          ON public.pg_cron_secrets
          FOR ALL
          TO service_role
          USING (true)
          WITH CHECK (true);
      `
    });

    if (tableError) {
      console.log('   ⚠️  Using alternative method (RPC may not be available)');
      console.log('   This SQL needs to be run manually in Supabase SQL Editor:\n');
      console.log(getSecretsTableSQL());
      console.log('\n   Then run:', getCronJobSQL());
      return;
    }

    console.log('   ✅ Table created');

    // Step 2: Insert secrets
    console.log('\n🔐 Step 2: Configuring secrets...');
    
    const { error: insertError } = await supabase
      .from('pg_cron_secrets')
      .upsert([
        { name: 'project_url', secret: STAGING_URL },
        { name: 'service_role_key', secret: STAGING_SERVICE_ROLE_KEY }
      ]);

    if (insertError) {
      console.error('   ❌ Failed to insert secrets:', insertError.message);
      console.log('\n   Run this SQL manually:\n');
      console.log(getSecretsInsertSQL());
      return;
    }

    console.log('   ✅ Secrets configured');

    // Step 3: Provide SQL for cron job creation
    console.log('\n⏰ Step 3: Creating cron job...');
    console.log('   📝 Run this SQL in Supabase SQL Editor:\n');
    console.log(getCronJobSQL());

    // Step 4: Check current state
    console.log('\n\n📊 Current Integration Settings:');
    const { data: integration } = await supabase
      .from('device_integrations')
      .select('*')
      .eq('integration_type', 'golioth')
      .single();

    if (integration) {
      const settings = integration.settings || {};
      console.log('   Name:', integration.name);
      console.log('   Sync Enabled:', settings.syncEnabled ? '✅ YES' : '❌ NO');
      console.log('   Sync Interval:', settings.syncIntervalSeconds, 'seconds');
      console.log('   Sync Direction:', settings.syncDirection);
      console.log('   Last Sync:', integration.last_sync_at || 'Never');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Setup Script Complete!');
    console.log('='.repeat(70));

    console.log('\n📋 Manual Steps Required:');
    console.log('1. Deploy edge function:');
    console.log('   npx supabase functions deploy auto-sync-cron --project-ref atgbmxicqikmapfqouco');
    console.log('');
    console.log('2. Run the cron job SQL (shown above) in Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/atgbmxicqikmapfqouco/sql');
    console.log('');
    console.log('3. Verify after 5 minutes:');
    console.log('   node scripts/check-webhook-config.js');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n📝 Complete SQL to run manually:\n');
    console.log(getCompleteSetupSQL());
  }
}

function getSecretsTableSQL() {
  return `-- Create pg_cron_secrets table
CREATE TABLE IF NOT EXISTS public.pg_cron_secrets (
  name TEXT PRIMARY KEY,
  secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pg_cron_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage secrets"
  ON public.pg_cron_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);`;
}

function getSecretsInsertSQL() {
  return `-- Insert secrets
INSERT INTO public.pg_cron_secrets (name, secret) 
VALUES 
  ('project_url', '${STAGING_URL}'),
  ('service_role_key', '${STAGING_SERVICE_ROLE_KEY}')
ON CONFLICT (name) 
DO UPDATE SET 
  secret = EXCLUDED.secret,
  updated_at = now();

-- Verify
SELECT name, left(secret, 30) || '...' as secret_preview FROM public.pg_cron_secrets;`;
}

function getCronJobSQL() {
  return `-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if present
SELECT cron.unschedule('auto-sync-cron-job') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-sync-cron-job');

-- Create cron job (runs every 5 minutes)
SELECT cron.schedule(
  'auto-sync-cron-job',
  '*/5 * * * *',
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

-- Verify
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'auto-sync-cron-job';`;
}

function getCompleteSetupSQL() {
  return getSecretsTableSQL() + '\n\n' + getSecretsInsertSQL() + '\n\n' + getCronJobSQL();
}

setupCronSync().catch(console.error);
