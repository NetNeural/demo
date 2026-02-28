#!/usr/bin/env node

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function checkDeviceTypes() {
  console.log('🔍 Checking device types in staging database...\n')

  const response = await fetch(
    `${STAGING_URL}/rest/v1/device_types?select=*&order=name.asc`,
    {
      headers: {
        apikey: STAGING_SERVICE_KEY,
        Authorization: `Bearer ${STAGING_SERVICE_KEY}`,
      },
    }
  )

  if (!response.ok) {
    console.error('❌ Failed to fetch device types:', await response.text())
    process.exit(1)
  }

  const types = await response.json()

  console.log(`Found ${types.length} device types:\n`)

  if (types.length === 0) {
    console.log('❌ No device types found in database')
    return
  }

  types.forEach((dt, i) => {
    console.log(`${i + 1}. ${dt.name}`)
    console.log(`   ID: ${dt.id}`)
    console.log(`   Organization: ${dt.organization_id}`)
    console.log(`   Class: ${dt.device_class || 'N/A'}`)
    console.log(`   Unit: ${dt.unit || 'N/A'}`)
    console.log(`   Normal Range: ${dt.lower_normal} - ${dt.upper_normal}`)
    if (dt.lower_alert || dt.upper_alert) {
      console.log(
        `   Alert Thresholds: ${dt.lower_alert || 'N/A'} / ${dt.upper_alert || 'N/A'}`
      )
    }
    console.log('')
  })
}

checkDeviceTypes().catch(console.error)
