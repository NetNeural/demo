#!/usr/bin/env node

/**
 * Test edge functions directly
 */

const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const STAGING_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testEdgeFunctions() {
  console.log('🧪 Testing edge functions with service role...\n');

  // Test organizations endpoint
  const orgsResponse = await fetch(`${STAGING_URL}/functions/v1/organizations`, {
    headers: {
      'Authorization': `Bearer ${STAGING_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!orgsResponse.ok) {
    console.error('❌ Organizations endpoint failed:', await orgsResponse.text());
    return;
  }

  const orgsData = await orgsResponse.json();
  console.log('📋 Organizations endpoint response:');
  
  const netNeural = orgsData.organizations?.find(org => org.name === 'NetNeural Demo');
  if (netNeural) {
    console.log(`   NetNeural Demo: userCount = ${netNeural.userCount}, deviceCount = ${netNeural.deviceCount}`);
  }

  // Test dashboard-stats endpoint
  const statsResponse = await fetch(
    `${STAGING_URL}/functions/v1/dashboard-stats?organization_id=00000000-0000-0000-0000-000000000001`,
    {
      headers: {
        'Authorization': `Bearer ${STAGING_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!statsResponse.ok) {
    console.error('❌ Dashboard-stats endpoint failed:', await statsResponse.text());
    return;
  }

  const statsData = await statsResponse.json();
  console.log('\n📊 Dashboard-stats endpoint response:');
  console.log(`   totalUsers = ${statsData.totalUsers}`);
  console.log(`   totalDevices = ${statsData.totalDevices}`);
  console.log(`   activeAlerts = ${statsData.activeAlerts}`);

  // Summary
  console.log('\n✅ Summary:');
  console.log(`   Organizations endpoint: ${netNeural?.userCount === 6 ? '✅ CORRECT' : '❌ WRONG'} (expected 6, got ${netNeural?.userCount})`);
  console.log(`   Dashboard-stats endpoint: ${statsData.totalUsers === 6 ? '✅ CORRECT' : '❌ WRONG'} (expected 6, got ${statsData.totalUsers})`);
}

testEdgeFunctions().catch(console.error);
