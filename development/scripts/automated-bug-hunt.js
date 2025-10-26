const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();
  
  const bugs = [];
  const consoleErrors = [];
  const warnings = [];
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        page: page.url(),
        message: msg.text()
      });
    }
    if (msg.type() === 'warning' && msg.text().includes('Warning')) {
      warnings.push({
        page: page.url(),
        message: msg.text()
      });
    }
  });
  
  page.on('pageerror', error => {
    bugs.push({
      type: 'JavaScript Error',
      page: page.url(),
      message: error.message
    });
  });
  
  console.log('\n🔍 Starting comprehensive bug hunt...\n');
  console.log('='.repeat(60));
  
  try {
    // ============================================
    // 1. LOGIN PAGE
    // ============================================
    console.log('\n📄 PAGE 1: LOGIN');
    console.log('-'.repeat(60));
    await page.goto('http://localhost:3004/auth/login/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Check Remember Me checkbox
    const rememberMe = await page.locator('input[type="checkbox"]').count();
    if (rememberMe === 0) {
      bugs.push({ type: 'Missing Element', page: 'Login', message: 'Remember Me checkbox not found' });
      console.log('❌ Bug: Remember Me checkbox missing');
    } else {
      console.log('✅ Remember Me checkbox found');
    }
    
    // Login
    console.log('🔐 Logging in as superadmin...');
    await page.fill('input[type="email"]', 'superadmin@netneural.ai');
    await page.fill('input[type="password"]', 'SuperSecure123!');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check if redirected to dashboard
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      bugs.push({ type: 'Navigation Error', page: 'Login', message: `Did not redirect to dashboard. URL: ${currentUrl}` });
      console.log(`❌ Bug: Login did not redirect to dashboard (URL: ${currentUrl})`);
    } else {
      console.log('✅ Successfully logged in and redirected');
    }
    
    // ============================================
    // 2. DASHBOARD
    // ============================================
    console.log('\n📄 PAGE 2: DASHBOARD');
    console.log('-'.repeat(60));
    await page.goto('http://localhost:3004/dashboard/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Check for Alerts card (Bug #7)
    const alertsCard = await page.locator('text=Alert').or(page.locator('h2:has-text("Alerts")')).or(page.locator('h3:has-text("Alerts")')).count();
    if (alertsCard === 0) {
      bugs.push({ type: 'Missing Component', page: 'Dashboard', message: 'Bug #7: Alerts card not visible' });
      console.log('❌ Bug #7: Alerts card missing');
    } else {
      console.log('✅ Bug #7: Alerts card found');
    }
    
    // Check for Locations card (Bug #12)
    const locationsCard = await page.locator('text=Location').or(page.locator('h2:has-text("Locations")')).or(page.locator('h3:has-text("Locations")')).count();
    if (locationsCard === 0) {
      bugs.push({ type: 'Missing Component', page: 'Dashboard', message: 'Bug #12: Locations card not visible' });
      console.log('❌ Bug #12: Locations card missing');
    } else {
      console.log('✅ Bug #12: Locations card found');
    }
    
    // Check for stuck loading spinners
    const spinners = await page.locator('[role="status"]').or(page.locator('.animate-spin')).count();
    if (spinners > 0) {
      warnings.push({ page: 'Dashboard', message: `${spinners} loading spinners still visible` });
      console.log(`⚠️  ${spinners} loading spinner(s) found (might be stuck)`);
    }
    
    // Check for error messages
    const errorMessages = await page.locator('text=/error|failed|something went wrong/i').count();
    if (errorMessages > 0) {
      bugs.push({ type: 'Error Message', page: 'Dashboard', message: `${errorMessages} error messages displayed` });
      console.log(`❌ ${errorMessages} error message(s) on dashboard`);
    } else {
      console.log('✅ No error messages on dashboard');
    }
    
    await page.screenshot({ path: 'bug-report-dashboard.png', fullPage: true });
    console.log('📸 Screenshot saved: bug-report-dashboard.png');
    
    // ============================================
    // 3. SETTINGS - PROFILE TAB
    // ============================================
    console.log('\n📄 PAGE 3: SETTINGS - PROFILE TAB');
    console.log('-'.repeat(60));
    await page.goto('http://localhost:3004/dashboard/settings/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Click Profile tab
    const profileTab = await page.locator('text=Profile').first();
    if (await profileTab.isVisible()) {
      await profileTab.click();
      await page.waitForTimeout(1000);
      console.log('✅ Profile tab accessible');
      
      // Check for Save button (Bug #11)
      const saveButton = await page.locator('button:has-text("Save")').count();
      if (saveButton === 0) {
        bugs.push({ type: 'Missing Element', page: 'Settings/Profile', message: 'Bug #11: Save button not found' });
        console.log('❌ Bug #11: Save button missing');
      } else {
        console.log('✅ Bug #11: Save button found');
      }
      
      // Check notification toggles (Bug #8-10)
      const checkboxes = await page.locator('input[type="checkbox"]').count();
      console.log(`✅ Found ${checkboxes} checkbox(es) for notifications`);
      
    } else {
      bugs.push({ type: 'Missing Tab', page: 'Settings', message: 'Profile tab not visible' });
      console.log('❌ Profile tab not found');
    }
    
    await page.screenshot({ path: 'bug-report-settings-profile.png', fullPage: true });
    console.log('📸 Screenshot saved: bug-report-settings-profile.png');
    
    // ============================================
    // 4. SETTINGS - PREFERENCES TAB
    // ============================================
    console.log('\n📄 PAGE 4: SETTINGS - PREFERENCES TAB');
    console.log('-'.repeat(60));
    
    const preferencesTab = await page.locator('text=Preferences').first();
    if (await preferencesTab.isVisible()) {
      await preferencesTab.click();
      await page.waitForTimeout(1000);
      console.log('✅ Preferences tab accessible');
      
      // Check theme toggle (Bug #13)
      const themeToggle = await page.locator('text=/theme|dark mode/i').count();
      if (themeToggle > 0) {
        console.log('✅ Bug #13: Theme toggle found');
      } else {
        bugs.push({ type: 'Missing Element', page: 'Settings/Preferences', message: 'Bug #13: Theme toggle not found' });
        console.log('❌ Bug #13: Theme toggle missing');
      }
      
      // Check Save Preferences button (Bug #16)
      const savePrefButton = await page.locator('button:has-text("Save")').count();
      if (savePrefButton > 0) {
        console.log('✅ Bug #16: Save Preferences button found');
      } else {
        bugs.push({ type: 'Missing Element', page: 'Settings/Preferences', message: 'Bug #16: Save button not found' });
        console.log('❌ Bug #16: Save button missing');
      }
      
      // Check dropdowns (Bug #14, 15, 17)
      const selects = await page.locator('select').count();
      console.log(`✅ Found ${selects} dropdown(s) (Language, Timezone, Date Format)`);
      
    } else {
      bugs.push({ type: 'Missing Tab', page: 'Settings', message: 'Preferences tab not visible' });
      console.log('❌ Preferences tab not found');
    }
    
    await page.screenshot({ path: 'bug-report-settings-preferences.png', fullPage: true });
    console.log('📸 Screenshot saved: bug-report-settings-preferences.png');
    
    // ============================================
    // 5. SETTINGS - SECURITY TAB
    // ============================================
    console.log('\n📄 PAGE 5: SETTINGS - SECURITY TAB');
    console.log('-'.repeat(60));
    
    const securityTab = await page.locator('text=Security').first();
    if (await securityTab.isVisible()) {
      await securityTab.click();
      await page.waitForTimeout(1000);
      console.log('✅ Security tab accessible');
      
      // Check password change section (Bug #18)
      const passwordSection = await page.locator('text=/change password|current password/i').count();
      if (passwordSection > 0) {
        console.log('✅ Bug #18: Change Password section found');
      } else {
        bugs.push({ type: 'Missing Section', page: 'Settings/Security', message: 'Bug #18: Change Password section not found' });
        console.log('❌ Bug #18: Change Password section missing');
      }
      
      // Check 2FA section (Bug #19)
      const twoFASection = await page.locator('text=/two-factor|2fa/i').count();
      if (twoFASection > 0) {
        console.log('✅ Bug #19: 2FA section found');
      } else {
        bugs.push({ type: 'Missing Section', page: 'Settings/Security', message: 'Bug #19: 2FA section not found' });
        console.log('❌ Bug #19: 2FA section missing');
      }
      
      // Check active sessions (Bug #20)
      const sessionsSection = await page.locator('text=/active session|session/i').count();
      if (sessionsSection > 0) {
        console.log('✅ Bug #20: Active Sessions section found');
      } else {
        bugs.push({ type: 'Missing Section', page: 'Settings/Security', message: 'Bug #20: Active Sessions section not found' });
        console.log('❌ Bug #20: Active Sessions section missing');
      }
      
      // Check API keys (Bug #21)
      const apiKeysSection = await page.locator('text=/api key/i').count();
      if (apiKeysSection > 0) {
        console.log('✅ Bug #21: API Keys section found');
      } else {
        bugs.push({ type: 'Missing Section', page: 'Settings/Security', message: 'Bug #21: API Keys section not found' });
        console.log('❌ Bug #21: API Keys section missing');
      }
      
    } else {
      bugs.push({ type: 'Missing Tab', page: 'Settings', message: 'Security tab not visible' });
      console.log('❌ Security tab not found');
    }
    
    await page.screenshot({ path: 'bug-report-settings-security.png', fullPage: true });
    console.log('📸 Screenshot saved: bug-report-settings-security.png');
    
    // ============================================
    // 6. ORGANIZATIONS PAGE
    // ============================================
    console.log('\n📄 PAGE 6: ORGANIZATIONS');
    console.log('-'.repeat(60));
    await page.goto('http://localhost:3004/dashboard/organizations/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const orgHeading = await page.locator('h1, h2').first().textContent();
    console.log(`✅ Page loaded: "${orgHeading}"`);
    
    // Try to click first organization
    const firstOrg = await page.locator('a, button').filter({ hasText: /netneural|organization|view/i }).first();
    if (await firstOrg.isVisible().catch(() => false)) {
      await firstOrg.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      console.log('✅ Clicked into organization details');
      
      // Check all tabs
      const tabs = {
        '#1 Devices': await page.locator('text=Devices').count() > 0,
        '#2 Members': await page.locator('text=Members').count() > 0,
        '#3 Locations': await page.locator('text=Locations').count() > 0,
        '#4 Integrations': await page.locator('text=Integrations').count() > 0,
        '#5 Alerts': await page.locator('text=Alerts').count() > 0,
        '#6 Settings': await page.locator('text=Settings').count() > 0
      };
      
      for (const [tab, found] of Object.entries(tabs)) {
        if (found) {
          console.log(`✅ Bug ${tab} tab found`);
        } else {
          bugs.push({ type: 'Missing Tab', page: 'Organization Details', message: `Bug ${tab} tab not found` });
          console.log(`❌ Bug ${tab} tab missing`);
        }
      }
      
      // Check for Add Device button (Bug #1)
      await page.locator('text=Devices').first().click().catch(() => {});
      await page.waitForTimeout(1000);
      const addDeviceBtn = await page.locator('button:has-text("Add Device")').or(page.locator('button:has-text("Add")')).count();
      if (addDeviceBtn > 0) {
        console.log('✅ Bug #1: Add Device button found');
      } else {
        bugs.push({ type: 'Missing Button', page: 'Organization/Devices', message: 'Bug #1: Add Device button not found' });
        console.log('❌ Bug #1: Add Device button missing');
      }
      
    } else {
      console.log('⚠️  No organizations found to test details');
    }
    
    await page.screenshot({ path: 'bug-report-organizations.png', fullPage: true });
    console.log('📸 Screenshot saved: bug-report-organizations.png');
    
    // ============================================
    // 7. DEVICES PAGE
    // ============================================
    console.log('\n📄 PAGE 7: DEVICES');
    console.log('-'.repeat(60));
    await page.goto('http://localhost:3004/dashboard/devices/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const deviceHeading = await page.locator('h1, h2').first().textContent();
    console.log(`✅ Page loaded: "${deviceHeading}"`);
    
    await page.screenshot({ path: 'bug-report-devices.png', fullPage: true });
    console.log('📸 Screenshot saved: bug-report-devices.png');
    
    // ============================================
    // 8. ALERTS PAGE
    // ============================================
    console.log('\n📄 PAGE 8: ALERTS');
    console.log('-'.repeat(60));
    await page.goto('http://localhost:3004/dashboard/alerts/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    const alertHeading = await page.locator('h1, h2').first().textContent();
    console.log(`✅ Page loaded: "${alertHeading}"`);
    
    await page.screenshot({ path: 'bug-report-alerts.png', fullPage: true });
    console.log('📸 Screenshot saved: bug-report-alerts.png');
    
    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 BUG HUNT SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n🐛 Bugs Found: ${bugs.length}`);
    if (bugs.length > 0) {
      bugs.forEach((bug, i) => {
        console.log(`\n${i + 1}. [${bug.type}] ${bug.page}`);
        console.log(`   ${bug.message}`);
      });
    } else {
      console.log('   ✅ No bugs found! All features working correctly.');
    }
    
    console.log(`\n⚠️  Warnings: ${warnings.length}`);
    if (warnings.length > 0) {
      warnings.forEach((warning, i) => {
        console.log(`${i + 1}. ${warning.page}: ${warning.message}`);
      });
    }
    
    console.log(`\n❌ Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      const uniqueErrors = [...new Set(consoleErrors.map(e => e.message))];
      uniqueErrors.slice(0, 5).forEach((error, i) => {
        console.log(`${i + 1}. ${error}`);
      });
      if (uniqueErrors.length > 5) {
        console.log(`   ... and ${uniqueErrors.length - 5} more`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📸 Screenshots saved:');
    console.log('   - bug-report-dashboard.png');
    console.log('   - bug-report-settings-profile.png');
    console.log('   - bug-report-settings-preferences.png');
    console.log('   - bug-report-settings-security.png');
    console.log('   - bug-report-organizations.png');
    console.log('   - bug-report-devices.png');
    console.log('   - bug-report-alerts.png');
    console.log('='.repeat(60));
    
    console.log('\n✅ Bug hunt complete! Browser will stay open for 30 seconds...\n');
    
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('\n❌ Critical Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
