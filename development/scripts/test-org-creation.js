#!/usr/bin/env node
/**
 * Test organization creation with service role (bypasses RLS)
 */

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function testDirectInsert() {
  console.log(
    '🧪 Testing direct organization creation (bypassing edge function)...\n'
  )

  const testOrg = {
    name: 'Test Direct Insert',
    slug: 'test-direct-' + Date.now(),
    description: 'Created by direct insert test',
    subscription_tier: 'starter',
    is_active: true,
    settings: {},
  }

  console.log('1️⃣ Creating organization directly via REST API...')
  console.log(`   Name: ${testOrg.name}`)
  console.log(`   Slug: ${testOrg.slug}`)

  const response = await fetch(`${STAGING_URL}/rest/v1/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: STAGING_SERVICE_KEY,
      Authorization: `Bearer ${STAGING_SERVICE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(testOrg),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`❌ Direct insert failed (${response.status}):`, errorText)
    return null
  }

  const createdOrg = await response.json()
  console.log('✅ Organization created successfully!')
  console.log(`   ID: ${createdOrg[0].id}`)
  console.log('')

  return createdOrg[0]
}

async function testEdgeFunction() {
  console.log('2️⃣ Testing edge function with service role...')

  const testOrg = {
    name: 'Test Edge Function',
    slug: 'test-edge-' + Date.now(),
    description: 'Created by edge function test',
    subscriptionTier: 'starter',
  }

  console.log(`   Name: ${testOrg.name}`)
  console.log(`   Slug: ${testOrg.slug}`)

  const response = await fetch(`${STAGING_URL}/functions/v1/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${STAGING_SERVICE_KEY}`,
      apikey: STAGING_SERVICE_KEY,
    },
    body: JSON.stringify(testOrg),
  })

  const responseText = await response.text()
  console.log(`   Response status: ${response.status}`)

  try {
    const responseData = JSON.parse(responseText)
    console.log('   Response:', JSON.stringify(responseData, null, 2))

    if (responseData.success) {
      console.log('✅ Edge function succeeded!')
      return responseData.data
    } else {
      console.log('❌ Edge function failed:')
      console.log(`   Error: ${responseData.error || responseData.message}`)
      return null
    }
  } catch (e) {
    console.log('   Raw response:', responseText)
    return null
  }
}

async function main() {
  const directResult = await testDirectInsert()
  console.log('---\n')
  const edgeResult = await testEdgeFunction()

  console.log('\n📊 Summary:')
  console.log(`   Direct insert: ${directResult ? '✅ WORKS' : '❌ FAILED'}`)
  console.log(`   Edge function: ${edgeResult ? '✅ WORKS' : '❌ FAILED'}`)
}

main().catch(console.error)
