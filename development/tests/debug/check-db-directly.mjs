import { chromium } from 'playwright'

const PRODUCTION_URL = 'https://demo.netneural.ai'
const TEST_EMAIL = 'kaidream78@gmail.com'
const TEST_PASSWORD = 'Welcome2NetNeural!'

async function checkDatabaseDirectly() {
  console.log('🔍 CHECKING PRODUCTION DATABASE DIRECTLY\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // Login
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 15000 })
    await page.waitForTimeout(2000)

    // Query database directly from browser
    const dbCheck = await page.evaluate(async () => {
      // Get auth token
      const authKeys = Object.keys(localStorage).filter((k) =>
        k.includes('auth')
      )
      let token = null
      for (const key of authKeys) {
        const value = localStorage.getItem(key)
        if (value) {
          try {
            const parsed = JSON.parse(value)
            if (parsed.access_token) {
              token = parsed.access_token
              break
            }
          } catch (e) {
            // ignore
          }
        }
      }

      if (!token) {
        return { error: 'No auth token found' }
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        apikey: '<YOUR_SUPABASE_KEY>',
        'Content-Type': 'application/json',
      }

      try {
        // 1. Check devices table directly (all organizations)
        const allDevicesResp = await fetch(
          'https://bldojxpockljyivldxwf.supabase.co/rest/v1/devices?select=*&limit=100',
          {
            headers,
          }
        )
        const allDevices = await allDevicesResp.json()

        // 2. Check devices for NetNeural org
        const netNeuralDevicesResp = await fetch(
          'https://bldojxpockljyivldxwf.supabase.co/rest/v1/devices?organization_id=eq.00000000-0000-0000-0000-000000000001&select=*',
          {
            headers,
          }
        )
        const netNeuralDevices = await netNeuralDevicesResp.json()

        // 3. Check devices for Tes Org
        const tesOrgDevicesResp = await fetch(
          'https://bldojxpockljyivldxwf.supabase.co/rest/v1/devices?organization_id=eq.11ec1e5c-a9df-4313-8ca3-15675f35f673&select=*',
          {
            headers,
          }
        )
        const tesOrgDevices = await tesOrgDevicesResp.json()

        // 4. Check user's organization_id from users table
        const userResp = await fetch(
          'https://bldojxpockljyivldxwf.supabase.co/rest/v1/users?id=eq.d17ea1bd-a26f-44fa-93fb-fd2fbffeb9b0&select=organization_id,role',
          {
            headers,
          }
        )
        const userRecord = await userResp.json()

        // 5. Check if devices table has any records at all
        const deviceCountResp = await fetch(
          'https://bldojxpockljyivldxwf.supabase.co/rest/v1/devices?select=count',
          {
            headers: {
              ...headers,
              Prefer: 'count=exact',
            },
          }
        )
        const deviceCountHeader = deviceCountResp.headers.get('content-range')

        return {
          allDevices: {
            count: Array.isArray(allDevices) ? allDevices.length : 0,
            data: Array.isArray(allDevices)
              ? allDevices.slice(0, 3)
              : allDevices,
          },
          netNeuralDevices: {
            count: Array.isArray(netNeuralDevices)
              ? netNeuralDevices.length
              : 0,
            data: Array.isArray(netNeuralDevices)
              ? netNeuralDevices
              : netNeuralDevices,
          },
          tesOrgDevices: {
            count: Array.isArray(tesOrgDevices) ? tesOrgDevices.length : 0,
            data: Array.isArray(tesOrgDevices) ? tesOrgDevices : tesOrgDevices,
          },
          userRecord: userRecord,
          totalDeviceCount: deviceCountHeader,
        }
      } catch (error) {
        return { error: error.message }
      }
    })

    console.log('DATABASE CHECK RESULTS:')
    console.log('='.repeat(80))

    if (dbCheck.error) {
      console.log('❌ Error:', dbCheck.error)
    } else {
      console.log('\n1. USER RECORD:')
      console.log(JSON.stringify(dbCheck.userRecord, null, 2))

      console.log('\n2. ALL DEVICES (Super Admin View):')
      console.log(`   Count: ${dbCheck.allDevices.count}`)
      if (dbCheck.allDevices.count > 0) {
        console.log(
          '   Sample:',
          JSON.stringify(dbCheck.allDevices.data, null, 2)
        )
      } else {
        console.log(
          '   Response:',
          JSON.stringify(dbCheck.allDevices.data, null, 2)
        )
      }

      console.log(
        '\n3. NETNEURAL ORG DEVICES (00000000-0000-0000-0000-000000000001):'
      )
      console.log(`   Count: ${dbCheck.netNeuralDevices.count}`)
      if (dbCheck.netNeuralDevices.count === 0) {
        console.log('   ✅ Confirmed: NetNeural org has NO devices')
      }

      console.log(
        '\n4. TES ORG DEVICES (11ec1e5c-a9df-4313-8ca3-15675f35f673):'
      )
      console.log(`   Count: ${dbCheck.tesOrgDevices.count}`)
      if (dbCheck.tesOrgDevices.count > 0) {
        console.log(
          '   Sample:',
          JSON.stringify(dbCheck.tesOrgDevices.data, null, 2)
        )
      } else {
        console.log(
          '   Response:',
          JSON.stringify(dbCheck.tesOrgDevices.data, null, 2)
        )
      }

      console.log('\n5. TOTAL DEVICE COUNT IN DATABASE:')
      console.log(`   ${dbCheck.totalDeviceCount || 'Unknown'}`)
    }

    console.log('\n' + '='.repeat(80))
    console.log('CONCLUSION:')
    if (dbCheck.allDevices?.count === 0) {
      console.log('❌ PRODUCTION DATABASE HAS NO DEVICES AT ALL')
      console.log('   - Need to migrate/seed devices from local dev')
      console.log('   - Or create new test devices in production')
    } else if (dbCheck.tesOrgDevices?.count > 0) {
      console.log('✅ Tes Org has devices!')
      console.log('   - RLS policies are working correctly')
      console.log('   - Issue is likely organization context not switching')
    } else {
      console.log(
        '⚠️  Complex issue - check RLS policies and organization context'
      )
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message)
  } finally {
    await browser.close()
  }
}

checkDatabaseDirectly()
