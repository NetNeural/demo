import { chromium } from 'playwright';

const PRODUCTION_URL = 'https://demo.netneural.ai';
const TEST_EMAIL = 'kaidream78@gmail.com';
const TEST_PASSWORD = 'Welcome2NetNeural!';

async function comprehensiveTest() {
  console.log('🔍 COMPREHENSIVE PRODUCTION TEST\n');
  console.log('='.repeat(80));
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const allIssues = [];
  const apiErrors = [];

  // Track API calls
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('supabase.co') && response.status() >= 400) {
      try {
        const body = await response.text();
        apiErrors.push({
          status: response.status(),
          method: response.request().method(),
          url: url,
          body: body.substring(0, 200)
        });
      } catch (e) {
        apiErrors.push({
          status: response.status(),
          method: response.request().method(),
          url: url
        });
      }
    }
  });

  try {
    // ==========================================================================
    // TEST 1: LOGIN
    // ==========================================================================
    console.log('\n📝 TEST 1: Login Flow');
    console.log('-'.repeat(80));
    
    await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('input[type="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForURL('**/dashboard**', { timeout: 10000 });
      console.log('✅ Login successful - redirected to dashboard');
    } catch (error) {
      console.log('❌ Login failed - did not redirect to dashboard');
      allIssues.push({
        severity: 'CRITICAL',
        test: 'Login',
        issue: 'Failed to redirect to dashboard after login'
      });
      throw error;
    }

    await page.waitForTimeout(2000);

    // ==========================================================================
    // TEST 1.5: SELECT ORGANIZATION
    // ==========================================================================
    console.log('\n📝 TEST 1.5: Selecting Organization');
    console.log('-'.repeat(80));
    
    try {
      // Look for organization switcher
      const orgSwitcher = page.locator('[class*="organization"], button:has-text("NetNeural"), button:has-text("Test Org")').first();
      
      if (await orgSwitcher.isVisible({ timeout: 2000 })) {
        await orgSwitcher.click();
        await page.waitForTimeout(500);
        
        // Try to find and click "Test Org" or "NetNeural"
        const testOrg = page.locator('text=/Test.*Org|NetNeural.*Demo|Demo.*Organization/i').first();
        if (await testOrg.isVisible({ timeout: 2000 })) {
          await testOrg.click();
          await page.waitForTimeout(1000);
          console.log('✅ Selected organization');
        } else {
          console.log('⚠️  Could not find Test Org option - clicking outside to close');
          // Click outside to close the popup
          await page.click('body', { position: { x: 10, y: 10 } });
          await page.waitForTimeout(500);
        }
      } else {
        console.log('⚠️  Organization switcher not found - using default org');
      }
    } catch (error) {
      console.log('⚠️  Organization selection skipped:', error.message);
      // Make sure popup is closed
      try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } catch (e) {
        // Ignore
      }
    }

    // ==========================================================================
    // TEST 2: DASHBOARD PAGE
    // ==========================================================================
    console.log('\n📝 TEST 2: Dashboard Page');
    console.log('-'.repeat(80));
    
    const dashboardElements = {
      hasTitle: await page.locator('h1, h2').count() > 0,
      hasNav: await page.locator('nav, [role="navigation"]').count() > 0,
      hasContent: await page.locator('main, [role="main"]').count() > 0
    };
    
    console.log(`Title present: ${dashboardElements.hasTitle ? '✅' : '❌'}`);
    console.log(`Navigation present: ${dashboardElements.hasNav ? '✅' : '❌'}`);
    console.log(`Main content: ${dashboardElements.hasContent ? '✅' : '❌'}`);
    
    if (!dashboardElements.hasNav) {
      allIssues.push({
        severity: 'HIGH',
        test: 'Dashboard',
        issue: 'Navigation menu missing'
      });
    }

    // ==========================================================================
    // TEST 3: NAVIGATION STRUCTURE
    // ==========================================================================
    console.log('\n📝 TEST 3: Navigation Structure');
    console.log('-'.repeat(80));
    
    // Get all clickable navigation items
    const navLinks = await page.locator('a[href], button').allTextContents();
    const uniqueLinks = [...new Set(navLinks.filter(link => link.trim().length > 0))];
    
    console.log(`Total navigation items found: ${uniqueLinks.length}`);
    const expectedLinks = ['Dashboard', 'Devices', 'Alerts', 'Organizations', 'Settings'];
    
    expectedLinks.forEach(expected => {
      const found = uniqueLinks.some(link => link.includes(expected));
      console.log(`  ${expected}: ${found ? '✅' : '❌'}`);
      
      if (!found) {
        allIssues.push({
          severity: 'HIGH',
          test: 'Navigation',
          issue: `Missing navigation link: ${expected}`
        });
      }
    });

    // ==========================================================================
    // TEST 4: DEVICES PAGE
    // ==========================================================================
    console.log('\n📝 TEST 4: Devices Page');
    console.log('-'.repeat(80));
    
    apiErrors.length = 0; // Clear previous errors
    
    try {
      // Try multiple selectors for Devices link
      const devicesLink = page.locator('a:has-text("Devices"), button:has-text("Devices")').first();
      await devicesLink.click({ timeout: 5000 });
      await page.waitForURL('**/devices**', { timeout: 10000 });
      console.log('✅ Navigated to Devices page');
    } catch (error) {
      console.log('❌ Could not navigate to Devices page:', error.message);
      allIssues.push({
        severity: 'CRITICAL',
        test: 'Devices Navigation',
        issue: 'Cannot navigate to Devices page'
      });
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'devices-nav-error.png' });
      console.log('📸 Screenshot saved: devices-nav-error.png');
      
      throw error;
    }
    
    await page.waitForTimeout(3000); // Wait for API calls
    
    // Check for devices table or list
    const deviceElements = {
      hasTable: await page.locator('table').count() > 0,
      hasRows: await page.locator('table tbody tr, [data-testid="device-item"]').count(),
      hasEmptyState: await page.locator('text=/no devices/i, text=/empty/i').count() > 0
    };
    
    console.log(`Table present: ${deviceElements.hasTable ? '✅' : '❌'}`);
    console.log(`Device rows: ${deviceElements.hasRows}`);
    console.log(`Empty state: ${deviceElements.hasEmptyState ? 'YES' : 'NO'}`);
    
    if (deviceElements.hasRows === 0 && !deviceElements.hasEmptyState) {
      console.log('⚠️  No devices displayed and no empty state message');
      allIssues.push({
        severity: 'HIGH',
        test: 'Devices Page',
        issue: 'No devices displayed (expected 20+ devices)'
      });
    } else if (deviceElements.hasRows > 0) {
      console.log(`✅ Found ${deviceElements.hasRows} devices`);
    }
    
    // Check for API errors
    if (apiErrors.length > 0) {
      console.log(`\n❌ API Errors detected on Devices page:`);
      apiErrors.forEach(err => {
        console.log(`   ${err.status} ${err.method} ${err.url}`);
        if (err.body) console.log(`   Response: ${err.body}`);
      });
      
      apiErrors.forEach(err => {
        allIssues.push({
          severity: 'HIGH',
          test: 'Devices API',
          issue: `${err.status} error: ${err.url}`
        });
      });
    }

    // ==========================================================================
    // TEST 5: ALERTS PAGE
    // ==========================================================================
    console.log('\n📝 TEST 5: Alerts Page');
    console.log('-'.repeat(80));
    
    apiErrors.length = 0;
    
    try {
      const alertsLink = page.locator('a:has-text("Alerts"), button:has-text("Alerts")').first();
      await alertsLink.click({ timeout: 5000 });
      await page.waitForURL('**/alerts**', { timeout: 10000 });
      console.log('✅ Navigated to Alerts page');
    } catch (error) {
      console.log('❌ Could not navigate to Alerts page:', error.message);
      allIssues.push({
        severity: 'HIGH',
        test: 'Alerts Navigation',
        issue: 'Cannot navigate to Alerts page'
      });
    }
    
    await page.waitForTimeout(2000);
    
    const alertCount = await page.locator('[data-testid="alert-item"], table tbody tr, .alert').count();
    console.log(`Alert items found: ${alertCount}`);
    
    if (alertCount > 0) {
      console.log('✅ Alerts page showing data');
    }

    // ==========================================================================
    // TEST 6: ORGANIZATIONS PAGE
    // ==========================================================================
    console.log('\n📝 TEST 6: Organizations Page');
    console.log('-'.repeat(80));
    
    apiErrors.length = 0;
    
    try {
      const orgsLink = page.locator('a:has-text("Organizations"), button:has-text("Organizations")').first();
      await orgsLink.click({ timeout: 5000 });
      await page.waitForURL('**/organizations**', { timeout: 10000 });
      console.log('✅ Navigated to Organizations page');
      
      await page.waitForTimeout(2000);
      
      // Check for tabs
      const tabs = await page.locator('[role="tab"], button:has-text("Integrations"), button:has-text("Devices")').count();
      console.log(`Tabs found: ${tabs}`);
      
      if (tabs > 0) {
        console.log('✅ Organization tabs present');
      } else {
        console.log('⚠️  No tabs found on Organizations page');
        allIssues.push({
          severity: 'MEDIUM',
          test: 'Organizations Page',
          issue: 'Organization tabs not found'
        });
      }
      
    } catch (error) {
      console.log('❌ Could not navigate to Organizations page:', error.message);
      allIssues.push({
        severity: 'CRITICAL',
        test: 'Organizations Navigation',
        issue: 'Cannot navigate to Organizations page - link may be missing'
      });
    }

    // Take final screenshot
    await page.screenshot({ path: 'final-state.png' });
    console.log('\n📸 Final screenshot saved: final-state.png');

  } catch (error) {
    console.log(`\n❌ FATAL ERROR: ${error.message}`);
    await page.screenshot({ path: 'fatal-error.png' });
  } finally {
    await browser.close();
  }

  // ==========================================================================
  // FINAL REPORT
  // ==========================================================================
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL REPORT');
  console.log('='.repeat(80));
  
  if (allIssues.length === 0) {
    console.log('\n✅✅✅ ALL TESTS PASSED! Production is working correctly. ✅✅✅');
  } else {
    const critical = allIssues.filter(i => i.severity === 'CRITICAL');
    const high = allIssues.filter(i => i.severity === 'HIGH');
    const medium = allIssues.filter(i => i.severity === 'MEDIUM');
    
    console.log(`\n🚨 FOUND ${allIssues.length} ISSUE(S)\n`);
    
    if (critical.length > 0) {
      console.log('❌❌❌ CRITICAL ISSUES (Must Fix Immediately):');
      critical.forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.test}`);
        console.log(`   ${issue.issue}`);
      });
    }
    
    if (high.length > 0) {
      console.log('\n⚠️  HIGH PRIORITY ISSUES:');
      high.forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.test}`);
        console.log(`   ${issue.issue}`);
      });
    }
    
    if (medium.length > 0) {
      console.log('\n⚠️  MEDIUM PRIORITY ISSUES:');
      medium.forEach((issue, i) => {
        console.log(`\n${i + 1}. ${issue.test}`);
        console.log(`   ${issue.issue}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('🔧 NEXT STEPS:');
    console.log('='.repeat(80));
    console.log('\n1. Check screenshots for visual debugging');
    console.log('2. Verify RLS policies for user access');
    console.log('3. Check edge function deployment status');
    console.log('4. Verify navigation component rendering logic');
    console.log('5. Test locally to compare behavior');
  }
  
  console.log('\n' + '='.repeat(80));
  
  return allIssues.length === 0;
}

comprehensiveTest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
