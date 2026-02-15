#!/usr/bin/env node

/**
 * Check Golioth integration webhook configuration
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const INTEGRATION_ID = '4be0f2e1-3912-4d2b-9488-ad11d9683ea7';

async function checkWebhookConfig() {
  console.log('🔍 Checking Golioth webhook configuration...\n');
  
  const { data: integration, error } = await supabase
    .from('device_integrations')
    .select('*')
    .eq('id', INTEGRATION_ID)
    .single();
  
  if (error) {
    console.error('❌ Error fetching integration:', error);
    return;
  }
  
  console.log('📋 Integration Details:');
  console.log(`   Name: ${integration.name}`);
  console.log(`   Type: ${integration.integration_type}`);
  console.log(`   Status: ${integration.status}`);
  console.log(`   Organization ID: ${integration.organization_id}`);
  console.log('');
  
  console.log('🔗 Webhook Configuration:');
  console.log(`   Enabled: ${integration.webhook_enabled ? '✅ YES' : '❌ NO'}`);
  console.log(`   URL: ${integration.webhook_url || '(not set)'}`);
  console.log(`   Secret: ${integration.webhook_secret ? '✅ SET (' + integration.webhook_secret.length + ' chars)' : '❌ NOT SET'}`);
  console.log('');
  
  if (!integration.webhook_secret) {
    console.log('⚠️  WARNING: No webhook secret configured!');
    console.log('   Signature verification will always show "not_required"');
    console.log('   This is OK for testing, but consider setting a secret for production');
    console.log('');
    console.log('💡 To set a webhook secret:');
    console.log('   1. Go to the Golioth integration settings');
    console.log('   2. Enable webhooks');
    console.log('   3. Copy the generated webhook secret');
    console.log('   4. Configure it in Golioth webhook settings');
  } else {
    console.log('✅ Webhook secret is configured');
    console.log('');
    console.log('🔐 For Golioth webhook configuration, use:');
    console.log(`   Signature Algorithm: HMAC-SHA256`);
    console.log(`   Signature Header: X-Golioth-Signature`);
    console.log(`   Secret: ${integration.webhook_secret}`);
  }
  
  console.log('');
  console.log('📊 Check recent webhooks:');
  
  const { data: logs, error: logError } = await supabase
    .from('integration_activity_log')
    .select('*')
    .eq('integration_id', INTEGRATION_ID)
    .eq('activity_type', 'webhook_received')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (logError) {
    console.error('   ❌ Error fetching logs:', logError);
  } else if (!logs || logs.length === 0) {
    console.log('   No webhook logs found');
  } else {
    console.log(`   Found ${logs.length} recent webhooks:\n`);
    logs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${new Date(log.created_at).toLocaleString()}`);
      console.log(`      Status: ${log.status}`);
      console.log(`      Signature Verification: ${log.metadata?.signature_verification || 'unknown'}`);
      if (log.request_body?.device_name) {
        console.log(`      Device: ${log.request_body.device_name}`);
      }
      if (log.response_body?.deviceId) {
        console.log(`      Device ID:${log.response_body.deviceId}`);
      }
      if (log.response_body?.deviceName) {
        console.log(`      Device Name: ${log.response_body.deviceName}`);
      }
      console.log('');
    });
  }
}

checkWebhookConfig().catch(console.error);
