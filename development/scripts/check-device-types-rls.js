#!/usr/bin/env node

const STAGING_URL = "https://atgbmxicqikmapfqouco.supabase.co";
const STAGING_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STAGING_ANON_KEY = process.env.STAGING_ANON_KEY;

async function checkRLS() {
  console.log('🔒 Checking RLS policies on device_types...\n');
  
  // Check with service role (bypasses RLS)
  console.log('1. Service role query (bypasses RLS):');
  const serviceResponse = await fetch(`${STAGING_URL}/rest/v1/device_types?select=id,name,organization_id&limit=5`, {
    headers: {
      'apikey': STAGING_SERVICE_KEY,
      'Authorization': `Bearer ${STAGING_SERVICE_KEY}`,
    },
  });
  
  const serviceData = await serviceResponse.json();
  console.log(`   Found ${serviceData.length} device types`);
  serviceData.forEach(dt => {
    console.log(`   - ${dt.name} (org: ${dt.organization_id.substring(0, 8)}...)`);
  });
  
  // Check RLS policies
  console.log('\n2. Checking RLS policies:');
  const policiesResponse = await fetch(`${STAGING_URL}/rest/v1/rpc/pg_policies?select=*`, {
    headers: {
      'apikey': STAGING_SERVICE_KEY,
      'Authorization': `Bearer ${STAGING_SERVICE_KEY}`,
    },
  }).catch(() => null);
  
  if (policiesResponse) {
    console.log('   Query succeeded');
  }
  
  // Try with anon key (requires authentication)
  if (STAGING_ANON_KEY) {
    console.log('\n3. Anon key query (requires user auth):');
    const anonResponse = await fetch(`${STAGING_URL}/rest/v1/device_types?select=id,name&limit=5`, {
      headers: {
        'apikey': STAGING_ANON_KEY,
        'Authorization': `Bearer ${STAGING_ANON_KEY}`,
      },
    });
    
    const anonData = await anonResponse.json();
    console.log(`   Found ${anonData.length || 0} device types (unauthenticated)`);
  }
}

checkRLS().catch(console.error);
