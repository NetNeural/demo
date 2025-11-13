import { chromium } from 'playwright';

const LOCAL_URL = 'http://localhost:3000';
const EMAIL = 'superadmin@netneural.ai';
const PASSWORD = 'SuperSecure123!';
const GOLIOTH_API_KEY = 'DAf7enB249brtg8EAX7nWnMqWlyextWY';
const GOLIOTH_PROJECT_ID = 'nn-cellular-alerts';

(async () => {
  console.log('🔌 STEP 3: Test connection and save\n');
  
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  
  // Track API responses
  const responses = [];
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/functions/v1/')) {
      try {
        const body = await response.json();
        responses.push({
          url: url.split('/functions/v1/')[1],
          status: response.status(),
          body
        });
      } catch (e) {}
    }
  });
  
  try {
    // Login
    console.log('🔐 Logging in...');
    await page.goto(`${LOCAL_URL}/auth/login`);
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    // Go to integrations
    await page.goto(`${LOCAL_URL}/dashboard/integrations`);
    await page.waitForTimeout(2000);
    
    // Click Configure
    await page.click('button:has-text("Configure")');
    await page.waitForTimeout(2000);
    
    // Update project ID to correct one
    console.log('📝 Updating project ID...');
    const projectInput = page.locator('input[id="project-id"]').first();
    await projectInput.fill(GOLIOTH_PROJECT_ID);
    await page.waitForTimeout(500);
    
    // Fill API key
    const apiKeyInput = page.locator('input[id="api-key"], input[type="password"]').first();
    await apiKeyInput.fill(GOLIOTH_API_KEY);
    await page.waitForTimeout(500);
    
    console.log(`  API Key: ${GOLIOTH_API_KEY.substring(0, 10)}...`);
    console.log(`  Project ID: ${GOLIOTH_PROJECT_ID}\n`);
    
    // Click Test Connection button
    console.log('🔌 Testing connection...');
    await page.click('button:has-text("Test")');
    await page.waitForTimeout(4000);
    
    // Check for result
    const success = await page.locator('text=/success|connected/i').count();
    const error = await page.locator('text=/error|failed/i').count();
    
    if (success > 0) {
      console.log('✅ Connection test SUCCESSFUL\n');
    } else if (error > 0) {
      console.log('❌ Connection test FAILED\n');
      const errorText = await page.locator('text=/error|failed/i').first().textContent();
      console.log(`Error: ${errorText}\n`);
    } else {
      console.log('⚠️  Test status unclear\n');
    }
    
    await page.screenshot({ path: 'step3-test-connection.png' });
    console.log('📸 Screenshot: step3-test-connection.png\n');
    
    // Save configuration
    console.log('💾 Saving configuration...');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(3000);
    
    const saveSuccess = await page.locator('text=/saved|success/i').count();
    if (saveSuccess > 0) {
      console.log('✅ Configuration saved\n');
    } else {
      console.log('⚠️  Save status unclear\n');
    }
    
    // Show API responses
    console.log('📡 API Responses:');
    responses.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.url} - ${r.status}`);
      if (r.body && r.body.message) {
        console.log(`     ${r.body.message}`);
      }
    });
    
    await page.screenshot({ path: 'step3-saved.png' });
    console.log('\n📸 Screenshot: step3-saved.png');
    
    console.log('\n⏸️  Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
