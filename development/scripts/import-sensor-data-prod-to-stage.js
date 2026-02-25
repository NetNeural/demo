#!/usr/bin/env node

/**
 * Import Sensor Telemetry Data from Production to Staging
 *
 * This script:
 * 1. Finds sensors that exist in staging
 * 2. Checks if they have telemetry data in production
 * 3. Imports missing telemetry data from production to staging
 * 4. Does NOT create any new sensor records
 */

const { createClient } = require('@supabase/supabase-js')

// You need to set these environment variables
const PROD_SUPABASE_URL = process.env.PROD_SUPABASE_URL
const PROD_SUPABASE_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY
const STAGE_SUPABASE_URL =
  process.env.STAGE_SUPABASE_URL || 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGE_SUPABASE_KEY = process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY

// How many days of historical data to import
const DAYS_TO_IMPORT = parseInt(process.env.DAYS_TO_IMPORT || '30', 10)

if (!PROD_SUPABASE_URL || !PROD_SUPABASE_KEY || !STAGE_SUPABASE_KEY) {
  console.error('❌ Missing required environment variables:')
  console.error('   PROD_SUPABASE_URL')
  console.error('   PROD_SUPABASE_SERVICE_ROLE_KEY')
  console.error('   STAGE_SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nOptional:')
  console.error('   STAGE_SUPABASE_URL (default: atgbmxicqikmapfqouco)')
  console.error('   DAYS_TO_IMPORT (default: 30)')
  process.exit(1)
}

const prodClient = createClient(PROD_SUPABASE_URL, PROD_SUPABASE_KEY)
const stageClient = createClient(STAGE_SUPABASE_URL, STAGE_SUPABASE_KEY)

async function importSensorData() {
  console.log('🔍 Starting sensor data import from production to staging...\n')
  console.log(`📊 Configuration:`)
  console.log(`   Production: ${PROD_SUPABASE_URL}`)
  console.log(`   Staging:    ${STAGE_SUPABASE_URL}`)
  console.log(`   Days:       ${DAYS_TO_IMPORT}\n`)

  try {
    // Step 1: Get all devices from staging
    console.log('📋 Step 1: Fetching staging devices...')
    const { data: stagingDevices, error: stageError } = await stageClient
      .from('devices')
      .select('id, name, serial_number, external_device_id')
      .is('deleted_at', null)

    if (stageError) {
      throw new Error(`Failed to fetch staging devices: ${stageError.message}`)
    }

    console.log(`   ✅ Found ${stagingDevices.length} devices in staging\n`)

    // Step 2: For each staging device, find matching production device
    let totalImported = 0
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_IMPORT)

    for (const stagingDevice of stagingDevices) {
      console.log(
        `\n🔄 Processing: ${stagingDevice.name} (${stagingDevice.serial_number || stagingDevice.external_device_id})`
      )

      // Find matching production device by serial_number OR external_device_id
      const { data: prodDevices, error: prodError } = await prodClient
        .from('devices')
        .select('id, name, serial_number, external_device_id')
        .or(
          `serial_number.eq.${stagingDevice.serial_number || 'null'},external_device_id.eq.${stagingDevice.external_device_id || 'null'}`
        )
        .is('deleted_at', null)
        .limit(1)

      if (prodError) {
        console.error(
          `   ⚠️  Error fetching production device: ${prodError.message}`
        )
        continue
      }

      if (!prodDevices || prodDevices.length === 0) {
        console.log(`   ⏭️  No matching device in production`)
        continue
      }

      const prodDevice = prodDevices[0]
      console.log(
        `   ✅ Found matching production device (ID: ${prodDevice.id})`
      )

      // Step 3: Get telemetry data from production for this device
      console.log(
        `   📥 Fetching telemetry data from production (last ${DAYS_TO_IMPORT} days)...`
      )
      const { data: prodTelemetry, error: telemetryError } = await prodClient
        .from('device_telemetry_history')
        .select('*')
        .eq('device_id', prodDevice.id)
        .gte('received_at', cutoffDate.toISOString())
        .order('received_at', { ascending: false })

      if (telemetryError) {
        console.error(
          `   ⚠️  Error fetching telemetry: ${telemetryError.message}`
        )
        continue
      }

      if (!prodTelemetry || prodTelemetry.length === 0) {
        console.log(`   ℹ️  No telemetry data found in production`)
        continue
      }

      console.log(`   📊 Found ${prodTelemetry.length} telemetry records`)

      // Step 4: Check what already exists in staging
      const { data: existingTelemetry, error: existingError } =
        await stageClient
          .from('device_telemetry_history')
          .select('received_at')
          .eq('device_id', stagingDevice.id)
          .gte('received_at', cutoffDate.toISOString())

      if (existingError) {
        console.error(
          `   ⚠️  Error checking existing telemetry: ${existingError.message}`
        )
        continue
      }

      const existingTimestamps = new Set(
        (existingTelemetry || []).map((t) => t.received_at)
      )

      // Step 5: Filter out records that already exist
      const newTelemetry = prodTelemetry
        .filter((t) => !existingTimestamps.has(t.received_at))
        .map((t) => ({
          device_id: stagingDevice.id,
          telemetry: t.telemetry,
          received_at: t.received_at,
          created_at: t.created_at,
        }))

      if (newTelemetry.length === 0) {
        console.log(`   ✅ All telemetry data already exists in staging`)
        continue
      }

      console.log(
        `   📤 Importing ${newTelemetry.length} new telemetry records...`
      )

      // Step 6: Insert in batches of 500
      const batchSize = 500
      let imported = 0

      for (let i = 0; i < newTelemetry.length; i += batchSize) {
        const batch = newTelemetry.slice(i, i + batchSize)
        const { error: insertError } = await stageClient
          .from('device_telemetry_history')
          .insert(batch)

        if (insertError) {
          console.error(`   ⚠️  Error inserting batch: ${insertError.message}`)
          continue
        }

        imported += batch.length
        console.log(`   ✅ Imported ${imported}/${newTelemetry.length} records`)
      }

      totalImported += imported
    }

    console.log(`\n\n✅ Import complete!`)
    console.log(`📊 Summary:`)
    console.log(`   Devices processed: ${stagingDevices.length}`)
    console.log(`   Total records imported: ${totalImported}`)
    console.log(`   Date range: ${cutoffDate.toISOString()} to now`)
  } catch (error) {
    console.error('\n❌ Import failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the import
importSensorData().catch(console.error)
