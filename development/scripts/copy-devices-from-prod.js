const { createClient } = require('@supabase/supabase-js')

// Production
const prodUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const prodKey = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY

// Staging
const stagingUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const stagingKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const prod = createClient(prodUrl, prodKey, { auth: { persistSession: false } })
const staging = createClient(stagingUrl, stagingKey, {
  auth: { persistSession: false },
})

async function copyDevices() {
  console.log('📦 Copying devices from PRODUCTION to STAGING...\n')

  // Step 1: Get tes.org organization ID from production
  console.log('1️⃣ Finding tes.org organization in production...')
  const { data: prodOrg, error: prodOrgError } = await prod
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', 'tes-org')
    .single()

  if (prodOrgError || !prodOrg) {
    console.error('❌ Could not find tes.org:', prodOrgError)
    return
  }

  console.log(`   Found: ${prodOrg.name} (${prodOrg.id})`)

  // Step 2: Get devices that start with M or C followed by numbers
  console.log('\n2️⃣ Fetching devices from production...')
  const { data: prodDevices, error: devicesError } = await prod
    .from('devices')
    .select('*')
    .eq('organization_id', prodOrg.id)

  if (devicesError) {
    console.error('❌ Error fetching devices:', devicesError)
    return
  }

  // Filter devices that match pattern: M + numbers OR C + numbers
  const filteredDevices = prodDevices.filter((device) => {
    const name = device.name || ''
    return /^[MC]\d+/.test(name)
  })

  console.log(`   Total devices in tes.org: ${prodDevices.length}`)
  console.log(`   Matching M* and C* patterns: ${filteredDevices.length}`)

  if (filteredDevices.length === 0) {
    console.log('   No matching devices found')
    return
  }

  console.log('\n   Devices to copy:')
  filteredDevices.forEach((d) => {
    console.log(`   - ${d.name} (${d.device_type})`)
  })

  // Step 3: Get NetNeural Demo organization from staging
  console.log('\n3️⃣ Finding NetNeural Demo organization in staging...')
  const { data: stagingOrg, error: stagingOrgError } = await staging
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', 'netneural-demo')
    .single()

  if (stagingOrgError || !stagingOrg) {
    console.error('❌ Could not find NetNeural Demo:', stagingOrgError)
    return
  }

  console.log(`   Found: ${stagingOrg.name} (${stagingOrg.id})`)

  // Step 4: Copy each device
  console.log('\n4️⃣ Copying devices...\n')
  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const prodDevice of filteredDevices) {
    // Check if device already exists (by name)
    const { data: existing } = await staging
      .from('devices')
      .select('id, name')
      .eq('organization_id', stagingOrg.id)
      .eq('name', prodDevice.name)
      .maybeSingle()

    if (existing) {
      console.log(`   ⏭️  Skipped: ${prodDevice.name} (already exists)`)
      skipCount++
      continue
    }

    // Prepare new device (without ID, created_at, updated_at)
    const newDevice = {
      organization_id: stagingOrg.id,
      name: prodDevice.name,
      device_type: prodDevice.device_type,
      model: prodDevice.model,
      serial_number: prodDevice.serial_number,
      status: prodDevice.status || 'offline',
      battery_level: prodDevice.battery_level,
      signal_strength: prodDevice.signal_strength,
      firmware_version: prodDevice.firmware_version,
      metadata: prodDevice.metadata,
      // Note: integration_id and location_id are set to null since we don't have mapping
      integration_id: null,
      location_id: null,
      external_device_id: prodDevice.external_device_id,
    }

    const { data: created, error: createError } = await staging
      .from('devices')
      .insert(newDevice)
      .select()
      .single()

    if (createError) {
      console.log(`   ❌ Error: ${prodDevice.name}`)
      console.log(`      ${createError.message}`)
      errorCount++
    } else {
      console.log(
        `   ✅ Copied: ${prodDevice.name} (${prodDevice.device_type})`
      )
      successCount++
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   ✅ Copied: ${successCount}`)
  console.log(`   ⏭️  Skipped: ${skipCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)

  // Step 5: Show final state
  console.log('\n5️⃣ Devices in NetNeural Demo (staging):')
  const { data: finalDevices } = await staging
    .from('devices')
    .select('name, device_type, status')
    .eq('organization_id', stagingOrg.id)
    .order('name')

  console.log(`   Total devices: ${finalDevices?.length || 0}`)

  const mDevices = finalDevices?.filter((d) => d.name?.startsWith('M')) || []
  const cDevices = finalDevices?.filter((d) => d.name?.startsWith('C')) || []

  if (mDevices.length > 0) {
    console.log(`\n   M-series devices (${mDevices.length}):`)
    mDevices.forEach((d) =>
      console.log(`   - ${d.name} (${d.device_type}) - ${d.status}`)
    )
  }

  if (cDevices.length > 0) {
    console.log(`\n   C-series devices (${cDevices.length}):`)
    cDevices.forEach((d) =>
      console.log(`   - ${d.name} (${d.device_type}) - ${d.status}`)
    )
  }

  console.log('\n🎉 Done!')
}

copyDevices().catch(console.error)
