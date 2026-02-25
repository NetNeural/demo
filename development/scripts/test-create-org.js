#!/usr/bin/env node
/**
 * Test script to verify organization creation works via edge function
 */

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testCreateOrganization() {
  console.log('🧪 Testing organization creation edge function...\n')

  // First, get a session token by logging in
  console.log('1️⃣ Logging in as admin@netneural.ai...')

  const loginResponse = await fetch(
    `${STAGING_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: STAGING_ANON_KEY,
      },
      body: JSON.stringify({
        email: 'admin@netneural.ai',
        password: 'admin123',
      }),
    }
  )

  if (!loginResponse.ok) {
    console.error('❌ Login failed:', await loginResponse.text())
    process.exit(1)
  }

  const loginData = await loginResponse.json()
  const accessToken = loginData.access_token
  console.log('✅ Login successful')
  console.log(`   Token: ${accessToken.substring(0, 20)}...`)
  console.log('')

  // Now try to create an organization
  console.log('2️⃣ Creating test organization...')

  const orgData = {
    name: 'Test Organization ' + Date.now(),
    slug: 'test-org-' + Date.now(),
    description: 'Created by test script',
    subscriptionTier: 'starter',
  }

  console.log(`   Name: ${orgData.name}`)
  console.log(`   Slug: ${orgData.slug}`)
  console.log('')

  const createResponse = await fetch(
    `${STAGING_URL}/functions/v1/organizations`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: STAGING_ANON_KEY,
      },
      body: JSON.stringify(orgData),
    }
  )

  const responseText = await createResponse.text()
  console.log(`📊 Response status: ${createResponse.status}`)
  console.log(`📄 Response body:`)

  try {
    const responseData = JSON.parse(responseText)
    console.log(JSON.stringify(responseData, null, 2))

    if (responseData.success) {
      console.log('\n✅ Organization created successfully!')
      console.log(`   ID: ${responseData.data?.organization?.id}`)
    } else {
      console.log('\n❌ Organization creation failed:')
      console.log(`   Error: ${responseData.error || responseData.message}`)
    }
  } catch (e) {
    console.log(responseText)
  }
}

testCreateOrganization().catch(console.error)
