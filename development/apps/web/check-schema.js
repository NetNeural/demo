// Check the actual schema of sensor_readings table
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tsanlpdmxkeHdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTAyNjk1NSwiZXhwIjoyMDcwNjAyOTU1fQ.u9OK1PbjHLKMY8K1LM-bn8zYlRm-U5Zk1ef5NqQEhDQ'

async function checkSchema() {
  console.log('🔍 Checking sensor_readings table schema...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // Get a sample record to see the actual column names
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('*')
    .limit(1)
  
  if (error) {
    console.error('❌ Error:', error)
  } else if (data && data.length > 0) {
    console.log('✅ Sample record columns:')
    console.log(Object.keys(data[0]))
    console.log('\n📊 Sample record:')
    console.log(data[0])
  } else {
    console.log('⚠️ No data found in sensor_readings table')
  }
}

checkSchema()
