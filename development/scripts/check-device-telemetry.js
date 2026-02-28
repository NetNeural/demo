const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY || ''
)

async function checkTelemetry() {
  const deviceId = 'e4cf664e-8922-40b4-9bab-6526b1f25776' // M260600010

  console.log('Checking telemetry for M260600010...\n')

  // Get count
  const { count, error: countError } = await supabase
    .from('device_telemetry')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', deviceId)

  console.log('Telemetry count:', count)
  if (countError) console.error('Count error:', countError)

  // Get actual records
  const { data, error } = await supabase
    .from('device_telemetry')
    .select('id, device_id, received_at, sensor_type, sensor_value')
    .eq('device_id', deviceId)
    .order('received_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Data error:', error)
  } else {
    console.log(`\nLast 5 telemetry records (out of ${count || 0}):`)
    if (data && data.length > 0) {
      data.forEach((t, i) => {
        console.log(`\n[${i + 1}] ${t.received_at}`)
        console.log(`    Type: ${t.sensor_type}`)
        console.log(`    Value: ${t.sensor_value}`)
      })
    } else {
      console.log('No telemetry records found')
    }
  }

  // Check all devices to see if there are any orphaned telemetry records
  console.log('\n\nChecking for all devices with similar names/serials...')
  const { data: allDevices, error: devError } = await supabase
    .from('devices')
    .select('id, name, serial_number, external_device_id, status')
    .or(
      'name.ilike.%M26060001%,serial_number.ilike.%M26060001%,external_device_id.ilike.%M26060001%'
    )
    .order('name')

  if (devError) {
    console.error('Device search error:', devError)
  } else {
    console.log(`\nFound ${allDevices?.length || 0} devices:`)
    if (allDevices && allDevices.length > 0) {
      for (const dev of allDevices) {
        const { count: telCount } = await supabase
          .from('device_telemetry')
          .select('*', { count: 'exact', head: true })
          .eq('device_id', dev.id)

        console.log(`\n${dev.name} (${dev.serial_number})`)
        console.log(`  ID: ${dev.id}`)
        console.log(`  External ID: ${dev.external_device_id || 'null'}`)
        console.log(`  Status: ${dev.status}`)
        console.log(`  Telemetry records: ${telCount || 0}`)
      }
    }
  }
}

checkTelemetry().catch(console.error)
