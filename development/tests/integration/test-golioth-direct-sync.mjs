// Direct API test - check integrations and trigger sync
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'YOUR_LOCAL_SUPABASE_ANON_KEY';
const ORG_ID = '00000000-0000-0000-0000-000000000001';

console.log('🧪 Direct API: Golioth Sync\n');

try {
  // Login
  console.log('🔐 Logging in...');
  const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'superadmin@netneural.ai',
      password: 'SuperSecure123!'
    })
  });

  const { access_token } = await loginResponse.json();
  console.log(`✅ Token: ${access_token.substring(0, 20)}...\n`);

  // List integrations
  console.log('📋 Listing integrations...');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const integrationsResponse = await fetch(
      `${SUPABASE_URL}/functions/v1/integrations?organization_id=${ORG_ID}`,
      {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    clearTimeout(timeoutId);
    
    const integrationsData = await integrationsResponse.json();
  
  if (integrationsData.integrations) {
    console.log(`Found ${integrationsData.integrations.length} integration(s):\n`);
    integrationsData.integrations.forEach((integration, idx) => {
      console.log(`  ${idx + 1}. ${integration.name}`);
      console.log(`     ID: ${integration.id}`);
      console.log(`     Type: ${integration.type || integration.integrationType}\n`);
    });

    // Find Golioth
    const golioth = integrationsData.integrations.find(i => 
      (i.type === 'golioth' || i.integrationType === 'golioth')
    );

    if (golioth) {
      console.log(`✅ Found Golioth: ${golioth.id}\n`);
      console.log('🔄 Triggering import...\n');
      
      const syncResponse = await fetch(`${SUPABASE_URL}/functions/v1/device-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          integrationId: golioth.id,
          organizationId: ORG_ID,
          operation: 'import'
        })
      });

      const syncResult = await syncResponse.json();
      console.log(`Status: ${syncResponse.status}\n`);
      console.log('Result:');
      console.log(JSON.stringify(syncResult, null, 2));

      if (syncResult.devices_succeeded) {
        console.log(`\n✅ Imported ${syncResult.devices_succeeded} devices!`);
      }
    } else {
      console.log('❌ No Golioth integration found');
    }
  } catch (fetchError) {
    clearTimeout(timeoutId);
    console.error('❌ Integrations fetch error:', fetchError.message);
  }

} catch (error) {
  console.error('❌ Error:', error.message);
}
