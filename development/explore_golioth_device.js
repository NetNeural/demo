// Golioth API Deep Dive - Device-Specific Features
const GOLIOTH_API_KEY = 'DAf7enB249brtg8EAX7nWnMqWlyextWY';
const GOLIOTH_PROJECT_ID = 'nn-cellular-alerts';
const GOLIOTH_BASE_URL = 'https://api.golioth.io/v1';

// Using one of the active devices from the list
const DEVICE_ID = '68bf1cc5425dd2ea93f248a3'; // C253700003 - most recently active

async function goliothRequest(endpoint, method = 'GET', body = null) {
  const url = `${GOLIOTH_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'x-api-key': GOLIOTH_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { status: response.status, ok: response.ok, data };
  } catch (error) {
    return { error: error.message };
  }
}

async function exploreDevice() {
  console.log('='.repeat(80));
  console.log(`GOLIOTH DEVICE DEEP DIVE: ${DEVICE_ID}`);
  console.log('='.repeat(80));
  console.log();

  // 1. Device Data / Time Series
  console.log('📊 DEVICE DATA (Time Series)');
  console.log('-'.repeat(80));
  const data = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/devices/${DEVICE_ID}/data`);
  console.log('Endpoint: GET /projects/{projectId}/devices/{deviceId}/data');
  console.log('Status:', data.status);
  console.log('Response:', JSON.stringify(data.data, null, 2));
  console.log();

  // 2. Device Stream
  console.log('🌊 DEVICE STREAM');
  console.log('-'.repeat(80));
  const stream = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/stream?deviceId=${DEVICE_ID}`);
  console.log(`Endpoint: GET /projects/{projectId}/stream?deviceId={deviceId}`);
  console.log('Status:', stream.status);
  console.log('Response:', JSON.stringify(stream.data, null, 2));
  console.log();

  // 3. Device State
  console.log('🔄 DEVICE STATE (LightDB State)');
  console.log('-'.repeat(80));
  const state = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/devices/${DEVICE_ID}/state`);
  console.log('Endpoint: GET /projects/{projectId}/devices/{deviceId}/state');
  console.log('Status:', state.status);
  console.log('Response:', JSON.stringify(state.data, null, 2));
  console.log();

  // 4. Device Settings (Remote Config)
  console.log('⚙️ DEVICE SETTINGS (Remote Config)');
  console.log('-'.repeat(80));
  const settings = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/devices/${DEVICE_ID}/settings`);
  console.log('Endpoint: GET /projects/{projectId}/devices/{deviceId}/settings');
  console.log('Status:', settings.status);
  console.log('Response:', JSON.stringify(settings.data, null, 2));
  console.log();

  // 5. Device Logs
  console.log('📝 DEVICE LOGS');
  console.log('-'.repeat(80));
  const logs = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/devices/${DEVICE_ID}/logs`);
  console.log('Endpoint: GET /projects/{projectId}/devices/{deviceId}/logs');
  console.log('Status:', logs.status);
  if (logs.ok && logs.data?.list) {
    console.log(`Found ${logs.data.list.length} log entries`);
    console.log('Sample logs:', JSON.stringify(logs.data.list.slice(0, 3), null, 2));
  } else {
    console.log('Response:', JSON.stringify(logs.data, null, 2));
  }
  console.log();

  // 6. Device RPC (Remote Procedure Calls)
  console.log('🔧 DEVICE RPC (Remote Procedure Calls)');
  console.log('-'.repeat(80));
  const rpc = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/devices/${DEVICE_ID}/rpc`);
  console.log('Endpoint: GET /projects/{projectId}/devices/{deviceId}/rpc');
  console.log('Status:', rpc.status);
  console.log('Response:', JSON.stringify(rpc.data, null, 2));
  console.log();

  // 7. Device Tags
  console.log('🏷️ DEVICE TAGS');
  console.log('-'.repeat(80));
  const tags = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/devices/${DEVICE_ID}/tags`);
  console.log('Endpoint: GET /projects/{projectId}/devices/{deviceId}/tags');
  console.log('Status:', tags.status);
  console.log('Response:', JSON.stringify(tags.data, null, 2));
  console.log();

  // 8. Device Credentials/Certificates
  console.log('🔐 DEVICE CREDENTIALS');
  console.log('-'.repeat(80));
  const creds = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/devices/${DEVICE_ID}/credentials`);
  console.log('Endpoint: GET /projects/{projectId}/devices/{deviceId}/credentials');
  console.log('Status:', creds.status);
  console.log('Response:', JSON.stringify(creds.data, null, 2));
  console.log();

  // 9. Device Cohort
  console.log('👥 DEVICE COHORT (OTA Groups)');
  console.log('-'.repeat(80));
  const cohort = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/devices/${DEVICE_ID}`);
  console.log('Endpoint: GET /projects/{projectId}/devices/{deviceId}');
  console.log('Status:', cohort.status);
  if (cohort.ok && cohort.data?.data?.cohortId) {
    console.log('Cohort ID:', cohort.data.data.cohortId);
    const cohortDetails = await goliothRequest(`/projects/${GOLIOTH_PROJECT_ID}/cohorts/${cohort.data.data.cohortId}`);
    console.log('Cohort Details:', JSON.stringify(cohortDetails.data, null, 2));
  } else {
    console.log('No cohort assigned');
  }
  console.log();

  // 10. Device Update/Firmware Status
  console.log('💾 DEVICE FIRMWARE UPDATE STATUS');
  console.log('-'.repeat(80));
  if (cohort.ok && cohort.data?.data?.metadata?.update) {
    console.log('Firmware Update Status:', JSON.stringify(cohort.data.data.metadata.update, null, 2));
  } else {
    console.log('No firmware update status available');
  }
  console.log();

  console.log('='.repeat(80));
  console.log('DEVICE EXPLORATION COMPLETE');
  console.log('='.repeat(80));
}

exploreDevice().catch(console.error);
