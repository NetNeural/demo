import { chromium } from 'playwright';

const PRODUCTION_URL = 'https://demo.netneural.ai';
const EMAIL = 'kaidream78@gmail.com';
const PASSWORD = 'Welcome2NetNeural!';

(async () => {
  console.log('🔄 TESTING ORGANIZATION SWITCHING\n');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Track console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error' || type === 'warning' || text.includes('device') || text.includes('Device')) {
      consoleMessages.push(`[${type}] ${text}`);
    }
  });
  
  // Track API calls
  const apiCalls = [];
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/functions/v1/devices')) {
      apiCalls.push({
        url: url,
        orgId: new URL(url).searchParams.get('organization_id')
      });
    }
  });
  
  // Track API responses
  const apiResponses = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/functions/v1/devices')) {
      try {
        const body = await response.json();
        apiResponses.push({
          url: url,
          status: response.status(),
          body: body
        });
      } catch (e) {
        apiResponses.push({
          url: url,
          status: response.status(),
          body: 'Could not parse JSON'
        });
      }
    }
  });
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto(`${PRODUCTION_URL}/auth/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000); // Wait for redirect
    console.log('✅ Login successful\n');
    
    // Go to devices page
    await page.goto(`${PRODUCTION_URL}/dashboard/devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    console.log('📡 API CALL #1 (Initial Load - NetNeural Org):');
    if (apiCalls.length > 0) {
      console.log(`  URL: ${apiCalls[apiCalls.length - 1].url}`);
      console.log(`  Org ID: ${apiCalls[apiCalls.length - 1].orgId}`);
    }
    if (apiResponses.length > 0) {
      const resp = apiResponses[apiResponses.length - 1];
      console.log(`  Response Status: ${resp.status}`);
      console.log(`  Response Body:`, JSON.stringify(resp.body, null, 2));
    }
    
    // Open org switcher
    console.log('\n🔄 Opening organization switcher...');
    const switcherButton = await page.locator('button:has-text("NetNeural")').first();
    if (await switcherButton.count() > 0) {
      await switcherButton.click();
      await page.waitForTimeout(1000);
      
      // Debug: what options are available?
      const dropdownVisible = await page.locator('[role="menu"]').isVisible();
      console.log(`  Dropdown visible: ${dropdownVisible}`);
      
      if (dropdownVisible) {
        const options = await page.locator('[role="menuitem"]').allTextContents();
        console.log(`  Available options: ${options.join(', ')}`);
      }
      
      // Click on "Tes Org" - try different selectors
      console.log('🎯 Selecting "Tes Org"...');
      const tesOrgOption = await page.locator('[role="menuitem"]:has-text("Tes Org")').first();
      if (await tesOrgOption.count() > 0) {
        await tesOrgOption.click();
        await page.waitForTimeout(2000); // Wait for API call
        
        console.log('\n📡 API CALL #2 (After Switching to Tes Org):');
        if (apiCalls.length > 1) {
          const lastCall = apiCalls[apiCalls.length - 1];
          console.log(`  URL: ${lastCall.url}`);
          console.log(`  Org ID: ${lastCall.orgId}`);
          
          // Check if org ID changed
          if (lastCall.orgId === '11ec1e5c-a9df-4313-8ca3-15675f35f673') {
            console.log('  ✅ CORRECT! Switched to Tes Org ID');
          } else if (lastCall.orgId === '00000000-0000-0000-0000-000000000001') {
            console.log('  ❌ WRONG! Still using NetNeural org ID');
          }
        }
        if (apiResponses.length > 1) {
          const resp = apiResponses[apiResponses.length - 1];
          console.log(`  Response Status: ${resp.status}`);
          console.log(`  Response Body:`, JSON.stringify(resp.body, null, 2));
        }
        
        // Check devices displayed
        await page.waitForTimeout(3000); // Give more time for render
        
        // Check for table rows
        const deviceCount = await page.locator('table tbody tr').count();
        console.log(`\n📊 Table rows found: ${deviceCount}`);
        
        // Check for any device cards or list items
        const deviceCards = await page.locator('[data-device-id], .device-card, .device-item').count();
        console.log(`📊 Device cards/items: ${deviceCards}`);
        
        // Check the actual page content
        const pageText = await page.locator('main, [role="main"]').textContent();
        const hasDeviceText = pageText?.includes('HVAC') || pageText?.includes('Test Device');
        console.log(`📊 Device text visible: ${hasDeviceText}`);
        
        // Check for "No devices found" message
        const noDevicesMsg = await page.locator('text=No devices found').count();
        console.log(`📊 "No devices found" messages: ${noDevicesMsg}`);
        
        // Check for any error messages
        const errorMsg = await page.locator('[role="alert"], .text-destructive').allTextContents();
        if (errorMsg.length > 0 && errorMsg.some(m => m.trim())) {
          console.log(`⚠️  Error messages:`, errorMsg.filter(m => m.trim()));
        }
        
        // Take a screenshot
        await page.screenshot({ path: 'tes-org-devices.png', fullPage: true });
        console.log(`📸 Screenshot saved: tes-org-devices.png`);
        
      } else {
        console.log('  ❌ "Tes Org" option not found');
      }
    } else {
      console.log('  ❌ Organization switcher button not found');
    }
    
    // Show all API calls
    console.log(`\n📋 TOTAL API CALLS: ${apiCalls.length}`);
    apiCalls.forEach((call, i) => {
      console.log(`  ${i + 1}. Org ID: ${call.orgId}`);
    });
    
    // Show console messages
    if (consoleMessages.length > 0) {
      console.log(`\n🖥️  BROWSER CONSOLE MESSAGES:`);
      consoleMessages.forEach(msg => console.log(`  ${msg}`));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
