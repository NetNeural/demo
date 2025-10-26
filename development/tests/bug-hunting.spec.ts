import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:3004';
const TEST_EMAIL = 'superadmin@netneural.ai';
const TEST_PASSWORD = 'SuperSecure123!';

test.describe('Bug Hunting - Comprehensive Page Traversal', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto(`${BASE_URL}/auth/login`);
    await page.waitForLoadState('networkidle');
    
    const emailInput = page.locator('input[type="email"]').first();
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_EMAIL);
      await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForLoadState('networkidle');
    }
  });

  test('1. Login Page - Check for UI issues', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== LOGIN PAGE INSPECTION ===');
    
    // Check Remember Me checkbox
    const rememberMe = page.locator('input[type="checkbox"]');
    const rememberMeVisible = await rememberMe.count() > 0;
    console.log(`✓ Remember Me checkbox: ${rememberMeVisible ? 'FOUND' : '❌ MISSING'}`);
    
    // Check for any console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    if (errors.length > 0) {
      console.log('❌ Console Errors:', errors);
    } else {
      console.log('✓ No console errors');
    }
  });

  test('2. Dashboard - Check all widgets and data', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== DASHBOARD INSPECTION ===');
    
    // Check for Alerts card
    const alertsCard = page.locator('text=Alert').or(page.locator('[data-testid="alerts-card"]'));
    const alertsVisible = await alertsCard.count() > 0;
    console.log(`${alertsVisible ? '✓' : '❌'} Alerts Card: ${alertsVisible ? 'VISIBLE' : 'MISSING'}`);
    
    // Check for Locations card
    const locationsCard = page.locator('text=Location');
    const locationsVisible = await locationsCard.count() > 0;
    console.log(`${locationsVisible ? '✓' : '❌'} Locations Card: ${locationsVisible ? 'VISIBLE' : 'MISSING'}`);
    
    // Check for Devices card
    const devicesCard = page.locator('text=Device');
    const devicesVisible = await devicesCard.count() > 0;
    console.log(`${devicesVisible ? '✓' : '❌'} Devices Card: ${devicesVisible ? 'VISIBLE' : 'MISSING'}`);
    
    // Check for loading spinners that shouldn't be there
    const spinners = page.locator('[role="status"]').or(page.locator('.spinner, .loading'));
    const spinnerCount = await spinners.count();
    if (spinnerCount > 0) {
      console.log(`⚠️  Found ${spinnerCount} loading spinners (might be stuck)`);
    }
    
    // Check for error messages
    const errors = page.locator('text=/error|failed|something went wrong/i');
    const errorCount = await errors.count();
    if (errorCount > 0) {
      console.log(`❌ Found ${errorCount} error messages on page`);
      for (let i = 0; i < Math.min(errorCount, 3); i++) {
        const errorText = await errors.nth(i).textContent();
        console.log(`   - ${errorText}`);
      }
    } else {
      console.log('✓ No error messages on page');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-check.png', fullPage: true });
    console.log('📸 Screenshot saved: test-results/dashboard-check.png');
  });

  test('3. Settings - Profile Tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== SETTINGS - PROFILE TAB ===');
    
    // Check Profile tab is visible
    const profileTab = page.locator('text=Profile').first();
    const profileVisible = await profileTab.isVisible();
    console.log(`${profileVisible ? '✓' : '❌'} Profile Tab: ${profileVisible ? 'VISIBLE' : 'MISSING'}`);
    
    if (profileVisible) {
      await profileTab.click();
      await page.waitForTimeout(500);
      
      // Check form fields
      const fullName = page.locator('input[type="text"]').first();
      const fullNameVisible = await fullName.isVisible();
      console.log(`${fullNameVisible ? '✓' : '❌'} Full Name field: ${fullNameVisible ? 'VISIBLE' : 'MISSING'}`);
      
      // Check save button
      const saveButton = page.locator('button:has-text("Save")');
      const saveVisible = await saveButton.count() > 0;
      console.log(`${saveVisible ? '✓' : '❌'} Save button: ${saveVisible ? 'VISIBLE' : 'MISSING'}`);
      
      // Check notification toggles
      const toggles = page.locator('input[type="checkbox"]');
      const toggleCount = await toggles.count();
      console.log(`✓ Found ${toggleCount} checkboxes/toggles`);
    }
    
    await page.screenshot({ path: 'test-results/settings-profile.png', fullPage: true });
    console.log('📸 Screenshot saved: test-results/settings-profile.png');
  });

  test('4. Settings - Preferences Tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== SETTINGS - PREFERENCES TAB ===');
    
    const preferencesTab = page.locator('text=Preferences').first();
    const preferencesVisible = await preferencesTab.isVisible();
    console.log(`${preferencesVisible ? '✓' : '❌'} Preferences Tab: ${preferencesVisible ? 'VISIBLE' : 'MISSING'}`);
    
    if (preferencesVisible) {
      await preferencesTab.click();
      await page.waitForTimeout(500);
      
      // Check theme toggle
      const themeToggle = page.locator('text=Theme').or(page.locator('text=Dark Mode'));
      const themeVisible = await themeToggle.count() > 0;
      console.log(`${themeVisible ? '✓' : '❌'} Theme toggle: ${themeVisible ? 'VISIBLE' : 'MISSING'}`);
      
      // Check save button
      const saveButton = page.locator('button:has-text("Save")');
      const saveVisible = await saveButton.count() > 0;
      console.log(`${saveVisible ? '✓' : '❌'} Save Preferences button: ${saveVisible ? 'VISIBLE' : 'MISSING'}`);
      
      // Check dropdowns
      const selects = page.locator('select');
      const selectCount = await selects.count();
      console.log(`✓ Found ${selectCount} dropdown selects`);
    }
    
    await page.screenshot({ path: 'test-results/settings-preferences.png', fullPage: true });
    console.log('📸 Screenshot saved: test-results/settings-preferences.png');
  });

  test('5. Settings - Security Tab', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== SETTINGS - SECURITY TAB ===');
    
    const securityTab = page.locator('text=Security').first();
    const securityVisible = await securityTab.isVisible();
    console.log(`${securityVisible ? '✓' : '❌'} Security Tab: ${securityVisible ? 'VISIBLE' : 'MISSING'}`);
    
    if (securityVisible) {
      await securityTab.click();
      await page.waitForTimeout(500);
      
      // Check password change section
      const passwordSection = page.locator('text=/change password|current password/i');
      const passwordVisible = await passwordSection.count() > 0;
      console.log(`${passwordVisible ? '✓' : '❌'} Password Change section: ${passwordVisible ? 'VISIBLE' : 'MISSING'}`);
      
      // Check 2FA section
      const twoFASection = page.locator('text=/two-factor|2fa/i');
      const twoFAVisible = await twoFASection.count() > 0;
      console.log(`${twoFAVisible ? '✓' : '❌'} 2FA section: ${twoFAVisible ? 'VISIBLE' : 'MISSING'}`);
      
      // Check active sessions
      const sessionsSection = page.locator('text=/active session|session/i');
      const sessionsVisible = await sessionsSection.count() > 0;
      console.log(`${sessionsVisible ? '✓' : '❌'} Active Sessions section: ${sessionsVisible ? 'VISIBLE' : 'MISSING'}`);
      
      // Check API keys
      const apiKeysSection = page.locator('text=/api key/i');
      const apiKeysVisible = await apiKeysSection.count() > 0;
      console.log(`${apiKeysVisible ? '✓' : '❌'} API Keys section: ${apiKeysVisible ? 'VISIBLE' : 'MISSING'}`);
    }
    
    await page.screenshot({ path: 'test-results/settings-security.png', fullPage: true });
    console.log('📸 Screenshot saved: test-results/settings-security.png');
  });

  test('6. Organizations Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/organizations`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== ORGANIZATIONS PAGE ===');
    
    // Check if page loaded
    const heading = page.locator('h1, h2').first();
    const headingText = await heading.textContent();
    console.log(`✓ Page heading: "${headingText}"`);
    
    // Check for organization cards/list
    const orgCards = page.locator('[data-testid="org-card"]').or(page.locator('text=/organization/i'));
    const orgCount = await orgCards.count();
    console.log(`✓ Found ${orgCount} organization references`);
    
    // Check for Add Organization button
    const addButton = page.locator('button:has-text("Add")').or(page.locator('button:has-text("Create")'));
    const addButtonVisible = await addButton.count() > 0;
    console.log(`${addButtonVisible ? '✓' : '❌'} Add/Create button: ${addButtonVisible ? 'VISIBLE' : 'MISSING'}`);
    
    await page.screenshot({ path: 'test-results/organizations.png', fullPage: true });
    console.log('📸 Screenshot saved: test-results/organizations.png');
  });

  test('7. Organization Detail Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/organizations`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== ORGANIZATION DETAIL PAGE ===');
    
    // Click first organization
    const firstOrg = page.locator('a, button').filter({ hasText: /organization|view|details/i }).first();
    const orgVisible = await firstOrg.isVisible().catch(() => false);
    
    if (orgVisible) {
      await firstOrg.click();
      await page.waitForLoadState('networkidle');
      
      // Check tabs
      const tabs = ['Devices', 'Members', 'Locations', 'Integrations', 'Alerts', 'Settings'];
      for (const tab of tabs) {
        const tabElement = page.locator(`text=${tab}`).first();
        const tabVisible = await tabElement.isVisible().catch(() => false);
        console.log(`${tabVisible ? '✓' : '❌'} ${tab} tab: ${tabVisible ? 'VISIBLE' : 'MISSING'}`);
      }
      
      await page.screenshot({ path: 'test-results/organization-detail.png', fullPage: true });
      console.log('📸 Screenshot saved: test-results/organization-detail.png');
    } else {
      console.log('⚠️  No organizations found to inspect detail page');
    }
  });

  test('8. Devices Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/devices`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== DEVICES PAGE ===');
    
    const heading = page.locator('h1, h2').first();
    const headingText = await heading.textContent();
    console.log(`✓ Page heading: "${headingText}"`);
    
    // Check for device list/grid
    const deviceItems = page.locator('[data-testid="device-item"]').or(page.locator('text=/device/i'));
    const deviceCount = await deviceItems.count();
    console.log(`✓ Found ${deviceCount} device references`);
    
    // Check for Add Device button
    const addButton = page.locator('button:has-text("Add Device")').or(page.locator('button:has-text("Add")'));
    const addButtonVisible = await addButton.count() > 0;
    console.log(`${addButtonVisible ? '✓' : '❌'} Add Device button: ${addButtonVisible ? 'VISIBLE' : 'MISSING'}`);
    
    await page.screenshot({ path: 'test-results/devices.png', fullPage: true });
    console.log('📸 Screenshot saved: test-results/devices.png');
  });

  test('9. Alerts Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/alerts`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== ALERTS PAGE ===');
    
    const heading = page.locator('h1, h2').first();
    const headingText = await heading.textContent();
    console.log(`✓ Page heading: "${headingText}"`);
    
    // Check for alert list
    const alertItems = page.locator('[data-testid="alert-item"]').or(page.locator('text=/alert|critical|warning/i'));
    const alertCount = await alertItems.count();
    console.log(`✓ Found ${alertCount} alert references`);
    
    // Check for filters
    const filters = page.locator('select, input[type="search"]');
    const filterCount = await filters.count();
    console.log(`✓ Found ${filterCount} filter/search controls`);
    
    await page.screenshot({ path: 'test-results/alerts.png', fullPage: true });
    console.log('📸 Screenshot saved: test-results/alerts.png');
  });

  test('10. Check for broken links and navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== NAVIGATION & LINKS CHECK ===');
    
    const links = await page.locator('a[href]').all();
    console.log(`✓ Found ${links.length} links on dashboard`);
    
    // Check for broken internal links
    const brokenLinks: string[] = [];
    for (let i = 0; i < Math.min(links.length, 20); i++) {
      const href = await links[i].getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        const response = await page.request.get(BASE_URL + href).catch(() => null);
        if (response && response.status() >= 400) {
          brokenLinks.push(href);
        }
      }
    }
    
    if (brokenLinks.length > 0) {
      console.log(`❌ Found ${brokenLinks.length} broken links:`);
      brokenLinks.forEach(link => console.log(`   - ${link}`));
    } else {
      console.log('✓ No broken links found (checked first 20)');
    }
  });

  test('11. Check for console errors across pages', async ({ page }) => {
    console.log('\n=== CONSOLE ERRORS CHECK ===');
    
    const errors: { page: string, errors: string[] }[] = [];
    
    const pages = [
      '/dashboard',
      '/dashboard/devices',
      '/dashboard/alerts',
      '/dashboard/organizations',
      '/dashboard/settings'
    ];
    
    for (const pagePath of pages) {
      const pageErrors: string[] = [];
      
      page.on('console', msg => {
        if (msg.type() === 'error') {
          pageErrors.push(msg.text());
        }
      });
      
      page.on('pageerror', error => {
        pageErrors.push(error.message);
      });
      
      await page.goto(BASE_URL + pagePath);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      if (pageErrors.length > 0) {
        errors.push({ page: pagePath, errors: pageErrors });
      }
    }
    
    if (errors.length > 0) {
      console.log(`❌ Found console errors on ${errors.length} pages:`);
      errors.forEach(({ page, errors }) => {
        console.log(`\n  Page: ${page}`);
        errors.forEach(error => console.log(`    - ${error}`));
      });
    } else {
      console.log('✓ No console errors found across all pages');
    }
  });

  test('12. Check for accessibility issues', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
    
    console.log('\n=== ACCESSIBILITY CHECK ===');
    
    // Check for missing alt text
    const images = await page.locator('img').all();
    let missingAlt = 0;
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      if (!alt || alt.trim() === '') {
        missingAlt++;
      }
    }
    if (missingAlt > 0) {
      console.log(`⚠️  ${missingAlt} images missing alt text`);
    } else {
      console.log('✓ All images have alt text');
    }
    
    // Check for form labels
    const inputs = await page.locator('input').all();
    let missingLabels = 0;
    for (const input of inputs) {
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const placeholder = await input.getAttribute('placeholder');
      
      if (!id && !ariaLabel && !placeholder) {
        missingLabels++;
      }
    }
    if (missingLabels > 0) {
      console.log(`⚠️  ${missingLabels} inputs missing labels/aria-label`);
    } else {
      console.log('✓ All inputs have proper labels');
    }
    
    // Check for heading hierarchy
    const h1s = await page.locator('h1').count();
    console.log(`✓ Found ${h1s} H1 heading(s) ${h1s !== 1 ? '(should typically be 1)' : ''}`);
  });
});
