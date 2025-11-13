import { chromium } from 'playwright';

const LOCAL_URL = 'http://localhost:3000';
const EMAIL = 'superadmin@netneural.ai';
const PASSWORD = 'SuperSecure123!';

(async () => {
  console.log('🧪 DEBUGGING LOCAL DEVICES ISSUE\n');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Track API calls
  const apiCalls = [];
  page.on('request', request => {
    const url = request.url();
    if (url.includes('54321/functions/v1') || url.includes('supabase.co/functions')) {
      apiCalls.push({
        method: request.method(),
        url: url,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Track ALL console messages
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]:`, msg.text());
  });
  
  // Track errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR]:`, error.message);
  });
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto(`${LOCAL_URL}/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('✅ Login successful\n');
    
    // Go to devices page
    console.log('📱 Navigating to devices page...');
    await page.goto(`${LOCAL_URL}/dashboard/devices`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait longer to ensure all API calls complete
    
    // Check organization context
    console.log('\n🔍 Checking organization context...');
    const orgContext = await page.evaluate(() => {
      // Try to get the organization from localStorage
      const currentOrgId = localStorage.getItem('netneural_current_org');
      return {
        currentOrgId,
        allLocalStorage: Object.keys(localStorage).filter(k => k.includes('org'))
      };
    });
    console.log('Organization Context:', orgContext);
    
    // Check if DevicesList component rendered
    const noOrgMessage = await page.locator('text=No organization selected').count();
    console.log('No organization message:', noOrgMessage > 0 ? 'YES - Organization not set!' : 'No');
    
    const noDevicesMessage = await page.locator('text=No devices found').count();
    console.log('No devices found message:', noDevicesMessage > 0 ? 'YES' : 'No');
    
    const loadingMessage = await page.locator('text=Loading').count();
    console.log('Loading message:', loadingMessage > 0 ? 'YES' : 'No');
    
    const cardCount = await page.locator('[class*="Card"]').count();
    console.log('Card components found:', cardCount);
    
    const hasDevicesList = noDevicesMessage > 0 || cardCount > 0;
    console.log('DevicesList rendered:', hasDevicesList);
    
    // Get the actual page content
    console.log('\n📄 Page content around devices area:');
    const pageText = await page.evaluate(() => {
      const mainContent = document.querySelector('main');
      return mainContent ? mainContent.innerText.substring(0, 500) : 'No main content found';
    });
    console.log(pageText);
    
    // Check for device names specifically
    const deviceNames = await page.evaluate(() => {
      const text = document.body.innerText;
      const matches = text.match(/Temperature Sensor|Humidity Monitor|HVAC|Motion Detector/gi);
      return matches || [];
    });
    console.log('\n✅ Devices found on page:', deviceNames.length);
    console.log('Device names:', deviceNames.slice(0, 5));
    
    // Show API calls
    console.log('\n📡 API Calls made:');
    console.log(apiCalls.length > 0 ? apiCalls : 'No device-related API calls detected');
    
    // Take screenshot
    await page.screenshot({ path: 'debug-local-devices.png', fullPage: true });
    console.log('\n📸 Screenshot saved: debug-local-devices.png');
    
    // Keep browser open to inspect
    console.log('\n⏸️  Browser will stay open for 30 seconds for inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
