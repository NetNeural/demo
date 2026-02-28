const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY || ''
)

async function fixMembership() {
  console.log('Checking organization memberships...\n')

  // Find admin user
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', 'admin@netneural.ai')
    .single()

  if (userError) {
    console.error('Error finding admin user:', userError)
    return
  }

  console.log('Admin user:', users)

  if (users) {
    // Check membership
    const { data: membership } = await supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', users.id)
      .eq('organization_id', '00000000-0000-0000-0000-000000000001')

    console.log('Current membership:', membership)

    if (!membership || membership.length === 0) {
      console.log('\n❌ No membership found! Creating owner membership...')

      const { data: newMembership, error } = await supabase
        .from('organization_members')
        .insert({
          organization_id: '00000000-0000-0000-0000-000000000001',
          user_id: users.id,
          role: 'owner',
        })
        .select()

      if (error) {
        console.error('Error creating membership:', error)
      } else {
        console.log('✅ Created owner membership:', newMembership)
      }
    } else if (membership[0].role !== 'owner') {
      console.log(`\n⚠️ Found membership but role is: ${membership[0].role}`)
      console.log('Updating to owner...')

      const { data: updated, error } = await supabase
        .from('organization_members')
        .update({ role: 'owner' })
        .eq('id', membership[0].id)
        .select()

      if (error) {
        console.error('Error updating role:', error)
      } else {
        console.log('✅ Updated to owner:', updated)
      }
    } else {
      console.log('✅ Membership is correct (owner role)')
    }
  }

  console.log('\n📋 Now refresh the page and try uploading again.')
}

fixMembership().catch(console.error)
