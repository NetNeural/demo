const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function cleanupTestOrgs() {
  console.log('🧹 Cleaning up test organizations...\n')
  
  // Get all organizations that match test patterns
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .or('name.ilike.%test%,slug.ilike.%test%')
  
  if (error) {
    console.error('❌ Error fetching test orgs:', error)
    return
  }
  
  console.log(`Found ${orgs.length} test organizations:\n`)
  orgs.forEach(org => {
    console.log(`  - ${org.name} (${org.slug})`)
  })
  
  if (orgs.length === 0) {
    console.log('✅ No test organizations found')
    return
  }
  
  console.log('\n🗑️  Deleting...\n')
  
  for (const org of orgs) {
    const { error: deleteError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', org.id)
    
    if (deleteError) {
      console.log(`  ❌ Failed to delete ${org.name}: ${deleteError.message}`)
    } else {
      console.log(`  ✅ Deleted: ${org.name}`)
    }
  }
  
  console.log('\n🎉 Cleanup complete!')
  
  // Show remaining organizations
  const { data: remaining } = await supabase
    .from('organizations')
    .select('name, slug')
    .order('created_at')
  
  console.log('\nRemaining organizations:')
  remaining.forEach(org => {
    console.log(`  - ${org.name} (${org.slug})`)
  })
}

cleanupTestOrgs().catch(console.error)
