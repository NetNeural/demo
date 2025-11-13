import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🔐 Logging in...');
    await page.goto('https://demo.netneural.ai/auth/login', { timeout: 60000 });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', 'kaidream78@gmail.com');
    await page.fill('input[type="password"]', 'Welcome2NetNeural!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(8000);  // Give more time for auth and redirect
    
    console.log('Current URL:', page.url());
    console.log('✅ Login attempted');

    // Get the auth token from localStorage
    const authInfo = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const allStorage = {};
      keys.forEach(key => {
        if (key.includes('auth') || key.includes('supabase')) {
          allStorage[key] = localStorage.getItem(key);
        }
      });
      return allStorage;
    });

    console.log('\n📦 LocalStorage keys:', Object.keys(authInfo));
    
    let authToken = null;
    for (const [key, value] of Object.entries(authInfo)) {
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (parsed.access_token) {
            authToken = parsed.access_token;
            console.log(`Found token in key: ${key}`);
            break;
          }
        } catch (e) {
          // Not JSON, skip
        }
      }
    }

    if (authToken) {
      console.log('\n🔑 Auth Token (first 50 chars):', authToken.substring(0, 50) + '...');
      
      // Now test the devices API with the auth token
      console.log('\n📡 Testing devices API with authenticated token...\n');
      
      const tesOrgId = '11ec1e5c-a9df-4313-8ca3-15675f35f673';
      
      const response = await fetch(`https://demo.netneural.ai/functions/v1/devices?organization_id=${tesOrgId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Could not retrieve auth token');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
