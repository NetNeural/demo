#!/usr/bin/env node

/**
 * Check devices and populate serial numbers in production database
 */

const { createClient } = require('@supabase/supabase-js')

// Production/Staging (same URL - atgbmxicqikmapfqouco)
const SUPABASE_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const ORG_ID = '00000000-0000-0000-0000-000000000001' // NetNeural Demo

async function checkDevices() {
  console.log('🔍 Checking devices in production database...\n')

  // Get all devices for the org
  const { data: devices, error } = await supabase
    .from('devices')
    .select(
      'id, name, serial_number, external_device_id, device_type, status, metadata, integration_id'
    )
    .eq('organization_id', ORG_ID)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error fetching devices:', error)
    return
  }

  console.log(`📊 Found ${devices.length} devices:\n`)

  let needsUpdate = 0
  const updates = []

  devices.forEach((device, index) => {
    console.log(`${index + 1}. ${device.name}`)
    console.log(`   ID: ${device.id}`)
    console.log(`   Serial Number: ${device.serial_number || '❌ MISSING'}`)
    console.log(
      `   External Device ID: ${device.external_device_id || '(none)'}`
    )
    console.log(`   Device Type: ${device.device_type}`)
    console.log(`   Status: ${device.status}`)
    console.log(`   Integration ID: ${device.integration_id || '(none)'}`)

    // Check if we can populate serial_number from metadata or name
    if (!device.serial_number) {
      let proposedSerial = null

      // Try to get from metadata
      if (device.metadata?.serial_number) {
        proposedSerial = device.metadata.serial_number
        console.log(`   💡 Found in metadata: ${proposedSerial}`)
      }
      // If name looks like a serial (e.g., M260600008, starts with capital letter + numbers)
      else if (/^[A-Z]\d+$/.test(device.name)) {
        proposedSerial = device.name
        console.log(`   💡 Using device name as serial: ${proposedSerial}`)
      }
      // If external_device_id looks like a serial
      else if (
        device.external_device_id &&
        /^[A-Z]\d+$/.test(device.external_device_id)
      ) {
        proposedSerial = device.external_device_id
        console.log(
          `   💡 Using external_device_id as serial: ${proposedSerial}`
        )
      }

      if (proposedSerial) {
        updates.push({
          id: device.id,
          serial_number: proposedSerial,
        })
        needsUpdate++
      } else {
        console.log(`   ⚠️  Cannot determine serial number`)
      }
    }

    console.log('')
  })

  console.log(`\n📝 Summary:`)
  console.log(`   Total devices: ${devices.length}`)
  console.log(`   With serial numbers: ${devices.length - needsUpdate}`)
  console.log(`   Missing serial numbers: ${needsUpdate}`)

  if (updates.length > 0) {
    console.log(
      `\n🔧 Updating ${updates.length} devices with serial numbers...\n`
    )

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('devices')
        .update({ serial_number: update.serial_number })
        .eq('id', update.id)

      if (updateError) {
        console.error(`❌ Failed to update device ${update.id}:`, updateError)
      } else {
        console.log(
          `✅ Updated device ${update.id} with serial: ${update.serial_number}`
        )
      }
    }

    console.log(`\n✅ Serial number updates complete!`)
  } else {
    console.log(`\n✅ All devices have serial numbers!`)
  }

  // Show Golioth integration ID
  console.log(`\n🔗 Golioth Integration Check:`)
  const { data: integrations } = await supabase
    .from('device_integrations')
    .select('id, name, integration_type, status')
    .eq('organization_id', ORG_ID)
    .eq('integration_type', 'golioth')

  if (integrations && integrations.length > 0) {
    integrations.forEach((int) => {
      console.log(`   Integration: ${int.name} (${int.id})`)
      console.log(`   Status: ${int.status}`)
    })
  } else {
    console.log(`   ⚠️  No Golioth integration found`)
  }
}

checkDevices().catch(console.error)
