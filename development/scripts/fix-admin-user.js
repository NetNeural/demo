const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

async function fixAdmin() {
  console.log('🔧 Upgrading admin@netneural.ai to super_admin...\n')

  const userId = '8f0af407-6723-4444-b39b-86aea6ca5281'

  // Update user role to super_admin
  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({ role: 'super_admin' })
    .eq('id', userId)
    .select()
    .single()

  if (updateError) {
    console.error('❌ Failed to update user:', updateError)
    return
  }

  console.log('✅ User role updated:')
  console.log(`   Email: ${updated.email}`)
  console.log(`   Role: ${updated.role} (was: org_owner)`)

  // Verify V-Mark membership
  const { data: vmark } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'v-mark')
    .single()

  console.log('\n🔍 Checking V-Mark membership...')
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', vmark.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existingMember) {
    console.log('✅ Membership already exists:')
    console.log(`   Role: ${existingMember.role}`)
    console.log(`   Joined: ${existingMember.joined_at}`)
  } else {
    console.log('⚠️  No membership found, adding...')
    const { data: newMember, error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: vmark.id,
        user_id: userId,
        role: 'owner',
        joined_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (memberError) {
      console.error('❌ Failed to add membership:', memberError)
    } else {
      console.log('✅ Membership added')
    }
  }

  console.log('\n🎉 Done! Now refresh the browser and you should see:')
  console.log('   - "Create Organization" button (super admin)')
  console.log('   - Both NetNeural Demo and V-Mark in the dropdown')
}

fixAdmin().catch(console.error)
