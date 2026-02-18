#!/usr/bin/env node

/**
 * Check member count for all organizations in staging
 */

const { createClient } = require('@supabase/supabase-js');

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const STAGING_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY);

async function checkMemberCounts() {
  console.log('📊 Checking member counts for all organizations...\n');

  // Get all organizations
  const { data: organizations, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .order('name');

  if (orgError) {
    console.error('❌ Error fetching organizations:', orgError.message);
    return;
  }

  if (!organizations || organizations.length === 0) {
    console.log('No organizations found.');
    return;
  }

  // Check member count for each organization
  for (const org of organizations) {
    const { count, error } = await supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id);

    if (error) {
      console.error(`❌ Error counting members for ${org.name}:`, error.message);
      continue;
    }

    // Get member details
    const { data: members } = await supabase
      .from('organization_members')
      .select(`
        role,
        users!inner (
          email,
          full_name
        )
      `)
      .eq('organization_id', org.id);

    console.log(`\n🏢 ${org.name}`);
    console.log(`   Total Members: ${count}`);
    
    if (members && members.length > 0) {
      console.log(`   Members:`);
      members.forEach(member => {
        console.log(`     • ${member.users.full_name || 'No name'} (${member.users.email}) - ${member.role}`);
      });
    } else {
      console.log(`   (No member details available)`);
    }
  }
}

checkMemberCounts().catch(console.error);
