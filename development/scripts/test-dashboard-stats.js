#!/usr/bin/env node

/**
 * Test dashboard-stats by directly querying database
 */

const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const STAGING_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY);

async function testDashboardStats() {
  console.log('🧪 Testing member count in database...\n');

  // Get NetNeural Demo org
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('name', 'NetNeural Demo')
    .single();

  if (orgError) {
    console.error('❌ Error finding organization:', orgError.message);
    return;
  }

  console.log(`✅ Found organization: ${org.name} (${org.id})\n`);

  // Count members directly from organization_members table
  const { count, error: countError } = await supabase
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id);

  if (countError) {
    console.error('❌ Error counting members:', countError.message);
    return;
  }

  console.log(`📊 Member count from organization_members table: ${count}\n`);

  // Get member details
  const { data: members, error: membersError } = await supabase
    .from('organization_members')
    .select(`
      id,
      role,
      user_id,
      created_at
    `)
    .eq('organization_id', org.id)
    .order('created_at');

  if (membersError) {
    console.error('❌ Error getting member details:', membersError.message);
    return;
  }

  console.log('👥 Members:');
  for (const member of members) {
    // Get user details
    const { data: user } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', member.user_id)
      .single();

    console.log(`   • ${user?.full_name || 'Unknown'} (${user?.email || 'No email'}) - ${member.role}`);
  }

  console.log(`\n✅ Total: ${members.length} members`);
}

testDashboardStats().catch(console.error);
