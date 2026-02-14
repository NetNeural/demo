const { createClient } = require('@supabase/supabase-js')

// Staging
const stagingUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const stagingKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY'

const staging = createClient(stagingUrl, stagingKey, {
  auth: { persistSession: false }
})

async function checkIntegrations() {
  console.log('🔍 Checking integrations in STAGING...\n')
  
  // Get all integrations in staging
  const { data: stagingIntegrations, error: stagingError } = await staging
    .from('integrations')
    .select(`
      *,
      organizations (name, slug)
    `)
    .order('created_at', { ascending: false })
  
  if (stagingError) {
    console.error('❌ Error fetching staging integrations:', stagingError)
    return
  }
  
  console.log(`Found ${stagingIntegrations.length} integrations in staging:\n`)
  if (stagingIntegrations.length === 0) {
    console.log('  (none)')
  } else {
    stagingIntegrations.forEach((int, i) => {
      console.log(`  ${i+1}. ${int.name} (${int.type})`)
      console.log(`     Organization: ${int.organizations?.name || 'N/A'}`)
      console.log(`     Status: ${int.is_active ? 'Active' : 'Inactive'}`)
      console.log(`     Created: ${new Date(int.created_at).toLocaleString()}`)
      console.log()
    })
  }
  
  console.log('\n💡 To copy integrations from production:')
  console.log('   1. I need production database credentials, OR')
  console.log('   2. You can export integrations from prod and provide the data')
  console.log('   3. Or tell me which specific Golioth/webhook configs to create')
}

checkIntegrations().catch(console.error)
