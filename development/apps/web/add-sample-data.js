// Add sample sensor readings to the database
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tsanlpdmxkeHdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTAyNjk1NSwiZXhwIjoyMDcwNjAyOTU1fQ.u9OK1PbjHLKMY8K1LM-bn8zYlRm-U5Zk1ef5NqQEhDQ'

async function addSampleReadings() {
  console.log('📊 Adding sample sensor readings...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // First, get all sensors
  const { data: sensors, error: sensorsError } = await supabase
    .from('sensors')
    .select('id, type, name')
  
  if (sensorsError) {
    console.error('❌ Error fetching sensors:', sensorsError)
    return
  }
  
  console.log(`📋 Found ${sensors.length} sensors`)
  
  // Generate readings for each sensor
  const readings = []
  const now = new Date()
  
  for (const sensor of sensors) {
    console.log(`📈 Generating readings for ${sensor.name} (${sensor.type})`)
    
    // Generate 24 hours of data (one reading per hour)
    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(now.getTime() - (hour * 60 * 60 * 1000))
      
      let value, unit
      switch (sensor.type) {
        case 'temperature':
          value = 20 + Math.random() * 10 // 20-30°C
          unit = '°C'
          break
        case 'humidity':
          value = 40 + Math.random() * 40 // 40-80%
          unit = '%'
          break
        case 'motion':
          value = Math.random() > 0.8 ? 1 : 0 // Motion detected 20% of the time
          unit = 'boolean'
          break
        case 'light':
          value = Math.random() * 1000 // 0-1000 lux
          unit = 'lux'
          break
        default:
          value = Math.random() * 100
          unit = 'unit'
      }
      
      readings.push({
        sensor_id: sensor.id,
        value: Math.round(value * 100) / 100, // Round to 2 decimal places
        unit,
        timestamp: timestamp.toISOString()
      })
    }
  }
  
  console.log(`💾 Inserting ${readings.length} readings...`)
  
  const { data, error } = await supabase
    .from('sensor_readings')
    .insert(readings)
    .select()
  
  if (error) {
    console.error('❌ Error inserting readings:', error)
  } else {
    console.log(`✅ Successfully inserted ${data.length} sensor readings!`)
    
    // Verify the data
    const { data: verifyData, error: verifyError } = await supabase
      .from('sensor_readings')
      .select('sensor_id, value, unit, timestamp')
      .limit(5)
    
    if (!verifyError && verifyData.length > 0) {
      console.log('📊 Sample readings:')
      verifyData.forEach(reading => {
        console.log(`   ${reading.value}${reading.unit} at ${reading.timestamp}`)
      })
    }
  }
}

addSampleReadings()
