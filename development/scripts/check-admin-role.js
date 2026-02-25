const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})

async function checkAdmin() {
  console.log('🔍 Checking admin@netneural.ai role and memberships...\n')

  // Get user profile
  const { data: user } = await supabase
    .from('users')
    .select('id, email, role, organization_id')
    .eq('email', 'admin@netneural.ai')
    .single()

  console.log('User profile:')
  console.log(`  Email: ${user.email}`)
  console.log(`  Role: ${user.role}`)
  console.log(`  Current Org ID: ${user.organization_id}`)
  console.log(`  User ID: ${user.id}`)

  // Get all organization memberships
  const { data: memberships } = await supabase
    .from('organization_members')
    .select(
      `
      role,
      organization_id,
      organizations (name, slug)
    `
    )
    .eq('user_id', user.id)

  console.log('\nOrganization memberships:')
  if (memberships.length === 0) {
    console.log('  ❌ NO MEMBERSHIPS FOUND')
  } else {
    memberships.forEach((m) => {
      console.log(`  - ${m.organizations.name} (${m.organizations.slug})`)
      console.log(`    Role: ${m.role}`)
      console.log(`    Org ID: ${m.organization_id}`)
    })
  }

  // Check V-Mark ownership
  const { data: vmark } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'v-mark')
    .single()

  if (vmark) {
    const { data: vmarkMember } = await supabase
      .from('organization_members')
      .select('role, user_id, users(email)')
      .eq('organization_id', vmark.id)

    console.log('\nV-Mark organization members:')
    if (!vmarkMember || vmarkMember.length === 0) {
      console.log('  ❌ NO MEMBERS FOUND - This is the problem!')
    } else {
      vmarkMember.forEach((m) => {
        console.log(`  - ${m.users.email}: ${m.role}`)
      })
    }
  }

  // Recommendation
  console.log('\n💡 Solution:')
  if (user.role === 'org_owner') {
    console.log('  1. Change user role from "org_owner" to "super_admin"')
    console.log('  2. This will allow them to see and manage ALL organizations')
  }
  if (memberships.length === 1) {
    console.log('  3. Add user as owner/member of V-Mark organization')
  }
}

checkAdmin().catch(console.error)
