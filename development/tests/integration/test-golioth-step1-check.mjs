import { chromium } from 'playwright';

const LOCAL_URL = 'http://localhost:3000';
const EMAIL = 'superadmin@netneural.ai';
const PASSWORD = 'SuperSecure123!';

(async () => {
  console.log('🔍 STEP 1: Check existing integrations\n');
  
  const browser = await chromium.launch({ headless: false });
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
    console.log('🔧 Navigating to integrations page...');
    await page.goto(`${LOCAL_URL}/dashboard/integrations`);
    await page.waitForTimeout(2000);
    
    // Check page content
    const content = await page.evaluate(() => {
      return {
        title: document.querySelector('h1, h2')?.textContent || 'No title',
        integrationCount: document.querySelectorAll('[class*="card"], [class*="Card"]').length,
        hasGolioth: document.body.innerText.includes('Golioth'),
        pageText: document.querySelector('main')?.innerText.substring(0, 500) || 'No content'
      };
    });
    
    console.log('📊 Page Info:');
    console.log(`  Title: ${content.title}`);
    console.log(`  Cards found: ${content.integrationCount}`);
    console.log(`  Has Golioth: ${content.hasGolioth ? 'YES' : 'NO'}`);
    console.log('\n📄 Page content:');
    console.log(content.pageText);
    
    await page.screenshot({ path: 'step1-integrations-page.png' });
    console.log('\n📸 Screenshot: step1-integrations-page.png');
    
    console.log('\n⏸️  Keeping browser open for 15 seconds...');
    await page.waitForTimeout(15000);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
