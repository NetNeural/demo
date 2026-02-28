const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://atgbmxicqikmapfqouco.supabase.co',
  process.env.STAGE_SUPABASE_SERVICE_ROLE_KEY || ''
)

async function checkDuplicates() {
  console.log('Checking for M260600010 devices...\n')

  // Search by serial_number
  const { data: bySerial, error: serialError } = await supabase
    .from('devices')
    .select(
      'id, name, serial_number, external_device_id, status, created_at, updated_at'
    )
    .ilike('serial_number', '%M260600010%')
    .order('created_at', { ascending: true })

  if (serialError) {
    console.error('Error fetching by serial:', serialError)
  } else {
    console.log(
      'Devices with serial_number containing M260600010:',
      bySerial?.length || 0
    )
    bySerial?.forEach((d, i) => {
      console.log(`\n[${i + 1}] ID: ${d.id}`)
      console.log(`    Name: ${d.name}`)
      console.log(`    Serial: ${d.serial_number}`)
      console.log(`    External ID: ${d.external_device_id || 'null'}`)
      console.log(`    Status: ${d.status}`)
      console.log(`    Created: ${d.created_at}`)
      console.log(`    Updated: ${d.updated_at}`)
    })
  }

  // Search by external_device_id
  const { data: byExternal, error: externalError } = await supabase
    .from('devices')
    .select(
      'id, name, serial_number, external_device_id, status, created_at, updated_at'
    )
    .ilike('external_device_id', '%M260600010%')
    .order('created_at', { ascending: true })

  if (externalError) {
    console.error('\nError fetching by external_device_id:', externalError)
  } else {
    console.log(
      '\n\nDevices with external_device_id containing M260600010:',
      byExternal?.length || 0
    )
    byExternal?.forEach((d, i) => {
      console.log(`\n[${i + 1}] ID: ${d.id}`)
      console.log(`    Name: ${d.name}`)
      console.log(`    Serial: ${d.serial_number}`)
      console.log(`    External ID: ${d.external_device_id || 'null'}`)
      console.log(`    Status: ${d.status}`)
      console.log(`    Created: ${d.created_at}`)
      console.log(`    Updated: ${d.updated_at}`)
    })
  }

  // Check telemetry counts for each device found
  const allDevices = [...(bySerial || []), ...(byExternal || [])]
  const uniqueIds = [...new Set(allDevices.map((d) => d.id))]

  if (uniqueIds.length > 0) {
    console.log('\n\nTelemetry counts for these devices:')
    for (const deviceId of uniqueIds) {
      const { count, error } = await supabase
        .from('device_telemetry')
        .select('*', { count: 'exact', head: true })
        .eq('device_id', deviceId)

      if (!error) {
        console.log(`Device ${deviceId}: ${count} telemetry records`)
      }
    }
  }
}

checkDuplicates().catch(console.error)
