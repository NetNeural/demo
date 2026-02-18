const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
})

async function cleanupTestOrgs() {
  console.log('🧹 Cleaning up test organizations...\n')
  
  // Get all organizations
  const { data: allOrgs, error } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('❌ Error fetching orgs:', error)
    return
  }
  
  console.log('All organizations:')
  allOrgs.forEach((org, i) => {
    console.log(`  ${i+1}. ${org.name} (${org.slug})`)
  })
  
  // Filter test organizations
  const testOrgs = allOrgs.filter(org => 
    org.name.toLowerCase().includes('test') || 
    org.slug.toLowerCase().includes('test')
  )
  
  if (testOrgs.length === 0) {
    console.log('\n✅ No test organizations found')
    return
  }
  
  console.log(`\n🗑️  Deleting ${testOrgs.length} test organizations:\n`)
  
  for (const org of testOrgs) {
    const { error: deleteError } = await supabase
      .from('organizations')
      .delete()
      .eq('id', org.id)
    
    if (deleteError) {
      console.log(`  ❌ Failed to delete ${org.name}: ${deleteError.message}`)
    } else {
      console.log(`  ✅ Deleted: ${org.name} (${org.slug})`)
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
