import { chromium } from 'playwright'

async function checkProductionConfig() {
  console.log('🔍 CHECKING PRODUCTION CONFIGURATION\n')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    await page.goto('https://demo.netneural.ai', { waitUntil: 'networkidle' })

    // Extract environment config from the page
    const config = await page.evaluate(() => {
      // Try to find the Next.js config or environment variables
      const scripts = Array.from(document.querySelectorAll('script'))
      const configData = {}

      // Check for exposed window variables
      configData.hasSupabaseUrl = typeof window.__NEXT_DATA__ !== 'undefined'

      // Try to extract from page source
      for (const script of scripts) {
        const content = script.textContent || ''
        if (content.includes('SUPABASE') || content.includes('supabase')) {
          // Found Supabase reference
          const urlMatch = content.match(/https:\/\/[a-z0-9]+\.supabase\.co/)
          if (urlMatch) {
            configData.supabaseUrl = urlMatch[0]
          }

          // Try to find anon key pattern
          const keyMatch = content.match(
            /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g
          )
          if (keyMatch) {
            configData.foundKeys = keyMatch.length
            configData.firstKeyPrefix = keyMatch[0].substring(0, 50) + '...'
          }
        }
      }

      return configData
    })

    console.log('Configuration found in page:')
    console.log(JSON.stringify(config, null, 2))

    // Check the actual API being called
    const apiCalls = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.includes('supabase.co')) {
        apiCalls.push({
          url: url,
          method: request.method(),
          headers: Object.fromEntries(
            Object.entries(request.headers()).filter(
              ([key]) =>
                key.toLowerCase().includes('auth') ||
                key.toLowerCase().includes('apikey')
            )
          ),
        })
      }
    })

    // Try to login and see what happens
    await page.fill('input[type="email"]', 'kaidream78@gmail.com')
    await page.fill('input[type="password"]', 'Welcome2NetNeural!')
    await page.click('button[type="submit"]')

    await page.waitForTimeout(3000)

    console.log('\nAPI calls made during login:')
    apiCalls.forEach((call) => {
      console.log(`\n${call.method} ${call.url}`)
      console.log('Headers:', JSON.stringify(call.headers, null, 2))
    })

    // Check localStorage after login attempt
    const storage = await page.evaluate(() => {
      const keys = Object.keys(localStorage)
      const data = {}
      keys.forEach((key) => {
        if (key.includes('supabase') || key.includes('auth')) {
          const value = localStorage.getItem(key)
          data[key] = value ? value.substring(0, 100) + '...' : null
        }
      })
      return data
    })

    console.log('\nLocalStorage after login:')
    console.log(JSON.stringify(storage, null, 2))
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await browser.close()
  }
}

checkProductionConfig()
