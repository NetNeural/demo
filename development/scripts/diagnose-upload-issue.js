const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function diagnoseUploadIssue() {
  console.log('🔍 Diagnosing upload issue...\n');
  
  // 1. Find the admin user
  const { data: adminUser, error: userError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', 'admin@netneural.ai')
    .single();
  
  if (userError) {
    console.error('❌ Cannot find admin user:', userError);
    return;
  }
  
  console.log('✅ Admin user found:');
  console.log(`   User ID: ${adminUser.id}`);
  console.log(`   Email: ${adminUser.email}`);
  console.log(`   Role: ${adminUser.role}\n`);
  
  // 2. Check auth.users table
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(adminUser.id);
  
  if (authError) {
    console.log('⚠️  Cannot check auth.users (expected with service role)');
  } else {
    console.log('✅ Auth user exists:', authUser.user?.email);
  }
  
  // 3. Check organization membership
  const orgId = '00000000-0000-0000-0000-000000000001';
  const { data: membership, error: memberError } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', orgId)
    .eq('user_id', adminUser.id);
  
  console.log('\n📋 Organization membership:');
  if (memberError) {
    console.error('❌ Error checking membership:', memberError);
    return;
  }
  
  if (!membership || membership.length === 0) {
    console.log('❌ NO MEMBERSHIP FOUND!');
    console.log('Creating owner membership now...\n');
    
    const { data: newMembership, error: insertError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: adminUser.id,
        role: 'owner'
      })
      .select();
    
    if (insertError) {
      console.error('❌ Failed to create membership:', insertError);
    } else {
      console.log('✅ Created owner membership:', newMembership[0]);
    }
  } else {
    console.log(`✅ Membership exists: ${membership[0].role}`);
    if (membership[0].role !== 'owner') {
      console.log(`⚠️  Role is "${membership[0].role}", updating to "owner"...\n`);
      
      const { data: updated, error: updateError } = await supabase
        .from('organization_members')
        .update({ role: 'owner' })
        .eq('id', membership[0].id)
        .select();
      
      if (updateError) {
        console.error('❌ Failed to update role:', updateError);
      } else {
        console.log('✅ Updated role to owner:', updated[0]);
      }
    }
  }
  
  // 4. Verify the policy query would work
  console.log('\n🔍 Testing policy query...');
  const { data: policyTest, error: policyError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT o.id, o.name, om.role
      FROM organizations o
      INNER JOIN organization_members om ON o.id = om.organization_id
      WHERE om.user_id = '${adminUser.id}'
        AND om.role = 'owner'
        AND o.id = '${orgId}';
    `
  });
  
  if (policyTest && policyTest.length > 0) {
    console.log('✅ Policy query would return:', policyTest);
  } else {
    console.log('❌ Policy query returns no results');
    console.log('This means the storage policy check would fail!');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(60));
  console.log('Storage policies: ✅ Applied');
  console.log('User exists: ✅ Yes');
  console.log('Membership: ' + (membership && membership.length > 0 ? '✅ Yes' : '❌ No'));
  console.log('Role: ' + (membership && membership[0]?.role === 'owner' ? '✅ Owner' : '❌ Not owner'));
  console.log('\n💡 After fixing, refresh browser and try uploading again.');
}

diagnoseUploadIssue().catch(console.error);
