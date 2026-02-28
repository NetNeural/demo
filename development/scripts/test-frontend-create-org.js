#!/usr/bin/env node
/**
 * Test organization creation from frontend perspective
 */

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function testWithAnonKey() {
  console.log(
    '🧪 Testing organization creation with anon key (like frontend)...\n'
  )

  const testOrg = {
    name: 'Test Frontend',
    slug: 'test-frontend-' + Date.now(),
    description: 'Created like frontend',
    subscriptionTier: 'starter',
  }

  console.log('Creating organization...')
  console.log(`   Name: ${testOrg.name}`)
  console.log(`   Slug: ${testOrg.slug}`)
  console.log('')

  try {
    const response = await fetch(`${STAGING_URL}/functions/v1/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${STAGING_ANON_KEY}`,
        apikey: STAGING_ANON_KEY,
      },
      body: JSON.stringify(testOrg),
    })

    console.log(`Response status: ${response.status}`)
    console.log(
      `Response headers:`,
      Object.fromEntries(response.headers.entries())
    )

    const responseText = await response.text()
    console.log(`Response body:`)

    try {
      const responseData = JSON.parse(responseText)
      console.log(JSON.stringify(responseData, null, 2))

      if (responseData.success) {
        console.log('\n✅ SUCCESS! Organization created!')
        return responseData.data
      } else {
        console.log('\n❌ FAILED:')
        console.log(`   Error: ${responseData.error || responseData.message}`)
        return null
      }
    } catch (e) {
      console.log('Raw response (not JSON):')
      console.log(responseText)
      return null
    }
  } catch (error) {
    console.error('Request failed:', error)
    return null
  }
}

testWithAnonKey().catch(console.error)
