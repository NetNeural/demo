// Quick test to verify Supabase credentials
const { createClient } = require('@supabase/supabase-js')

// Production credentials from .env.production
const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM0MDA3Mzc0LCJleHAiOjIwNDk1ODMzNzR9.OtwjXBc7bL4RhMBg85MX3rNKOUWL9KM8L5ZgKKCxQ-E'

console.log('🧪 Testing Supabase credentials...')
console.log(`URL: ${supabaseUrl}`)
console.log(`Anon Key length: ${supabaseAnonKey.length}`)
console.log(`Service Key length: ${supabaseServiceKey.length}`)

async function testConnection(keyType, key) {
  try {
    console.log(`\n🔑 Testing ${keyType} key...`)
    const supabase = createClient(supabaseUrl, key)
    
    // Test a simple query
    const { data, error } = await supabase
      .from('sensors')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error(`❌ ${keyType} Error:`, error)
      return false
    }
    
    console.log(`✅ ${keyType} connection successful!`)
    console.log('📊 Response:', data)
    return true
    
  } catch (err) {
    console.error(`❌ ${keyType} Connection Error:`, err.message)
    return false
  }
}

async function testAll() {
  const anonSuccess = await testConnection('Anon', supabaseAnonKey)
  const serviceSuccess = await testConnection('Service', supabaseServiceKey)
  
  if (anonSuccess || serviceSuccess) {
    console.log('\n✅ At least one key works!')
    process.exit(0)
  } else {
    console.log('\n❌ Both keys failed')
    process.exit(1)
  }
}

testAll()
