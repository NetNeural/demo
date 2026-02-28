const { createClient } = require('@supabase/supabase-js')

const stagingUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const stagingKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const staging = createClient(stagingUrl, stagingKey, {
  auth: { persistSession: false },
})

async function checkIntegrations() {
  console.log('🔍 Checking device integrations in STAGING...\n')

  const { data: integrations, error } = await staging
    .from('device_integrations')
    .select(
      `
      *,
      devices (name, device_id),
      organizations (name, slug)
    `
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`Found ${integrations.length} device integrations:\n`)
  if (integrations.length === 0) {
    console.log('  (none)')
  } else {
    integrations.forEach((int, i) => {
      console.log(`  ${i + 1}. ${int.integration_type}`)
      console.log(
        `     Device: ${int.devices?.name || 'N/A'} (${int.devices?.device_id || 'N/A'})`
      )
      console.log(`     Organization: ${int.organizations?.name || 'N/A'}`)
      console.log(`     Enabled: ${int.enabled}`)
      console.log(
        `     Config: ${JSON.stringify(int.config).substring(0, 100)}...`
      )
      console.log()
    })
  }

  console.log(
    '\n💡 I need production database credentials to copy integrations.'
  )
  console.log(
    '   What are the Supabase URL and service role key for production?'
  )
}

checkIntegrations().catch(console.error)
