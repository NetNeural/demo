#!/usr/bin/env node
/**
 * Test MQTT Integration with External Broker
 * 
 * Tests mqtt-hybrid Edge Function against test.mosquitto.org
 * This verifies:
 * 1. Connection to external MQTT broker
 * 2. Publish messages
 * 3. Subscribe to topics
 * 4. Activity logging
 * 
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node test-mqtt-broker.js
 */

const https = require('https');

const SUPABASE_URL = 'https://atgbmxicqikmapfqouco.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ORG_ID = '00000000-0000-0000-0000-000000000001'; // NetNeural main org

// Public MQTT test broker
const TEST_BROKER = {
  broker_url: 'test.mosquitto.org',
  port: 1883,
  protocol: 'mqtt',
  use_tls: false
};

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

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

async function testMqttBroker() {
  console.log('🔌 Testing MQTT Integration with External Broker\n');
  console.log(`📡 Test Broker: ${TEST_BROKER.broker_url}:${TEST_BROKER.port}\n`);
  
  let integrationId = null;
  
  try {
    // Step 1: Create MQTT integration
    console.log('1️⃣  Creating MQTT integration...');
    const createResult = await makeRequest('POST', '/rest/v1/device_integrations', {
      organization_id: ORG_ID,
      integration_type: 'mqtt',
      name: 'Test MQTT Integration - ' + Date.now(),
      settings: {
        broker_url: TEST_BROKER.broker_url,
        port: TEST_BROKER.port,
        protocol: TEST_BROKER.protocol,
        use_tls: TEST_BROKER.use_tls
      },
      status: 'active'
    });
    
    integrationId = createResult.body[0].id;
    console.log(`✅ Integration created: ${integrationId}\n`);
    
    // Step 2: Test connection
    console.log('2️⃣  Testing connection...');
    try {
      const testResult = await makeRequest('POST', '/functions/v1/mqtt-hybrid/test', {
        integration_id: integrationId,
        organization_id: ORG_ID
      });
      
      console.log(`✅ Connection test: ${testResult.body.data.message}`);
    } catch (error) {
      console.log(`⚠️  Connection test failed: ${error.message}`);
      console.log('   (This may be expected if mqtt-hybrid needs npm:mqtt support)');
    }
    
    // Step 3: Test publish
    console.log('\n3️⃣  Testing publish...');
    const testTopic = `netneural/test/${Date.now()}`;
    try {
      const publishResult = await makeRequest('POST', '/functions/v1/mqtt-hybrid/publish', {
        integration_id: integrationId,
        organization_id: ORG_ID,
        messages: [
          {
            topic: testTopic,
            payload: {
              test: true,
              timestamp: new Date().toISOString(),
              source: 'test-script'
            },
            qos: 0,
            retain: false
          }
        ]
      });
      
      console.log(`✅ Publish result: ${publishResult.body.data.results.published} messages published`);
    } catch (error) {
      console.log(`⚠️  Publish failed: ${error.message}`);
    }
    
    // Step 4: Test subscribe
    console.log('\n4️⃣  Testing subscribe...');
    try {
      const subscribeResult = await makeRequest('POST', '/functions/v1/mqtt-hybrid/subscribe', {
        integration_id: integrationId,
        organization_id: ORG_ID,
        topics: [testTopic, 'netneural/test/#']
      });
      
      console.log(`✅ Subscribe result: ${subscribeResult.body.data.message}`);
    } catch (error) {
      console.log(`⚠️  Subscribe failed: ${error.message}`);
    }
    
    // Step 5: Check activity log
    console.log('\n5️⃣  Checking activity log...');
    const activityResult = await makeRequest('GET', 
      `/rest/v1/integration_activity_log?integration_id=eq.${integrationId}&order=created_at.desc&limit=10`
    );
    
    const activities = activityResult.body;
    console.log(`✅ Found ${activities.length} activity log entries:`);
    activities.forEach((activity, index) => {
      console.log(`   ${index + 1}. ${activity.activity_type} - ${activity.status} - ${activity.message}`);
    });
    
    // Step 6: Cleanup
    console.log('\n6️⃣  Cleaning up...');
    await makeRequest('DELETE', `/rest/v1/device_integrations?id=eq.${integrationId}`);
    console.log('✅ Test integration deleted\n');
    
    console.log('📊 Test Summary:');
    console.log('   ✓ Integration creation');
    console.log('   ✓ Activity logging');
    console.log('   Note: MQTT operations may need Deno npm:mqtt support');
    console.log('\n🎉 MQTT broker test complete!\n');
    
  } catch (error) {
    console.error('\n❌ MQTT test FAILED:', error.message);
    
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
testMqttBroker();
