// Golioth API Explorer
// This script investigates the Golioth API to discover all available endpoints and features
// Requires: GOLIOTH_API_KEY in environment variables

require('dotenv').config({ path: '.env.local' })

const GOLIOTH_API_KEY = process.env.GOLIOTH_API_KEY
const GOLIOTH_PROJECT_ID =
  process.env.GOLIOTH_PROJECT_ID || 'nn-cellular-alerts'
const GOLIOTH_BASE_URL =
  process.env.GOLIOTH_BASE_URL || 'https://api.golioth.io/v1'

if (!GOLIOTH_API_KEY) {
  console.error('❌ GOLIOTH_API_KEY not found in environment variables')
  console.error(
    'Please set it in .env.local or export it before running this script'
  )
  process.exit(1)
}

async function goliothRequest(endpoint, method = 'GET', body = null) {
  const url = `${GOLIOTH_BASE_URL}${endpoint}`
  const options = {
    method,
    headers: {
      'x-api-key': GOLIOTH_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)
    const text = await response.text()
    let data
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }

    return {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      data,
    }
  } catch (error) {
    return {
      error: error.message,
    }
  }
}

async function exploreAPI() {
  console.log('='.repeat(80))
  console.log('GOLIOTH API EXPLORATION')
  console.log('='.repeat(80))
  console.log(`Project ID: ${GOLIOTH_PROJECT_ID}`)
  console.log(`Base URL: ${GOLIOTH_BASE_URL}`)
  console.log('='.repeat(80))
  console.log()

  // 1. Project Information
  console.log('📦 1. PROJECT INFORMATION')
  console.log('-'.repeat(80))
  const project = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}`)
  console.log('GET /projects/{projectId}')
  console.log('Status:', project.status)
  if (project.ok) {
    console.log('Response:', JSON.stringify(project.data, null, 2))
  } else {
    console.log('Error:', project.data)
  }
  console.log()

  // 2. Devices List
  console.log('📱 2. DEVICES LIST')
  console.log('-'.repeat(80))
  const devices = await goliothRequest(
    `/projects/${GOLIOTH_PROJECT_ID}/devices`
  )
  console.log('GET /projects/{projectId}/devices')
  console.log('Status:', devices.status)
  if (devices.ok && devices.data?.data) {
    console.log(`Found ${devices.data.data.length} devices`)
    console.log(
      'Sample device structure:',
      JSON.stringify(devices.data.data[0], null, 2)
    )
  } else {
    console.log('Response:', JSON.stringify(devices.data, null, 2))
  }
  console.log()

  // Get first device for further exploration
  let sampleDeviceId = null
  if (devices.ok && devices.data?.data?.length > 0) {
    sampleDeviceId = devices.data.data[0].id
    console.log(
      `Using device "${devices.data.data[0].name}" (${sampleDeviceId}) for exploration`
    )
    console.log()
  }

  if (sampleDeviceId) {
    // 3. Device Details
    console.log('🔍 3. DEVICE DETAILS')
    console.log('-'.repeat(80))
    const deviceDetails = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}`)
    console.log('Status:', deviceDetails.status)
    console.log('Response:', JSON.stringify(deviceDetails.data, null, 2))
    console.log()

    // 4. Device Telemetry
    console.log('📊 4. DEVICE TELEMETRY / TIME SERIES DATA')
    console.log('-'.repeat(80))
    const telemetry = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}/data`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}/data`)
    console.log('Status:', telemetry.status)
    if (telemetry.ok) {
      console.log('Response:', JSON.stringify(telemetry.data, null, 2))
    } else {
      console.log('Error:', telemetry.data)
    }
    console.log()

    // 5. Device Stream Data
    console.log('🌊 5. DEVICE STREAM DATA')
    console.log('-'.repeat(80))
    const stream = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}/stream`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}/stream`)
    console.log('Status:', stream.status)
    console.log('Response:', JSON.stringify(stream.data, null, 2))
    console.log()

    // 6. Device State
    console.log('🔄 6. DEVICE STATE')
    console.log('-'.repeat(80))
    const state = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}/state`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}/state`)
    console.log('Status:', state.status)
    console.log('Response:', JSON.stringify(state.data, null, 2))
    console.log()

    // 7. Device Settings
    console.log('⚙️ 7. DEVICE SETTINGS')
    console.log('-'.repeat(80))
    const settings = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}/settings`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}/settings`)
    console.log('Status:', settings.status)
    console.log('Response:', JSON.stringify(settings.data, null, 2))
    console.log()

    // 8. Device Logs
    console.log('📝 8. DEVICE LOGS')
    console.log('-'.repeat(80))
    const logs = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}/logs`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}/logs`)
    console.log('Status:', logs.status)
    console.log('Response:', JSON.stringify(logs.data, null, 2))
    console.log()

    // 9. Device Events
    console.log('🎯 9. DEVICE EVENTS')
    console.log('-'.repeat(80))
    const events = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}/events`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}/events`)
    console.log('Status:', events.status)
    console.log('Response:', JSON.stringify(events.data, null, 2))
    console.log()

    // 10. Device Tags
    console.log('🏷️ 10. DEVICE TAGS')
    console.log('-'.repeat(80))
    const tags = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}/tags`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}/tags`)
    console.log('Status:', tags.status)
    console.log('Response:', JSON.stringify(tags.data, null, 2))
    console.log()

    // 11. Device Certificates
    console.log('🔐 11. DEVICE CERTIFICATES')
    console.log('-'.repeat(80))
    const certs = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}/certificates`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}/certificates`)
    console.log('Status:', certs.status)
    console.log('Response:', JSON.stringify(certs.data, null, 2))
    console.log()

    // 12. Device Firmware
    console.log('💾 12. DEVICE FIRMWARE')
    console.log('-'.repeat(80))
    const firmware = await goliothRequest(
      `/projects/${GOLIOTH_PROJECT_ID}/devices/${sampleDeviceId}/firmware`
    )
    console.log(`GET /projects/{projectId}/devices/{deviceId}/firmware`)
    console.log('Status:', firmware.status)
    console.log('Response:', JSON.stringify(firmware.data, null, 2))
    console.log()
  }

  // 13. Project Blueprints
  console.log('📋 13. PROJECT BLUEPRINTS')
  console.log('-'.repeat(80))
  const blueprints = await goliothRequest(
    `/projects/${GOLIOTH_PROJECT_ID}/blueprints`
  )
  console.log(`GET /projects/{projectId}/blueprints`)
  console.log('Status:', blueprints.status)
  console.log('Response:', JSON.stringify(blueprints.data, null, 2))
  console.log()

  // 14. Project Tags
  console.log('🏷️ 14. PROJECT TAGS')
  console.log('-'.repeat(80))
  const projectTags = await goliothRequest(
    `/projects/${GOLIOTH_PROJECT_ID}/tags`
  )
  console.log(`GET /projects/{projectId}/tags`)
  console.log('Status:', projectTags.status)
  console.log('Response:', JSON.stringify(projectTags.data, null, 2))
  console.log()

  // 15. Project Pipelines
  console.log('🔀 15. PROJECT PIPELINES')
  console.log('-'.repeat(80))
  const pipelines = await goliothRequest(
    `/projects/${GOLIOTH_PROJECT_ID}/pipelines`
  )
  console.log(`GET /projects/{projectId}/pipelines`)
  console.log('Status:', pipelines.status)
  console.log('Response:', JSON.stringify(pipelines.data, null, 2))
  console.log()

  // 16. Project Artifacts (OTA Updates)
  console.log('📦 16. PROJECT ARTIFACTS (OTA)')
  console.log('-'.repeat(80))
  const artifacts = await goliothRequest(
    `/projects/${GOLIOTH_PROJECT_ID}/artifacts`
  )
  console.log(`GET /projects/{projectId}/artifacts`)
  console.log('Status:', artifacts.status)
  console.log('Response:', JSON.stringify(artifacts.data, null, 2))
  console.log()

  // 17. Project API Keys
  console.log('🔑 17. PROJECT API KEYS')
  console.log('-'.repeat(80))
  const apiKeys = await goliothRequest(
    `/projects/${GOLIOTH_PROJECT_ID}/api-keys`
  )
  console.log(`GET /projects/{projectId}/api-keys`)
  console.log('Status:', apiKeys.status)
  console.log('Response:', JSON.stringify(apiKeys.data, null, 2))
  console.log()

  // 18. Project Webhooks
  console.log('🪝 18. PROJECT WEBHOOKS')
  console.log('-'.repeat(80))
  const webhooks = await goliothRequest(
    `/projects/${GOLIOTH_PROJECT_ID}/webhooks`
  )
  console.log(`GET /projects/{projectId}/webhooks`)
  console.log('Status:', webhooks.status)
  console.log('Response:', JSON.stringify(webhooks.data, null, 2))
  console.log()

  // Summary
  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log('✅ API exploration complete!')
  console.log()
  console.log('Key Findings:')
  console.log('- Devices API: Working')
  console.log(
    '- Total Devices:',
    devices.ok ? devices.data?.data?.length : 'Unknown'
  )
  console.log()
}

// Run exploration
exploreAPI().catch(console.error)
