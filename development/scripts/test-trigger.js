#!/usr/bin/env node

/**
 * Simple test: Create a single test user and verify trigger works
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testTrigger() {
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'Test123456!';
  
  console.log(`\n🧪 Testing trigger with new user: ${testEmail}\n`);
  
  // Sign up a new user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });
  
  if (authError) {
    console.error('❌ Auth signup failed:', authError.message);
    return;
  }
  
  console.log('✅ Auth user created:', authData.user?.id);
  console.log('   Session exists:', !!authData.session);
  
  // Wait a moment for trigger to execute
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Set the session properly
  await supabase.auth.setSession({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token
  });
  
  // Verify the user is authenticated
  const { data: sessionData } = await supabase.auth.getSession();
  console.log('   Session user ID:', sessionData.session?.user?.id);
  
  // Check if public.users record was created by the trigger
  const { data: profileData, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();
  
  if (profileError) {
    console.error('❌ Failed to fetch public.users record:', profileError.message);
    console.log('   This means the trigger did NOT create the record');
    return;
  }
  
  if (profileData) {
    console.log('✅ SUCCESS! public.users record was created by trigger:');
    console.log('   ID:', profileData.id);
    console.log('   Email:', profileData.email);
    console.log('   Role:', profileData.role);
    console.log('   Org ID:', profileData.organization_id);
    console.log('\n🎉 Trigger is working correctly!');
  } else {
    console.log('❌ No public.users record found - trigger failed');
  }
}

testTrigger();
