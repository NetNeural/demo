const { Client } = require('pg')

async function compareGoliothSettings() {
  const client = new Client({
    host: 'localhost',
    port: 54322,
    database: 'postgres',
    user: 'postgres',
    password: 'postgres',
  })

  try {
    await client.connect()

    // Get integration settings
    const integrationResult = await client.query(`
      SELECT 
        'LOCAL' as environment,
        id,
        name,
        project_id,
        base_url,
        LENGTH(api_key_encrypted) as api_key_length,
        settings->>'projectId' as settings_project_id,
        LEFT(settings->>'apiKey', 10) || '...' as settings_api_key_preview,
        settings->>'syncEnabled' as sync_enabled,
        status,
        created_at,
        updated_at
      FROM device_integrations 
      WHERE integration_type = 'golioth'
    `)

    // Get device count
    const deviceCountResult = await client.query(`
      SELECT 
        'LOCAL' as environment,
        COUNT(*) as total_devices,
        COUNT(CASE WHEN status = 'online' THEN 1 END) as online_devices,
        COUNT(CASE WHEN status = 'offline' THEN 1 END) as offline_devices,
        MAX(last_seen) as most_recent_seen
      FROM devices 
      WHERE integration_id IN (SELECT id FROM device_integrations WHERE integration_type = 'golioth')
    `)

    // Get sample devices
    const devicesResult = await client.query(`
      SELECT 
        name,
        device_type,
        status,
        external_device_id,
        hardware_ids,
        last_seen,
        metadata->>'golioth_project_id' as golioth_project
      FROM devices 
      WHERE integration_id IN (SELECT id FROM device_integrations WHERE integration_type = 'golioth')
      LIMIT 5
    `)

    console.log('\n=== LOCAL GOLIOTH INTEGRATION SETTINGS ===\n')
    console.log(JSON.stringify(integrationResult.rows[0], null, 2))

    console.log('\n=== LOCAL DEVICE COUNT ===\n')
    console.log(JSON.stringify(deviceCountResult.rows[0], null, 2))

    console.log('\n=== LOCAL SAMPLE DEVICES ===\n')
    console.log(JSON.stringify(devicesResult.rows, null, 2))
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await client.end()
  }
}

compareGoliothSettings()
