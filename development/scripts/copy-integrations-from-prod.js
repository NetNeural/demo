const { createClient } = require('@supabase/supabase-js')

// Production
const prodUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const prodKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tsanlpdmxkeHdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTAyNjk1NSwiZXhwIjoyMDcwNjAyOTU1fQ.u9OK1PbjHLKMY8K1LM-bn8zYlRm-U5Zk1ef5NqQEhDQ'

// Staging
const stagingUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const stagingKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0Z2JteGljcWlrbWFwZnFvdWNvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTAxNzgwOSwiZXhwIjoyMDg2NTkzODA5fQ.tGj8TfFUR3DiXWEYT1Lt41zvzxb5HipUnpfF-QfHbjY'

const prod = createClient(prodUrl, prodKey, { auth: { persistSession: false } })
const staging = createClient(stagingUrl, stagingKey, { auth: { persistSession: false } })

async function copyIntegrations() {
  console.log('📦 Copying integrations from PRODUCTION to STAGING...\n')
  
  // Step 1: Get all integrations from production
  console.log('1️⃣ Fetching integrations from production...')
  const { data: prodIntegrations, error: prodError } = await prod
    .from('device_integrations')
    .select(`
      *,
      organizations (name, slug)
    `)
    .order('created_at')
  
  if (prodError) {
    console.error('❌ Error fetching from production:', prodError)
    return
  }
  
  console.log(`   Found ${prodIntegrations.length} integrations\n`)
  
  if (prodIntegrations.length === 0) {
    console.log('✅ No integrations to copy')
    return
  }
  
  // Step 2: Get organization mapping (prod org slug -> staging org id)
  console.log('2️⃣ Mapping organizations...')
  const { data: stagingOrgs, error: orgError } = await staging
    .from('organizations')
    .select('id, slug')
  
  if (orgError) {
    console.error('❌ Error fetching staging orgs:', orgError)
    return
  }
  
  const orgMap = {}
  stagingOrgs.forEach(org => {
    orgMap[org.slug] = org.id
  })
  
  console.log('   Organization mapping:')
  prodIntegrations.forEach(int => {
    const prodOrgSlug = int.organizations?.slug || 'unknown'
    const stagingOrgId = orgMap[prodOrgSlug] || stagingOrgs[0]?.id
    console.log(`   - ${prodOrgSlug} -> ${stagingOrgId}`)
  })
  console.log()
  
  // Step 3: Copy each integration
  console.log('3️⃣ Copying integrations...\n')
  let successCount = 0
  let skipCount = 0
  let errorCount = 0
  
  for (const prodInt of prodIntegrations) {
    const prodOrgSlug = prodInt.organizations?.slug
    const stagingOrgId = orgMap[prodOrgSlug] || stagingOrgs[0]?.id
    
    if (!stagingOrgId) {
      console.log(`   ⚠️  Skipped: ${prodInt.name} (no matching org)`)
      skipCount++
      continue
    }
    
    // Check if integration already exists
    const { data: existing } = await staging
      .from('device_integrations')
      .select('id')
      .eq('organization_id', stagingOrgId)
      .eq('integration_type', prodInt.integration_type)
      .eq('name', prodInt.name)
      .maybeSingle()
    
    if (existing) {
      console.log(`   ⏭️  Skipped: ${prodInt.name} (already exists)`)
      skipCount++
      continue
    }
    
    // Create new integration in staging
    const newIntegration = {
      organization_id: stagingOrgId,
      integration_type: prodInt.integration_type,
      name: prodInt.name,
      api_key_encrypted: prodInt.api_key_encrypted,
      project_id: prodInt.project_id,
      base_url: prodInt.base_url,
      settings: prodInt.settings,
      status: prodInt.status,
      sync_enabled: prodInt.sync_enabled,
      sync_interval_seconds: prodInt.sync_interval_seconds,
      sync_direction: prodInt.sync_direction,
      conflict_resolution: prodInt.conflict_resolution,
      webhook_enabled: prodInt.webhook_enabled,
      webhook_url: prodInt.webhook_url,
      webhook_secret: prodInt.webhook_secret,
      broker_type: prodInt.broker_type
    }
    
    const { data: created, error: createError } = await staging
      .from('device_integrations')
      .insert(newIntegration)
      .select()
      .single()
    
    if (createError) {
      console.log(`   ❌ Error: ${prodInt.name}`)
      console.log(`      ${createError.message}`)
      errorCount++
    } else {
      console.log(`   ✅ Copied: ${prodInt.name} (${prodInt.integration_type})`)
      successCount++
    }
  }
  
  console.log('\n📊 Summary:')
  console.log(`   ✅ Copied: ${successCount}`)
  console.log(`   ⏭️  Skipped: ${skipCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  console.log()
  
  // Step 4: Show final state
  console.log('4️⃣ Final state in staging:')
  const { data: finalIntegrations } = await staging
    .from('device_integrations')
    .select('name, integration_type, status')
    .order('created_at')
  
  finalIntegrations.forEach((int, i) => {
    console.log(`   ${i+1}. ${int.name} (${int.integration_type}) - ${int.status}`)
  })
  
  console.log('\n🎉 Done!')
}

copyIntegrations().catch(console.error)
