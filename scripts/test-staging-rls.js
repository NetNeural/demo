#!/usr/bin/env node
/**
 * Test RLS policies on staging database
 */

const { createClient } = require('@supabase/supabase-js');

const PROJECT_ID = 'atgbmxicqikmapfqouco';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testRLS() {
  console.log('🔍 Testing RLS policies on staging database...');
  console.log(`📍 Project: ${PROJECT_ID}`);
  console.log('');

  try {
    // Check current policies on users table
    console.log('📋 Checking RLS policies on users table...');
    const { data: policies, error: policiesError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'users');

    if (policiesError) {
      console.error('❌ Error fetching policies:', policiesError.message);
    } else {
      console.log(`✅ Found ${policies.length} policies:`);
      policies.forEach(p => {
        console.log(`   - ${p.policyname}`);
      });
    }

    console.log('');
    console.log('👤 Testing user profile fetch...');
    
    // Get the auth user
    const userId = '8f0af407-6723-4444-b39b-86aea6ca5281'; // admin@netneural.ai
    
    // Test with service role (should work)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('❌ Error fetching user:', userError.message);
    } else {
      console.log('✅ User profile found:');
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Org ID: ${user.organization_id}`);
    }

    console.log('');
    console.log('🧪 Test completed!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Try logging in at: https://demo-stage.netneural.ai/');
    console.log('2. Use: admin@netneural.ai / Admin123!');
    console.log('3. Check browser console (F12) for any errors');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testRLS().catch(console.error);
