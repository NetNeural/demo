import { chromium } from 'playwright'

const PRODUCTION_URL = 'https://demo.netneural.ai'
const TEST_EMAIL = 'kaidream78@gmail.com'
const TEST_PASSWORD = 'Welcome2NetNeural!'

async function debugUserData() {
  console.log('🔍 DEBUGGING USER & ORGANIZATION DATA\n')

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

    // Extract user context from page
    const userData = await page.evaluate(async () => {
      // Get auth token
      const authKeys = Object.keys(localStorage).filter((k) =>
        k.includes('auth')
      )
      const authData = {}
      authKeys.forEach((key) => {
        const value = localStorage.getItem(key)
        if (value) {
          try {
            authData[key] = JSON.parse(value)
          } catch (e) {
            authData[key] = value
          }
        }
      })

      // Make API call to get user info
      const token = authData['sb-bldojxpockljyivldxwf-auth-token']?.access_token

      if (!token) {
        return { error: 'No auth token found', authData }
      }

      try {
        // Get user profile
        const userResponse = await fetch(
          'https://bldojxpockljyivldxwf.supabase.co/auth/v1/user',
          {
            headers: {
              Authorization: `Bearer ${token}`,
              apikey:
                '<YOUR_SUPABASE_KEY>',
            },
          }
        )
        const user = await userResponse.json()

        // Get user record from database
        const userRecordResponse = await fetch(
          `https://bldojxpockljyivldxwf.supabase.co/rest/v1/users?id=eq.${user.id}&select=*`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              apikey:
                '<YOUR_SUPABASE_KEY>',
            },
          }
        )
        const userRecord = await userRecordResponse.json()

        // Get organizations
        const orgsResponse = await fetch(
          'https://bldojxpockljyivldxwf.supabase.co/functions/v1/organizations',
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )
        const orgs = await orgsResponse.json()

        // Get devices for the organization
        let devices = []
        if (userRecord[0]?.organization_id) {
          const devicesResponse = await fetch(
            `https://bldojxpockljyivldxwf.supabase.co/functions/v1/devices?organization_id=${userRecord[0].organization_id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
          devices = await devicesResponse.json()
        }

        return {
          user: {
            id: user.id,
            email: user.email,
            role: user.user_metadata?.role,
            full_name: user.user_metadata?.full_name,
          },
          userRecord: userRecord[0],
          organizations: orgs,
          devices: devices,
        }
      } catch (error) {
        return { error: error.message }
      }
    })

    console.log('USER DATA:')
    console.log('='.repeat(80))
    console.log(JSON.stringify(userData, null, 2))
    console.log('\n')

    if (userData.user) {
      console.log('USER SUMMARY:')
      console.log(`  Email: ${userData.user.email}`)
      console.log(`  Role: ${userData.user.role}`)
      console.log(`  Full Name: ${userData.user.full_name}`)
      console.log(`  User ID: ${userData.user.id}`)
    }

    if (userData.userRecord) {
      console.log('\nUSER RECORD:')
      console.log(`  Organization ID: ${userData.userRecord.organization_id}`)
      console.log(`  Role: ${userData.userRecord.role}`)
    }

    if (userData.organizations) {
      console.log('\nORGANIZATIONS:')
      if (Array.isArray(userData.organizations)) {
        console.log(`  Found: ${userData.organizations.length} organization(s)`)
        userData.organizations.forEach((org) => {
          console.log(`    - ${org.name} (ID: ${org.id})`)
        })
      } else {
        console.log(`  Response: ${JSON.stringify(userData.organizations)}`)
      }
    }

    if (userData.devices) {
      console.log('\nDEVICES:')
      if (Array.isArray(userData.devices)) {
        console.log(`  Found: ${userData.devices.length} device(s)`)
        userData.devices.slice(0, 5).forEach((device) => {
          console.log(`    - ${device.name} (${device.device_id})`)
        })
        if (userData.devices.length > 5) {
          console.log(`    ... and ${userData.devices.length - 5} more`)
        }
      } else {
        console.log(`  Response: ${JSON.stringify(userData.devices)}`)
      }
    }
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await browser.close()
  }
}

debugUserData()
