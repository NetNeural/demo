#!/usr/bin/env node

/**
 * Test script for AI Insights Edge Function
 * Tests the OpenAI GPT-3.5 integration with mock sensor data
 */

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

async function testAIInsights() {
  console.log('🧪 Testing AI Insights Edge Function...\n');

  // Mock sensor data for testing (proper format expected by Edge Function)
  const testPayload = {
    deviceId: '00000000-0000-0000-0000-000000000000',
    deviceName: 'Test Sensor Node',
    installedAt: '2026-02-01T00:00:00Z',
    temperatureUnit: 'celsius',
    organizationId: '00000000-0000-0000-0000-000000000000',
    telemetryReadings: [
      {
        telemetry: {
          sensor: 'temperature',
          value: 22.5
        },
        device_timestamp: new Date(Date.now() - 3600000).toISOString(),
        received_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        telemetry: {
          sensor: 'temperature',
          value: 23.1
        },
        device_timestamp: new Date(Date.now() - 1800000).toISOString(),
        received_at: new Date(Date.now() - 1800000).toISOString()
      },
      {
        telemetry: {
          sensor: 'humidity',
          value: 65.0
        },
        device_timestamp: new Date(Date.now() - 3600000).toISOString(),
        received_at: new Date(Date.now() - 3600000).toISOString()
      },
      {
        telemetry: {
          sensor: 'humidity',
          value: 67.2
        },
        device_timestamp: new Date(Date.now() - 1800000).toISOString(),
        received_at: new Date(Date.now() - 1800000).toISOString()
      }
    ]
  };

  console.log('📊 Test Data:', JSON.stringify(testPayload, null, 2));
  console.log('\n🔄 Calling Edge Function...\n');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    
    if (response.ok) {
      console.log('\n✅ SUCCESS! AI Insights received:\n');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.insights && Array.isArray(data.insights)) {
        console.log('\n📝 Insights Summary:');
        data.insights.forEach((insight, idx) => {
          console.log(`   ${idx + 1}. ${insight}`);
        });
      }

      if (data.cached) {
        console.log('\n💾 Note: Result was from cache (15-min TTL)');
      } else {
        console.log('\n🤖 Note: Fresh result from OpenAI GPT-3.5 Turbo');
      }

      console.log('\n🎉 Test PASSED - OpenAI integration is working!');
      process.exit(0);
    } else {
      console.error('\n❌ FAILED - Edge Function returned error:');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ FAILED - Request error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testAIInsights();
