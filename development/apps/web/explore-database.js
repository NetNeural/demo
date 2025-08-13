// Test table existence and structure
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI'

async function exploreDatabase() {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    console.log('🔍 Exploring database structure...')
    
    // Try different table names that might exist
    const tablesToTry = [
      'sensors',
      'sensor_readings', 
      'devices',
      'users',
      'profiles',
      'public.sensors',
      'public.sensor_readings'
    ]
    
    for (const tableName of tablesToTry) {
      try {
        console.log(`\n📋 Testing table: ${tableName}`)
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(1)
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`)
        } else {
          console.log(`✅ ${tableName}: Found! Count: ${count}, Sample:`, data)
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`)
      }
    }
    
    // Try to get any available tables using SQL
    console.log('\n🔍 Trying to list all tables...')
    try {
      const { data, error } = await supabase.rpc('list_tables')
      if (error) {
        console.log('❌ Could not list tables:', error.message)
      } else {
        console.log('✅ Available tables:', data)
      }
    } catch (err) {
      console.log('❌ RPC not available:', err.message)
    }
    
  } catch (err) {
    console.error('❌ Database exploration error:', err.message)
  }
}

exploreDatabase()
