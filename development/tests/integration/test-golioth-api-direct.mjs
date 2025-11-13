// Direct test of Golioth API
const GOLIOTH_API_KEY = 'DAf7enB249brtg8EAX7nWnMqWlyextWY';
const GOLIOTH_PROJECT_ID = 'nn-cellular-alerts';
const GOLIOTH_BASE_URL = 'https://api.golioth.io/v1';

console.log('🧪 Testing Golioth API directly\n');
console.log(`API Key: ${GOLIOTH_API_KEY.substring(0, 10)}...`);
console.log(`Project ID: ${GOLIOTH_PROJECT_ID}`);
console.log(`Base URL: ${GOLIOTH_BASE_URL}\n`);

// Test 1: List devices (using correct x-api-key header)
console.log('📡 Test: Listing devices from Golioth...\n');

try {
  const response = await fetch(`${GOLIOTH_BASE_URL}/projects/${GOLIOTH_PROJECT_ID}/devices`, {
    method: 'GET',
    headers: {
      'x-api-key': GOLIOTH_API_KEY,  // ← Correct header!
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  console.log(`Response status: ${response.status} ${response.statusText}`);
  
  if (response.ok) {
    const data = await response.json();
    console.log('\n✅ SUCCESS! Got response from Golioth\n');
    
    const devices = data.data || data.list || [];
    console.log(`Total devices: ${devices.length}\n`);
    
    if (devices.length > 0) {
      console.log('📱 Devices found:');
      devices.slice(0, 10).forEach((device, idx) => {
        console.log(`\n  ${idx + 1}. ${device.name || device.id}`);
        console.log(`     ID: ${device.id}`);
        console.log(`     Hardware ID: ${device.hardwareId || 'N/A'}`);
        console.log(`     Status: ${device.status || 'unknown'}`);
        console.log(`     Last Seen: ${device.lastSeen || 'Never'}`);
        if (device.tags && device.tags.length > 0) {
          console.log(`     Tags: ${device.tags.join(', ')}`);
        }
      });
      
      if (devices.length > 10) {
        console.log(`\n  ... and ${devices.length - 10} more devices`);
      }
      
      console.log('\n📄 Full response structure:');
      console.log(JSON.stringify(data, null, 2).substring(0, 1000));
    } else {
      console.log('⚠️  No devices found in Golioth project');
      console.log('\nResponse structure:');
      console.log(JSON.stringify(data, null, 2));
    }
    
  } else {
    const errorText = await response.text();
    console.log('\n❌ FAILED to get devices');
    console.log(`Error: ${errorText}`);
  }
  
} catch (error) {
  console.error('\n❌ ERROR:', error.message);
}
