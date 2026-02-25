#!/usr/bin/env node

/**
 * Check for duplicate devices in staging environment
 * Related to Issue #1: Devices Page - Duplicate Devices
 */

const { createClient } = require('@supabase/supabase-js')

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(STAGING_URL, STAGING_SERVICE_KEY)

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate devices in staging...\n')

  // Check for duplicate devices by name
  const { data: devices, error } = await supabase
    .from('devices')
    .select('id, name, device_type, status, external_device_id, integration_id, organization_id, created_at')
    .is('deleted_at', null)
    .order('name')

  if (error) {
    console.error('❌ Error fetching devices:', error)
    return
  }

  console.log(`✅ Found ${devices.length} devices (non-deleted)\n`)

  // Group devices by name to find duplicates
  const devicesByName = new Map()
  
  for (const device of devices) {
    if (!devicesByName.has(device.name)) {
      devicesByName.set(device.name, [])
    }
    devicesByName.get(device.name).push(device)
  }

  // Find duplicates
  const duplicates = []
  for (const [name, deviceList] of devicesByName.entries()) {
    if (deviceList.length > 1) {
      duplicates.push({ name, devices: deviceList })
    }
  }

  if (duplicates.length === 0) {
    console.log('✅ No duplicate devices found!')
    return
  }

  console.log(`⚠️  Found ${duplicates.length} duplicate device name(s):\n`)

  for (const dup of duplicates) {
    console.log(`📦 Device: ${dup.name} (${dup.devices.length} instances)`)
    for (const device of dup.devices) {
      console.log(`   - ID: ${device.id}`)
      console.log(`     Type: ${device.device_type}`)
      console.log(`     Status: ${device.status}`)
      console.log(`     External ID: ${device.external_device_id || 'None'}`)
      console.log(`     Integration: ${device.integration_id || 'None'}`)
      console.log(`     Org: ${device.organization_id}`)
      console.log(`     Created: ${new Date(device.created_at).toLocaleString()}`)
      console.log('')
    }
  }

  console.log('\n🔍 Checking specific devices mentioned in issue #1...\n')
  
  const targetDevices = ['M260600005', 'M260600008']
  for (const deviceName of targetDevices) {
    const matches = devicesByName.get(deviceName)
    if (matches) {
      console.log(`📦 ${deviceName}: ${matches.length} instance(s)`)
      for (const device of matches) {
        console.log(`   - ${device.id} (created ${new Date(device.created_at).toLocaleString()})`)
      }
    } else {
      console.log(`📦 ${deviceName}: Not found`)
    }
  }
}

checkDuplicates().catch(console.error)
