// Test the NEW credentials provided by the user
const { createClient } = require('@supabase/supabase-js')

// NEW credentials from user
const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tsanlpdmxkeHdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjY5NTUsImV4cCI6MjA3MDYwMjk1NX0.qkvYx-8ucC5BsqzLcXxIW9TQqc94_dFbGYz5rVSwyRQ'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tsanlpdmxkeHdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTAyNjk1NSwiZXhwIjoyMDcwNjAyOTU1fQ.u9OK1PbjHLKMY8K1LM-bn8zYlRm-U5Zk1ef5NqQEhDQ'

console.log('🧪 Testing NEW Supabase credentials...')
console.log(`📍 Project URL: ${supabaseUrl}`)
console.log(`🔑 Anon Key: ${supabaseAnonKey.substring(0, 20)}...`)
console.log(`🔧 Service Key: ${supabaseServiceKey.substring(0, 20)}...`)

async function testNewCredentials() {
  console.log('\n=== TESTING ANON KEY ===')
  
  try {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    
    // Test 1: Auth session
    console.log('1. 🔐 Testing auth session...')
    const { data: session, error: authError } = await anonClient.auth.getSession()
    console.log(authError ? `   ❌ ${authError.message}` : '   ✅ Auth working')
    
    // Test 2: Basic table access
    console.log('2. 📋 Testing sensors table...')
    const { data: sensors, error: sensorsError } = await anonClient
      .from('sensors')
      .select('*')
      .limit(5)
    
    if (sensorsError) {
      console.log(`   ❌ Sensors error: ${sensorsError.message}`)
    } else {
      console.log(`   ✅ Sensors table: Found ${sensors.length} records`)
      if (sensors.length > 0) {
        console.log(`   📊 Sample sensor:`, sensors[0])
      }
    }
    
    // Test 3: Sensor readings table
    console.log('3. 📈 Testing sensor_readings table...')
    const { data: readings, error: readingsError } = await anonClient
      .from('sensor_readings')
      .select('*')
      .limit(5)
    
    if (readingsError) {
      console.log(`   ❌ Readings error: ${readingsError.message}`)
    } else {
      console.log(`   ✅ Readings table: Found ${readings.length} records`)
      if (readings.length > 0) {
        console.log(`   📊 Sample reading:`, readings[0])
      }
    }
    
  } catch (err) {
    console.log(`❌ Anon client error: ${err.message}`)
  }
  
  console.log('\n=== TESTING SERVICE KEY ===')
  
  try {
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
    
    // Test with service key (should have full access)
    console.log('1. 🔧 Testing service access to sensors...')
    const { data: serviceSensors, error: serviceError } = await serviceClient
      .from('sensors')
      .select('*')
      .limit(5)
    
    if (serviceError) {
      console.log(`   ❌ Service sensors error: ${serviceError.message}`)
    } else {
      console.log(`   ✅ Service sensors: Found ${serviceSensors.length} records`)
    }
    
    // Test direct REST API call
    console.log('2. 🌐 Testing direct REST API...')
    const response = await fetch(`${supabaseUrl}/rest/v1/sensors?select=*&limit=1`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`   REST API Status: ${response.status} ${response.statusText}`)
    
    if (response.ok) {
      const restData = await response.json()
      console.log(`   ✅ REST API working! Data:`, restData)
    } else {
      const errorText = await response.text()
      console.log(`   ❌ REST API error: ${errorText}`)
    }
    
  } catch (err) {
    console.log(`❌ Service client error: ${err.message}`)
  }
}

testNewCredentials()
