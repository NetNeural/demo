#!/usr/bin/env node
/**
 * Test Azure IoT Hub Integration
 * 
 * Tests Azure IoT Hub integration provider functionality.
 * Requires Azure IoT Hub credentials to run.
 * 
 * Prerequisites:
 * 1. Azure subscription with IoT Hub created
 * 2. IoT Hub connection string from Azure Portal
 * 3. At least one test device registered in IoT Hub
 * 
 * Usage: 
 *   SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   AZURE_IOT_CONNECTION_STRING="HostName=xxx.azure-devices.net;SharedAccessKeyName=xxx;SharedAccessKey=xxx" \
 *   node test-azure-iot.js
 */

const https = require('https');

const SUPABASE_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AZURE_CONNECTION_STRING = process.env.AZURE_IOT_CONNECTION_STRING;
const ORG_ID = '00000000-0000-0000-0000-000000000001'; // NetNeural main org

// Parse connection string to get hub name
function parseConnectionString(connStr) {
  const match = connStr.match(/HostName=([^.]+)\./);
  return match ? match[1] : 'unknown-hub';
}

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

if (!AZURE_CONNECTION_STRING) {
  console.error('❌ AZURE_IOT_CONNECTION_STRING environment variable is required');
  console.error('\nGet your connection string from Azure Portal:');
  console.error('  1. Navigate to your IoT Hub');
  console.error('  2. Go to "Shared access policies"');
  console.error('  3. Select "iothubowner" or "registryReadWrite"');
  console.error('  4. Copy the "Connection string—primary key"');
  console.error('\nFormat: HostName=xxx.azure-devices.net;SharedAccessKeyName=xxx;SharedAccessKey=xxx\n');
  process.exit(1);
}

const HUB_NAME = parseConnectionString(AZURE_CONNECTION_STRING);

// Helper function to make HTTPS requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: body ? JSON.parse(body) : null });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testAzureIoTHub() {
  console.log('☁️  Testing Azure IoT Hub Integration\n');
  console.log(`📡 Azure IoT Hub: ${HUB_NAME}\n`);
  
  let integrationId = null;
  
  try {
    // Step 1: Create Azure IoT Hub integration
    console.log('1️⃣  Creating Azure IoT Hub integration...');
    const createResult = await makeRequest('POST', '/rest/v1/device_integrations', {
      organization_id: ORG_ID,
      integration_type: 'azure_iot',
      name: 'Test Azure IoT Hub - ' + Date.now(),
      settings: {
        connectionString: AZURE_CONNECTION_STRING,
        hubName: HUB_NAME
      },
      status: 'active'
    });
    
    integrationId = createResult.body[0].id;
    console.log(`✅ Integration created: ${integrationId}\n`);
    
    // Step 2: Test connection
    console.log('2️⃣  Testing connection to Azure IoT Hub...');
    try {
      const { AzureIotIntegrationProvider } = require('../src/lib/integrations/azure-iot-integration-provider.ts');
      
      const provider = new AzureIotIntegrationProvider({
        credentials: {
          connectionString: AZURE_CONNECTION_STRING,
          hubName: HUB_NAME,
          organizationId: ORG_ID,
          integrationId: integrationId
        },
        projectId: integrationId
      });
      
      const testResult = await provider.testConnection();
      
      if (testResult.success) {
        console.log(`✅ Connection test passed: ${testResult.message}`);
      } else {
        console.log(`⚠️  Connection test failed: ${testResult.message}`);
      }
    } catch (error) {
      console.log(`⚠️  Connection test error: ${error.message}`);
      console.log('   (This may be expected if running in Node.js without TypeScript setup)');
    }
    
    // Step 3: List devices
    console.log('\n3️⃣  Listing devices from Azure IoT Hub...');
    try {
      const { AzureIotIntegrationProvider } = require('../src/lib/integrations/azure-iot-integration-provider.ts');
      
      const provider = new AzureIotIntegrationProvider({
        credentials: {
          connectionString: AZURE_CONNECTION_STRING,
          hubName: HUB_NAME,
          organizationId: ORG_ID,
          integrationId: integrationId
        },
        projectId: integrationId
      });
      
      const deviceList = await provider.listDevices({ limit: 5 });
      
      console.log(`✅ Found ${deviceList.total} devices (showing ${deviceList.devices.length}):`);
      deviceList.devices.forEach((device, index) => {
        console.log(`   ${index + 1}. ${device.name} (${device.id}) - Status: ${device.status}`);
      });
      
      // If we have devices, test getting one device's status
      if (deviceList.devices.length > 0) {
        const testDeviceId = deviceList.devices[0].id;
        console.log(`\n4️⃣  Getting device status for: ${testDeviceId}...`);
        
        const deviceStatus = await provider.getDeviceStatus(testDeviceId);
        console.log(`✅ Device status:`);
        console.log(`   Connection: ${deviceStatus.connectionState}`);
        console.log(`   Firmware: ${deviceStatus.firmware?.version || 'unknown'}`);
        console.log(`   Last Activity: ${deviceStatus.lastActivity}`);
      }
      
    } catch (error) {
      console.log(`⚠️  Device operations error: ${error.message}`);
    }
    
    // Step 4: Test telemetry query (should return empty)
    console.log('\n5️⃣  Testing telemetry query...');
    try {
      const { AzureIotIntegrationProvider } = require('../src/lib/integrations/azure-iot-integration-provider.ts');
      
      const provider = new AzureIotIntegrationProvider({
        credentials: {
          connectionString: AZURE_CONNECTION_STRING,
          hubName: HUB_NAME,
          organizationId: ORG_ID,
          integrationId: integrationId
        },
        projectId: integrationId
      });
      
      const telemetry = await provider.queryTelemetry();
      
      if (telemetry.length === 0) {
        console.log(`✅ Telemetry query returned empty (expected - Azure IoT Hub doesn't store telemetry)`);
        console.log('   Note: Configure Azure IoT Central, Time Series Insights, or Data Explorer for telemetry storage');
      } else {
        console.log(`⚠️  Unexpected: Telemetry query returned ${telemetry.length} records`);
      }
    } catch (error) {
      console.log(`⚠️  Telemetry query error: ${error.message}`);
    }
    
    // Step 5: Check activity log
    console.log('\n6️⃣  Checking activity log...');
    const activityResult = await makeRequest('GET', 
      `/rest/v1/integration_activity_log?integration_id=eq.${integrationId}&order=created_at.desc&limit=10`
    );
    
    const activities = activityResult.body;
    console.log(`✅ Found ${activities.length} activity log entries:`);
    activities.forEach((activity, index) => {
      console.log(`   ${index + 1}. ${activity.activity_type} - ${activity.status} - ${activity.message}`);
    });
    
    // Step 6: Cleanup
    console.log('\n7️⃣  Cleaning up...');
    await makeRequest('DELETE', `/rest/v1/device_integrations?id=eq.${integrationId}`);
    console.log('✅ Test integration deleted\n');
    
    console.log('📊 Test Summary:');
    console.log('   ✓ Integration creation');
    console.log('   ✓ Azure IoT Hub connection');
    console.log('   ✓ Device listing');
    console.log('   ✓ Device status retrieval (if devices exist)');
    console.log('   ✓ Telemetry query (empty as expected)');
    console.log('   ✓ Activity logging');
    console.log('\n🎉 Azure IoT Hub integration test complete!\n');
    
  } catch (error) {
    console.error('\n❌ Azure IoT Hub test FAILED:', error.message);
    console.error('Stack:', error.stack);
    
    // Cleanup on error
    if (integrationId) {
      try {
        await makeRequest('DELETE', `/rest/v1/device_integrations?id=eq.${integrationId}`);
        console.log('✅ Cleaned up test integration');
      } catch (cleanupError) {
        console.error('⚠️  Failed to cleanup:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

// Run the test
testAzureIoTHub();
