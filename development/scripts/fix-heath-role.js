#!/usr/bin/env node

/**
 * Fix heath.scheiman@netneural.ai role from member to owner
 */

const { createClient } = require('@supabase/supabase-js')

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(STAGING_URL, STAGING_SERVICE_ROLE_KEY)

async function fixHeathRole() {
  console.log('🔧 Fixing heath.scheiman@netneural.ai role...\n')

  // Get user ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('email', 'heath.scheiman@netneural.ai')
    .single()

  if (userError) {
    console.error('❌ Error finding user:', userError.message)
    return
  }

  if (!user) {
    console.error('❌ User not found: heath.scheiman@netneural.ai')
    return
  }

  console.log('👤 Found user:', {
    id: user.id,
    email: user.email,
    name: user.full_name,
  })

  // Get current membership
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('id, organization_id, role, organizations(name)')
    .eq('user_id', user.id)
    .single()

  if (membershipError) {
    console.error('❌ Error finding membership:', membershipError.message)
    return
  }

  console.log('\n📋 Current membership:')
  console.log('   Organization:', membership.organizations.name)
  console.log('   Current role:', membership.role)

  if (membership.role === 'owner') {
    console.log('\n✅ Already an owner! No changes needed.')
    return
  }

  // Update role to owner
  const { error: updateError } = await supabase
    .from('organization_members')
    .update({ role: 'owner' })
    .eq('id', membership.id)

  if (updateError) {
    console.error('\n❌ Error updating role:', updateError.message)
    return
  }

  console.log('\n✅ Role updated successfully!')
  console.log('   Email:', user.email)
  console.log('   Old role: member')
  console.log('   New role: owner')
  console.log('   Organization:', membership.organizations.name)
}

fixHeathRole().catch(console.error)
