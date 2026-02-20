#!/usr/bin/env node

/**
 * Test Organization Update via Edge Function
 * This simulates what the frontend does when updating an organization
 */

const { createClient } = require('@supabase/supabase-js')

const STAGE_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGE_ANON_KEY = process.env.STAGE_SUPABASE_ANON_KEY
const TEST_EMAIL = process.env.TEST_EMAIL || 'test@example.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test123'

if (!STAGE_ANON_KEY) {
  console.error('❌ Missing STAGE_SUPABASE_ANON_KEY')
  console.error('\nUsage:')
  console.error('  export STAGE_SUPABASE_ANON_KEY="your-anon-key"')
  console.error('  export TEST_EMAIL="your-test-email"  # Optional')
  console.error('  export TEST_PASSWORD="your-test-password"  # Optional')
  console.error('  node scripts/test-org-update-edge-function.js')
  process.exit(1)
}

const client = createClient(STAGE_URL, STAGE_ANON_KEY)

async function testEdgeFunctionUpdate() {
  console.log('🧪 Testing Organization Update via Edge Function\n')

  try {
    // Step 1: Sign in to get a session token
    console.log(`📝 Step 1: Signing in as ${TEST_EMAIL}...`)
    const { data: authData, error: authError } =
      await client.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      })

    if (authError || !authData.session) {
      console.error(
        '❌ Authentication failed:',
        authError?.message || 'No session'
      )
      console.error(
        '\nTry these credentials or set TEST_EMAIL and TEST_PASSWORD:'
      )
      console.error('  Email: demo@netneural.io')
      console.error('  Password: NetNeural2024')
      return
    }

    console.log('✅ Signed in successfully')
    console.log(`   User ID: ${authData.user.id}`)
    console.log(
      `   Token: ${authData.session.access_token.substring(0, 20)}...`
    )

    // Step 2: Get the user's organizations
    console.log('\n📋 Step 2: Fetching organizations...')
    const { data: orgs, error: orgsError } = await client
      .from('organizations')
      .select('*')
      .limit(1)

    if (orgsError) {
      console.error('❌ Failed to fetch organizations:', orgsError.message)
      return
    }

    if (!orgs || orgs.length === 0) {
      console.error('❌ No organizations found for this user')
      return
    }

    const targetOrg = orgs[0]
    console.log('✅ Found organization:')
    console.log(`   ID: ${targetOrg.id}`)
    console.log(`   Name: ${targetOrg.name}`)
    console.log(`   Slug: ${targetOrg.slug}`)

    // Step 3: Check  user's role in the organization
    console.log('\n👤 Step 3: Checking user role...')
    const { data: membership, error: membershipError } = await client
      .from('organization_members')
      .select('role')
      .eq('organization_id', targetOrg.id)
      .eq('user_id', authData.user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('❌ Failed to check membership:', membershipError.message)
      return
    }

    if (!membership) {
      console.error('❌ User is not a member of this organization')
      return
    }

    console.log(`✅ User role: ${membership.role}`)

    // Step 4: Call the edge function to update the organization
    console.log('\n🚀 Step 4: Calling edge function to update organization...')
    console.log(
      `   Endpoint: ${STAGE_URL}/functions/v1/organizations/${targetOrg.id}`
    )
    console.log(`   Method: PATCH`)
    console.log(`   Body: { name: "Test Update" }`)

    const response = await fetch(
      `${STAGE_URL}/functions/v1/organizations/${targetOrg.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          name: 'Test Update',
        }),
      }
    )

    console.log(
      `\n📡 Response status: ${response.status} ${response.statusText}`
    )

    const responseData = await response.json()
    console.log('\n📦 Response body:')
    console.log(JSON.stringify(responseData, null, 2))

    if (responseData.success) {
      console.log('\n✅ Update successful!')

      // Revert the change
      console.log('\n↩️  Reverting change...')
      const revertResponse = await fetch(
        `${STAGE_URL}/functions/v1/organizations/${targetOrg.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authData.session.access_token}`,
          },
          body: JSON.stringify({
            name: targetOrg.name, // Revert to original name
          }),
        }
      )

      if (revertResponse.ok) {
        console.log('✅ Reverted back to original name')
      }
    } else {
      console.log('\n❌ Update failed!')
      console.log('   Error:', responseData.error)
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    console.error(error.stack)
  }
}

testEdgeFunctionUpdate().catch(console.error)
