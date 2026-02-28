#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')

const PROD_URL = process.env.PROD_SUPABASE_URL
const PROD_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY

if (!PROD_URL || !PROD_KEY) {
  console.error('Missing credentials')
  process.exit(1)
}

const client = createClient(PROD_URL, PROD_KEY)

async function checkData() {
  console.log('🔍 Checking production database...\n')

  // Check devices
  const { data: devices, error: devError } = await client
    .from('devices')
    .select('id, name, serial_number, created_at')
    .limit(5)

  console.log('📱 Devices sample:', devices?.length || 0)
  if (devices && devices.length > 0) {
    console.log('   Example:', devices[0])
  }

  // Check telemetry with different possible column names
  console.log('\n📊 Checking device_telemetry_history table...')
  const {
    data: telemetry1,
    error: tel1Error,
    count: count1,
  } = await client
    .from('device_telemetry_history')
    .select('*', { count: 'exact', head: false })
    .limit(5)

  console.log('   Total records:', count1)
  if (telemetry1 && telemetry1.length > 0) {
    console.log('   Example:', telemetry1[0])
    console.log('   Columns:', Object.keys(telemetry1[0]))
  }
  if (tel1Error) {
    console.log('   Error:', tel1Error.message)
  }

  // Check if there's a different telemetry table
  console.log('\n📊 Checking device_telemetry table...')
  const { data: telemetry2, error: tel2Error } = await client
    .from('device_telemetry')
    .select('*')
    .limit(5)

  if (telemetry2 && telemetry2.length > 0) {
    console.log('   Found records:', telemetry2.length)
    console.log('   Example:', telemetry2[0])
  } else if (tel2Error) {
    console.log('   Table does not exist or error:', tel2Error.message)
  }

  // Get date range of telemetry
  if (telemetry1 && telemetry1.length > 0) {
    const { data: dateRange } = await client
      .from('device_telemetry_history')
      .select('received_at')
      .order('received_at', { ascending: false })
      .limit(1)

    const { data: oldestRange } = await client
      .from('device_telemetry_history')
      .select('received_at')
      .order('received_at', { ascending: true })
      .limit(1)

    console.log('\n📅 Telemetry date range:')
    console.log('   Oldest:', oldestRange?.[0]?.received_at)
    console.log('   Newest:', dateRange?.[0]?.received_at)
  }
}

checkData().catch(console.error)
