// Simple test to verify the fix
const { createClient } = require('@supabase/supabase-js')

// You'll need to update these with the new keys after regenerating them
const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseAnonKey = 'YOUR_NEW_ANON_KEY_HERE'

async function quickTest() {
  console.log('🧪 Quick test after fixing API keys...')
  
  const client = createClient(supabaseUrl, supabaseAnonKey)
  
  // Test 1: Auth (should still work)
  const { data: session, error: authError } = await client.auth.getSession()
  console.log(`Auth test: ${authError ? '❌ ' + authError.message : '✅ Working'}`)
  
  // Test 2: Simple REST call (this should work after the fix)
  const { data, error } = await client.from('sensors').select('*').limit(1)
  console.log(`Database test: ${error ? '❌ ' + error.message : '✅ Working'}`)
  
  if (!error && data) {
    console.log(`Found ${data.length} sensors`)
  }
}

quickTest()
