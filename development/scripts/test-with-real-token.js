#!/usr/bin/env node

/**
 * Test organization creation with a real user token
 * This script will authenticate as admin@netneural.ai and try to create an organization
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://atgbmxicqikmapfqouco.supabase.co'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// You need to provide the password for admin@netneural.ai
const email = 'admin@netneural.ai'
const password = process.argv[2] || 'NetNeural2024!'

const supabase = createClient(supabaseUrl, anonKey)

async function testWithRealAuth() {
  console.log('🔐 Authenticating as', email)
  
  // Sign in to get a real session token
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (authError) {
    console.error('❌ Authentication failed:', authError)
    console.log('\nUsage: node test-with-real-token.js <password>')
    return
  }
  
  console.log('✅ Authenticated successfully')
  console.log('   User ID:', authData.user.id)
  console.log('   Access token:', authData.session.access_token.substring(0, 50) + '...')
  
  // Now try to create an organization with the real token
  console.log('\n🧪 Creating organization V-Mark...')
  
  const response = await fetch(`${supabaseUrl}/functions/v1/organizations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authData.session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'V-Mark',
      slug: 'v-mark',
      description: 'Test organization for multi-tenancy'
    })
  })
  
  console.log('\n📊 Response status:', response.status)
  console.log('Response headers:', Object.fromEntries(response.headers.entries()))
  
  const responseText = await response.text()
  console.log('\n📝 Response body (raw):', responseText)
  
  try {
    const responseData = JSON.parse(responseText)
    console.log('\n📋 Response body (parsed):', JSON.stringify(responseData, null, 2))
    
    if (response.ok) {
      console.log('\n✅ SUCCESS! Organization created')
    } else {
      console.log('\n❌ FAILED!')
    }
  } catch (e) {
    console.log('\n⚠️  Response is not JSON')
  }
}

testWithRealAuth().catch(console.error)
