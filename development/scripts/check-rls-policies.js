#!/usr/bin/env node

/**
 * Check RLS policies on organization_members table
 */

const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const STAGING_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY);

async function checkRLS() {
  console.log('🔍 Checking RLS policies on organization_members table...\n');

  const { data: policies, error } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        policyname,
        permissive,
        roles::text[],
        cmd,
        qual,
        with_check
      FROM pg_policies 
      WHERE tablename = 'organization_members'
      ORDER BY policyname;
    `
  });

  if (error) {
    console.error('❌ Error:', error.message);
    
    // Try alternative approach - query directly
    console.log('\nTrying direct query...\n');
    
    const { data: rawData, error: rawError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'organization_members');
    
    if (rawError) {
      console.error('❌ Direct query also failed:', rawError.message);
    } else {
      console.log('Policies:', JSON.stringify(rawData, null, 2));
    }
    return;
  }

  console.log('📋 RLS Policies:');
  console.log(JSON.stringify(policies, null, 2));
}

checkRLS().catch(console.error);
