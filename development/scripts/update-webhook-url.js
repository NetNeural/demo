#!/usr/bin/env node

/**
 * Update Golioth webhook URL to production endpoint
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const INTEGRATION_ID = '4be0f2e1-3912-4d2b-9488-ad11d9683ea7';

async function updateWebhookUrl() {
  console.log('🔧 Updating Golioth webhook URL to production endpoint...\n');
  
  // Get current configuration
  const { data: integration, error: fetchError } = await supabase
    .from('device_integrations')
    .select('webhook_url, webhook_secret')
    .eq('id', INTEGRATION_ID)
    .single();
  
  if (fetchError) {
    console.error('❌ Error fetching integration:', fetchError);
    return;
  }
  
  console.log('📋 Current Configuration:');
  console.log(`   URL: ${integration.webhook_url}`);
  console.log(`   Secret: ${integration.webhook_secret}`);
  console.log('');
  
  // Update to production URL
  const newWebhookUrl = `${SUPABASE_URL}/functions/v1/integration-webhook`;
  
  const { error: updateError } = await supabase
    .from('device_integrations')
    .update({
      webhook_url: newWebhookUrl
    })
    .eq('id', INTEGRATION_ID);
  
  if (updateError) {
    console.error('❌ Error updating webhook URL:', updateError);
    return;
  }
  
  console.log('✅ Webhook URL updated successfully!\n');
  console.log('📋 New Configuration:');
  console.log(`   URL: ${newWebhookUrl}`);
  console.log('');
  console.log('🔗 Configure in Golioth webhook settings:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('   Webhook URL:');
  console.log(`   ${newWebhookUrl}`);
  console.log('');
  console.log('   Headers:');
  console.log(`   Content-Type: application/json`);
  console.log(`   X-Integration-ID: ${INTEGRATION_ID}`);
  console.log(`   X-Golioth-Signature: {{hmac_sha256}}`);
  console.log('');
  console.log('   Signing Configuration:');
  console.log(`   Algorithm: HMAC-SHA256`);
  console.log(`   Header Name: X-Golioth-Signature`);
  console.log(`   Secret: ${integration.webhook_secret}`);
  console.log('');
  console.log('   Events to Subscribe:');
  console.log('   ☑ device.telemetry');
  console.log('   ☑ device.updated');
  console.log('   ☑ device.created');
  console.log('   ☑ device.online');
  console.log('   ☑ device.offline');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. Go to Golioth Console → Your Project → Webhooks');
  console.log('   2. Create or update webhook with the configuration above');
  console.log('   3. Test by triggering a device event');
  console.log('   4. Check activity logs in NetNeural to verify it works');
  console.log('');
}

updateWebhookUrl().catch(console.error);
