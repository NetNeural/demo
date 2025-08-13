// Test the exact credentials provided by the user
const { createClient } = require('@supabase/supabase-js')

// Credentials from user's GitHub Secrets
const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM0MDA3Mzc0LCJleHAiOjIwNDk1ODMzNzR9.OtwjXBc7bL4RhMBg85MX3rNKOUWL9KM8L5ZgKKCxQ-E'

console.log('🧪 Testing credentials from GitHub Secrets...')
console.log(`URL: ${supabaseUrl}`)
console.log(`Anon Key: ${supabaseAnonKey.substring(0, 20)}...`)
console.log(`Service Key: ${supabaseServiceKey.substring(0, 20)}...`)

async function testCredentials() {
  try {
    console.log('\n🔑 Testing anon key...')
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Test the most basic query - just get the connection
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Anon Key Error:', error)
    } else {
      console.log('✅ Anon key connection successful!')
      console.log('📊 Session data available')
    }
    
    // Try a simple table query
    console.log('\n📋 Testing table access...')
    const { data: tableData, error: tableError } = await supabase
      .from('sensors')
      .select('*')
      .limit(1)
    
    if (tableError) {
      console.error('❌ Table query error:', tableError)
    } else {
      console.log('✅ Table access successful!')
      console.log('📊 Table data:', tableData)
    }
    
  } catch (err) {
    console.error('❌ Connection Error:', err.message)
  }
}

testCredentials()
