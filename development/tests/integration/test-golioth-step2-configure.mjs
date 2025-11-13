import { chromium } from 'playwright';

const LOCAL_URL = 'http://localhost:3000';
const EMAIL = 'superadmin@netneural.ai';
const PASSWORD = 'SuperSecure123!';
const GOLIOTH_API_KEY = 'DAf7enB249brtg8EAX7nWnMqWlyextWY';
const GOLIOTH_PROJECT_ID = 'nn-cellular-alerts';

(async () => {
  console.log('⚙️  STEP 2: Configure existing Golioth integration\n');
  
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto(`${LOCAL_URL}/auth/login`);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    console.log('✅ Logged in\n');
    
    // Go to integrations
    console.log('🔧 Opening integrations page...');
    await page.goto(`${LOCAL_URL}/dashboard/integrations`);
    await page.waitForTimeout(2000);
    
    // Click Configure button
    console.log('🔧 Clicking Configure button...');
    await page.click('button:has-text("Configure")');
    await page.waitForTimeout(2000);
    
    // Check if dialog opened
    const dialogOpen = await page.locator('[role="dialog"], .dialog, .modal').count();
    console.log(`Dialog opened: ${dialogOpen > 0 ? 'YES' : 'NO'}`);
    
    if (dialogOpen > 0) {
      // Fill in API key and Project ID
      console.log('\n📝 Filling credentials...');
      console.log(`  API Key: ${GOLIOTH_API_KEY.substring(0, 10)}...`);
      console.log(`  Project ID: ${GOLIOTH_PROJECT_ID}`);
      
      const apiKeyInput = page.locator('input[id="api-key"], input[type="password"]').first();
      const currentValue = await apiKeyInput.inputValue();
      
      if (!currentValue || currentValue === '' || currentValue.includes('•')) {
        console.log('  Filling API key...');
        await apiKeyInput.fill(GOLIOTH_API_KEY);
        await page.waitForTimeout(500);
      } else {
        console.log('  API key already filled');
      }
      
      const projectInput = page.locator('input[id="project-id"]').first();
      const projectValue = await projectInput.inputValue();
      
      if (!projectValue || projectValue === '') {
        console.log('  Filling project ID...');
        await projectInput.fill(GOLIOTH_PROJECT_ID);
        await page.waitForTimeout(500);
      } else {
        console.log(`  Project ID already set: ${projectValue}`);
      }
      
      await page.screenshot({ path: 'step2-filled-credentials.png' });
      console.log('\n📸 Screenshot: step2-filled-credentials.png');
    }
    
    console.log('\n⏸️  Keeping browser open for 20 seconds to review...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
