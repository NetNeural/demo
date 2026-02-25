const { createClient } = require('@supabase/supabase-js')

const stagingUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const stagingKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const staging = createClient(stagingUrl, stagingKey, {
  auth: { persistSession: false },
})

async function listIntegrations() {
  console.log('🔍 Listing device integrations in STAGING...\n')

  const { data, error } = await staging
    .from('device_integrations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${data.length} integrations:\n`)

  if (data.length === 0) {
    console.log('  (none)')
  } else {
    data.forEach((int, i) => {
      console.log(`${i + 1}. ${int.name}`)
      console.log(`   Type: ${int.integration_type}`)
      console.log(`   Status: ${int.status}`)
      console.log(`   Org ID: ${int.organization_id}`)
      console.log(`   Created: ${new Date(int.created_at).toLocaleString()}`)
      console.log()
    })
  }

  console.log('\n💡 To copy from production, I need:')
  console.log('   - Production Supabase URL')
  console.log('   - Production Supabase service role key')
}

listIntegrations().catch(console.error)
