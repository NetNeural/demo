import { chromium } from 'playwright';

const PRODUCTION_URL = 'https://demo.netneural.ai';
const TEST_EMAIL = 'kaidream78@gmail.com';
const TEST_PASSWORD = 'Welcome2NetNeural!';

async function quickProductionCheck() {
  console.log('🔍 QUICK PRODUCTION CHECK - demo.netneural.ai\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const apiResponses = {};
  
  // Capture all API responses
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('functions/v1') || url.includes('rest/v1')) {
      try {
        const body = await response.json();
        apiResponses[url] = {
          status: response.status(),
          body: body
        };
      } catch (e) {
        apiResponses[url] = {
          status: response.status(),
          error: 'Could not parse JSON'
        };
      }
    }
  });
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    console.log('✅ Login successful\n');
    
    // Close any popups
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    
    // Navigate to Devices
    console.log('📱 Navigating to Devices page...');
    await page.click('a[href="/dashboard/devices"]');
    await page.waitForURL('**/devices**');
    await page.waitForTimeout(3000); // Wait for all API calls
    console.log('✅ Devices page loaded\n');
    
    // Check what's on the page
    const pageContent = await page.evaluate(() => {
      return {
        hasTable: document.querySelector('table') !== null,
        tableRows: document.querySelectorAll('table tbody tr').length,
        hasEmptyMessage: document.body.innerText.toLowerCase().includes('no devices'),
        bodyText: document.body.innerText.substring(0, 500)
      };
    });
    
    console.log('📊 PAGE ANALYSIS:');
    console.log(`  Table exists: ${pageContent.hasTable}`);
    console.log(`  Table rows: ${pageContent.tableRows}`);
    console.log(`  Empty message: ${pageContent.hasEmptyMessage}`);
    console.log(`\nPage text preview:`);
    console.log(pageContent.bodyText);
    console.log('\n');
    
    // Show API responses
    console.log('🔍 API RESPONSES:');
    console.log('='.repeat(80));
    
    Object.entries(apiResponses).forEach(([url, data]) => {
      const shortUrl = url.replace('https://bldojxpockljyivldxwf.supabase.co', '');
      console.log(`\n${data.status} ${shortUrl}`);
      
      if (data.body) {
        if (Array.isArray(data.body)) {
          console.log(`  Array with ${data.body.length} items`);
          if (data.body.length > 0 && data.body.length <= 3) {
            console.log('  Items:', JSON.stringify(data.body, null, 2));
          }
        } else if (data.body.data && Array.isArray(data.body.data)) {
          console.log(`  Response with data array: ${data.body.data.length} items`);
          if (data.body.success !== undefined) {
            console.log(`  Success: ${data.body.success}`);
          }
        } else {
          console.log('  Body:', JSON.stringify(data.body, null, 2));
        }
      } else if (data.error) {
        console.log(`  Error: ${data.error}`);
      }
    });
    
    // Take screenshot
    await page.screenshot({ path: 'production-devices-page.png', fullPage: true });
    console.log('\n📸 Screenshot saved: production-devices-page.png');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

quickProductionCheck();
