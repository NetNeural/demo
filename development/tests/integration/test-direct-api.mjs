import { chromium } from 'playwright'

const PRODUCTION_URL = 'https://demo.netneural.ai'
const EMAIL = 'kaidream78@gmail.com'
const PASSWORD = 'Welcome2NetNeural!'

;(async () => {
  console.log('🔍 TESTING DIRECT API CALLS\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Capture auth token from requests
  let authToken = null
  page.on('request', (request) => {
    const authHeader = request.headers()['authorization']
    if (authHeader && authHeader.startsWith('Bearer ') && !authToken) {
      authToken = authHeader.replace('Bearer ', '')
    }
  })

  try {
    // Login
    console.log('🔐 Logging in...')
    await page.goto(`${PRODUCTION_URL}/auth/login`, {
      waitUntil: 'networkidle',
    })
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForTimeout(3000)

    // Navigate to trigger API call
    await page.goto(`${PRODUCTION_URL}/dashboard/devices`, {
      waitUntil: 'networkidle',
    })
    await page.waitForTimeout(2000)

    console.log('✅ Login successful\n')

    if (!authToken) {
      console.log('❌ No auth token captured')
      return
    }

    console.log('🔑 Auth Token Captured\n')

    // Test API calls directly
    const tesOrgId = '11ec1e5c-a9df-4313-8ca3-15675f35f673'
    const netNeuralId = '00000000-0000-0000-0000-000000000001'

    console.log('📡 TEST 1: Devices for Tes Org (has 3 devices)')
    const response1 = await page.evaluate(
      async ({ orgId, token }) => {
        const resp = await fetch(
          `https://bldojxpockljyivldxwf.supabase.co/functions/v1/devices?organization_id=${orgId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )
        return {
          status: resp.status,
          data: await resp.json(),
        }
      },
      { orgId: tesOrgId, token: authToken }
    )

    console.log(`  Status: ${response1.status}`)
    console.log(`  Devices: ${response1.data?.data?.devices?.length || 0}`)
    if (response1.data?.data?.devices?.length > 0) {
      response1.data.data.devices.forEach((d, i) => {
        console.log(`    ${i + 1}. ${d.name} (${d.status})`)
      })
    }

    console.log('\n📡 TEST 2: Devices for NetNeural (has 0 devices)')
    const response2 = await page.evaluate(
      async ({ orgId, token }) => {
        const resp = await fetch(
          `https://bldojxpockljyivldxwf.supabase.co/functions/v1/devices?organization_id=${orgId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )
        return {
          status: resp.status,
          data: await resp.json(),
        }
      },
      { orgId: netNeuralId, token: authToken }
    )

    console.log(`  Status: ${response2.status}`)
    console.log(`  Devices: ${response2.data?.data?.devices?.length || 0}`)

    console.log(
      '\n📡 TEST 3: Devices WITHOUT org filter (super admin should see all)'
    )
    const response3 = await page.evaluate(
      async ({ token }) => {
        const resp = await fetch(
          `https://bldojxpockljyivldxwf.supabase.co/functions/v1/devices`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        )
        return {
          status: resp.status,
          data: await resp.json(),
        }
      },
      { token: authToken }
    )

    console.log(`  Status: ${response3.status}`)
    console.log(`  Devices: ${response3.data?.data?.devices?.length || 0}`)
    if (response3.data?.data?.devices?.length > 0) {
      response3.data.data.devices.forEach((d, i) => {
        console.log(`    ${i + 1}. ${d.name} (${d.status})`)
      })
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await browser.close()
  }
})()
