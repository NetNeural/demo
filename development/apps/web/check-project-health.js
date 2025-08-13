// Check Supabase project health and status
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI'

async function checkProjectHealth() {
  console.log('🔍 Checking Supabase project health...')
  
  const client = createClient(supabaseUrl, supabaseAnonKey)
  
  console.log(`📍 Project URL: ${supabaseUrl}`)
  console.log(`🔑 Using anon key: ${supabaseAnonKey.substring(0, 20)}...`)
  
  // 1. Test basic connection
  console.log('\n1. 🌐 Testing basic connection...')
  try {
    const response = await fetch(supabaseUrl + '/rest/v1/', {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    })
    
    console.log(`   Status: ${response.status} ${response.statusText}`)
    
    if (response.status === 404) {
      console.log('   ❌ Project not found or not accessible')
    } else if (response.status === 401) {
      console.log('   ❌ Unauthorized - API key might be invalid')
    } else if (response.status === 200) {
      console.log('   ✅ Basic connection successful')
    } else {
      console.log(`   ⚠️ Unexpected status: ${response.status}`)
    }
    
    const text = await response.text()
    console.log(`   Response: ${text.substring(0, 200)}...`)
    
  } catch (err) {
    console.log(`   ❌ Connection failed: ${err.message}`)
  }
  
  // 2. Test auth endpoint specifically
  console.log('\n2. 🔐 Testing auth endpoint...')
  try {
    const { data, error } = await client.auth.getSession()
    if (error) {
      console.log(`   ❌ Auth error: ${error.message}`)
    } else {
      console.log('   ✅ Auth endpoint working')
      console.log(`   Session exists: ${!!data.session}`)
    }
  } catch (err) {
    console.log(`   ❌ Auth exception: ${err.message}`)
  }
  
  // 3. Test REST API directly
  console.log('\n3. 📡 Testing REST API directly...')
  try {
    const response = await fetch(supabaseUrl + '/rest/v1/sensors?select=*&limit=1', {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`   Status: ${response.status} ${response.statusText}`)
    const responseText = await response.text()
    console.log(`   Response: ${responseText}`)
    
    if (response.status === 406) {
      console.log('   💡 This might be a schema/table issue')
    } else if (response.status === 401) {
      console.log('   💡 This confirms the API key issue')
    }
    
  } catch (err) {
    console.log(`   ❌ REST API test failed: ${err.message}`)
  }
  
  // 4. Check if we can access any basic Supabase endpoint
  console.log('\n4. 🏥 Testing health endpoint...')
  try {
    const response = await fetch(supabaseUrl + '/rest/v1/', {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey
      }
    })
    
    console.log(`   Health check status: ${response.status}`)
    
  } catch (err) {
    console.log(`   ❌ Health check failed: ${err.message}`)
  }
  
  console.log('\n📋 Diagnosis:')
  console.log('- If connection fails: Project URL might be wrong')
  console.log('- If auth works but REST fails: Database not initialized or RLS blocking')
  console.log('- If everything fails: API keys are completely invalid')
  console.log('- If 401 everywhere: Project might be paused or keys regenerated')
}

checkProjectHealth()
