#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const STAGE_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const STAGE_KEY = process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY;

if (!STAGE_KEY) {
  console.error('Missing STAGE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(STAGE_URL, STAGE_KEY);

async function checkOrganization() {
  console.log('🔍 Checking organizations in staging...\n');
  
  // Find NetNeural Demo organization
  const { data: orgs, error } = await client
    .from('organizations')
    .select('*')
    .or('name.ilike.%netneural%')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('📋 Organizations matching "netneural":\n');
  orgs?.forEach(org => {
    console.log(`  ID: ${org.id}`);
    console.log(`  Name: ${org.name}`);
    console.log(`  Slug: ${org.slug}`);
    console.log(`  Active: ${org.is_active}`);
    console.log(`  Created: ${org.created_at}`);
    console.log('');
  });
  
  // Try to update via direct SQL
  if (orgs && orgs.length > 0) {
    const targetOrg = orgs.find(o => o.name === 'NetNeural Demo');
    
    if (targetOrg) {
      console.log(`\n🔄 Attempting to update "${targetOrg.name}" to "NetNeural"...\n`);
      
      const { data: updated, error: updateError } = await client
        .from('organizations')
        .update({ name: 'NetNeural' })
        .eq('id', targetOrg.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Update failed:');
        console.error('   Code:', updateError.code);
        console.error('   Message:', updateError.message);
        console.error('   Details:', updateError.details);
        console.error('   Hint:', updateError.hint);
      } else {
        console.log('✅ Update successful!');
        console.log('   New name:', updated.name);
        
        // Revert it back
        await client
          .from('organizations')
          .update({ name: 'NetNeural Demo' })
          .eq('id', targetOrg.id);
        console.log('   (Reverted back to "NetNeural Demo" for testing)');
      }
    }
  }
}

checkOrganization().catch(console.error);
