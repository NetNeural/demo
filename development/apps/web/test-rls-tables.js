// Test different tables and RLS policies
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://bldojxpockljyivldxwf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczNDAwNzM3NCwiZXhwIjoyMDQ5NTgzMzc0fQ.X5HLSXPzGS7hKA3FWZhkF2V8zVxJJY6nJEaW8-sJLjI'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsZG9qeHBvY2tseWl2bGR4d2YiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzM0MDA3Mzc0LCJleHAiOjIwNDk1ODMzNzR9.OtwjXBc7bL4RhMBg85MX3rNKOUWL9KM8L5ZgKKCxQ-E'

async function testTableAccess(client, keyType) {
  console.log(`\n🔑 Testing with ${keyType} key...`)
  
  const tablesToTest = [
    // Standard Supabase tables
    'auth.users',
    'storage.buckets', 
    'storage.objects',
    
    // Common table names
    'sensors',
    'sensor_readings',
    'devices',
    'profiles',
    
    // Try some basic system tables
    'information_schema.tables',
    'pg_tables'
  ]
  
  for (const table of tablesToTest) {
    try {
      console.log(`  📋 Testing ${table}...`)
      
      const { data, error, count } = await client
        .from(table.replace(/^.*\./, '')) // Remove schema prefix for Supabase client
        .select('*', { count: 'exact' })
        .limit(1)
      
      if (error) {
        console.log(`    ❌ ${table}: ${error.message}`)
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log(`    💡 Table doesn't exist`)
        } else if (error.message.includes('permission denied') || error.message.includes('RLS')) {
          console.log(`    🔒 RLS/Permission issue`)
        }
      } else {
        console.log(`    ✅ ${table}: Success! Count: ${count}`)
        if (data && data.length > 0) {
          console.log(`    📊 Sample data:`, Object.keys(data[0]))
        }
      }
    } catch (err) {
      console.log(`    ❌ ${table}: Exception - ${err.message}`)
    }
  }
}

async function testSystemAccess(client, keyType) {
  console.log(`\n🔍 Testing system access with ${keyType}...`)
  
  // Test basic auth functions
  try {
    const { data: session, error } = await client.auth.getSession()
    if (error) {
      console.log(`  ❌ Auth session: ${error.message}`)
    } else {
      console.log(`  ✅ Auth session: Working`)
    }
  } catch (err) {
    console.log(`  ❌ Auth session: ${err.message}`)
  }
  
  // Test storage (if available)
  try {
    const { data: buckets, error } = await client.storage.listBuckets()
    if (error) {
      console.log(`  ❌ Storage buckets: ${error.message}`)
    } else {
      console.log(`  ✅ Storage buckets: ${buckets.length} buckets found`)
    }
  } catch (err) {
    console.log(`  ❌ Storage buckets: ${err.message}`)
  }
}

async function runTests() {
  console.log('🧪 Testing table access and RLS policies...')
  
  // Test with anon key
  const anonClient = createClient(supabaseUrl, supabaseAnonKey)
  await testTableAccess(anonClient, 'ANON')
  await testSystemAccess(anonClient, 'ANON')
  
  // Test with service key
  const serviceClient = createClient(supabaseUrl, supabaseServiceKey)
  await testTableAccess(serviceClient, 'SERVICE')
  await testSystemAccess(serviceClient, 'SERVICE')
  
  console.log('\n📝 Summary:')
  console.log('If you see "Invalid API key" for everything, the credentials are wrong.')
  console.log('If you see "relation does not exist", the tables need to be created.')
  console.log('If you see "permission denied" or RLS errors, we need to fix policies.')
  console.log('If some things work but others don\'t, it\'s likely an RLS issue.')
}

runTests()
