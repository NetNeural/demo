const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function checkUser() {
  console.log('🔍 Checking for user profile...\n')
  
  // Check auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
  if (authError) {
    console.error('❌ Error listing auth users:', authError)
    return
  }
  
  console.log('Auth users found:')
  authUsers.users.forEach(user => {
    console.log(`  - ${user.email} (ID: ${user.id})`)
  })
  
  // Check users table
  const { data: profiles, error: profileError } = await supabase
    .from('users')
    .select('id, email, role, organization_id')
  
  if (profileError) {
    console.error('\n❌ Error querying users table:', profileError)
    return
  }
  
  console.log('\nUser profiles in users table:')
  if (profiles.length === 0) {
    console.log('  ❌ NO PROFILES FOUND - This is the problem!')
  } else {
    profiles.forEach(profile => {
      console.log(`  - ${profile.email} (ID: ${profile.id}, Role: ${profile.role}, Org: ${profile.organization_id})`)
    })
  }
}

checkUser().catch(console.error)
