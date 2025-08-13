// Test with service role key for full access
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM0MDA3Mzc0LCJleHAiOjIwNDk1ODMzNzR9.OtwjXBc7bL4RhMBg85MX3rNKOUWL9KM8L5ZgKKCxQ-E'

async function testServiceRole() {
  try {
    console.log('🔧 Testing with service role key (full admin access)...')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Try to create a simple test table
    console.log('\n📋 Attempting to check database schema...')
    
    // Test basic connection
    const { data: healthData, error: healthError } = await supabase
      .from('_health_check')
      .select('*')
      .limit(1)
    
    if (healthError) {
      console.log('❌ Health check failed:', healthError.message)
    } else {
      console.log('✅ Health check passed:', healthData)
    }
    
    // Try to list schema information
    console.log('\n🔍 Checking for existing tables...')
    const tablesToTry = ['sensors', 'sensor_readings', 'devices']
    
    for (const table of tablesToTry) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1)
        
        if (error) {
          console.log(`❌ ${table}: ${error.message}`)
        } else {
          console.log(`✅ ${table}: Table exists! Data:`, data)
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`)
      }
    }
    
  } catch (err) {
    console.error('❌ Service role test error:', err.message)
  }
}

testServiceRole()
