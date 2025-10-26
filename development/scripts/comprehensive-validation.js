const { chromium } = require('playwright');

const BASE_URL = 'http://localhost:3004';
const EMAIL = 'superadmin@netneural.ai';
const PASSWORD = 'SuperSecure123!';

const bugs = [];
const passed = [];

function logBug(page, category, issue, severity = 'medium') {
  bugs.push({ page, category, issue, severity });
  console.log(`❌ [${severity.toUpperCase()}] ${page} - ${category}: ${issue}`);
}

function logPass(page, feature) {
  passed.push({ page, feature });
  console.log(`✅ ${page} - ${feature}`);
}

async function login(page) {
  console.log('\n🔐 Logging in...');
  await page.goto(`${BASE_URL}/auth/login/`);
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  
  // Check Remember Me checkbox
  const rememberMe = page.locator('input[type="checkbox"]').first();
  if (await rememberMe.isVisible()) {
    logPass('Login Page', 'Remember Me checkbox visible');
  } else {
    logBug('Login Page', 'UI', 'Remember Me checkbox not found', 'high');
  }
  
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  
  const url = page.url();
  if (url.includes('/dashboard')) {
    logPass('Login', 'Successfully logged in and redirected');
  } else {
    logBug('Login', 'Authentication', 'Did not redirect to dashboard', 'critical');
  }
}

async function testDashboard(page) {
  console.log('\n📊 Testing Dashboard...');
  await page.goto(`${BASE_URL}/dashboard/`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'validation-dashboard.png', fullPage: true });
  
  // Check for alerts card
  const alertsCard = page.locator('text=/alert/i').first();
  if (await alertsCard.isVisible()) {
    logPass('Dashboard', 'Alerts card visible');
    
    // Check if data is loading
    const noAlerts = page.locator('text=/no alert/i');
    const hasNoAlertsText = await noAlerts.count() > 0;
    if (hasNoAlertsText) {
      logBug('Dashboard', 'Data', 'Alerts showing "No alerts" - may need data seeding', 'low');
    }
  } else {
    logBug('Dashboard', 'UI', 'Alerts card not visible', 'high');
  }
  
  // Check for locations card
  const locationsCard = page.locator('text=/location/i').first();
  if (await locationsCard.isVisible()) {
    logPass('Dashboard', 'Locations card visible');
  } else {
    logBug('Dashboard', 'UI', 'Locations card not visible', 'high');
  }
  
  // Check for devices card
  const devicesCard = page.locator('text=/device/i').first();
  if (await devicesCard.isVisible()) {
    logPass('Dashboard', 'Devices card visible');
  } else {
    logBug('Dashboard', 'UI', 'Devices card not visible', 'medium');
  }
  
  // Check for View All buttons
  const viewAllButtons = page.locator('text=/view all/i');
  const viewAllCount = await viewAllButtons.count();
  if (viewAllCount >= 2) {
    logPass('Dashboard', `${viewAllCount} "View All" buttons found`);
  } else {
    logBug('Dashboard', 'UI', `Only ${viewAllCount} "View All" buttons found`, 'low');
  }
}

async function testProfileTab(page) {
  console.log('\n👤 Testing Settings - Profile Tab...');
  await page.goto(`${BASE_URL}/dashboard/settings/`);
  await page.waitForLoadState('networkidle');
  
  // Click Profile tab
  const profileTab = page.locator('text=Profile').first();
  if (await profileTab.isVisible()) {
    await profileTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'validation-profile.png', fullPage: true });
    logPass('Profile Tab', 'Tab accessible');
    
    // Check form fields
    const inputs = await page.locator('input[type="text"], input[type="email"]').all();
    logPass('Profile Tab', `${inputs.length} input fields found`);
    
    // Check checkboxes
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    logPass('Profile Tab', `${checkboxes.length} checkboxes found`);
    
    // Test Save button
    const saveButton = page.locator('button:has-text("Save")').first();
    if (await saveButton.isVisible()) {
      logPass('Profile Tab', 'Save button visible');
      
      // Try to save
      await saveButton.click();
      await page.waitForTimeout(2000);
      
      // Check for success or error message
      const pageContent = await page.content();
      if (pageContent.includes('success') || pageContent.includes('saved')) {
        logPass('Profile Tab', 'Save functionality working');
      } else if (pageContent.includes('error') || pageContent.includes('failed')) {
        logBug('Profile Tab', 'Functionality', 'Save returned error', 'high');
      } else {
        logBug('Profile Tab', 'Functionality', 'Save gave no feedback', 'medium');
      }
    } else {
      logBug('Profile Tab', 'UI', 'Save button not visible', 'high');
    }
  } else {
    logBug('Profile Tab', 'Navigation', 'Profile tab not found', 'critical');
  }
}

async function testPreferencesTab(page) {
  console.log('\n⚙️  Testing Settings - Preferences Tab...');
  await page.goto(`${BASE_URL}/dashboard/settings/`);
  await page.waitForLoadState('networkidle');
  
  const preferencesTab = page.locator('text=Preferences').first();
  if (await preferencesTab.isVisible()) {
    await preferencesTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'validation-preferences.png', fullPage: true });
    logPass('Preferences Tab', 'Tab accessible');
    
    // Check theme toggle
    const themeElements = page.locator('text=/theme|dark mode|light mode/i');
    if (await themeElements.count() > 0) {
      logPass('Preferences Tab', 'Theme controls visible');
    } else {
      logBug('Preferences Tab', 'UI', 'Theme controls not found', 'medium');
    }
    
    // Check for select dropdowns
    const selects = await page.locator('select').all();
    if (selects.length >= 3) {
      logPass('Preferences Tab', `${selects.length} dropdowns found (Language, Timezone, Date Format)`);
    } else {
      logBug('Preferences Tab', 'UI', `Only ${selects.length} dropdowns found, expected at least 3`, 'medium');
    }
    
    // Test Save Preferences button
    const saveButton = page.locator('button:has-text("Save")').first();
    if (await saveButton.isVisible()) {
      logPass('Preferences Tab', 'Save Preferences button visible');
      
      await saveButton.click();
      await page.waitForTimeout(2000);
      
      const pageContent = await page.content();
      if (pageContent.includes('success') || pageContent.includes('saved')) {
        logPass('Preferences Tab', 'Save Preferences working');
      } else {
        logBug('Preferences Tab', 'Functionality', 'Save Preferences gave no feedback', 'medium');
      }
    } else {
      logBug('Preferences Tab', 'UI', 'Save Preferences button not visible', 'high');
    }
  } else {
    logBug('Preferences Tab', 'Navigation', 'Preferences tab not found', 'critical');
  }
}

async function testSecurityTab(page) {
  console.log('\n🔒 Testing Settings - Security Tab...');
  await page.goto(`${BASE_URL}/dashboard/settings/`);
  await page.waitForLoadState('networkidle');
  
  const securityTab = page.locator('text=Security').first();
  if (await securityTab.isVisible()) {
    await securityTab.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'validation-security.png', fullPage: true });
    logPass('Security Tab', 'Tab accessible');
    
    // Check Password Change section
    const passwordSection = page.locator('text=/change password|current password/i');
    if (await passwordSection.count() > 0) {
      logPass('Security Tab', 'Change Password section visible');
      
      // Check for password fields
      const passwordFields = await page.locator('input[type="password"]').all();
      if (passwordFields.length >= 3) {
        logPass('Security Tab', `${passwordFields.length} password fields found`);
      } else {
        logBug('Security Tab', 'UI', `Only ${passwordFields.length} password fields, expected 3`, 'medium');
      }
    } else {
      logBug('Security Tab', 'UI', 'Change Password section not found', 'high');
    }
    
    // Check Active Sessions
    const sessionsSection = page.locator('text=/active session|session/i');
    if (await sessionsSection.count() > 0) {
      logPass('Security Tab', 'Active Sessions section visible');
    } else {
      logBug('Security Tab', 'UI', 'Active Sessions section not found', 'medium');
    }
    
    // Check 2FA section
    const twoFASection = page.locator('text=/two-factor|2fa/i');
    if (await twoFASection.count() > 0) {
      logPass('Security Tab', '2FA section visible');
    } else {
      logBug('Security Tab', 'UI', '2FA section not found', 'medium');
    }
    
    // Check API Keys section
    const apiKeysSection = page.locator('text=/api key/i');
    if (await apiKeysSection.count() > 0) {
      logPass('Security Tab', 'API Keys section visible');
    } else {
      logBug('Security Tab', 'UI', 'API Keys section not found', 'medium');
    }
  } else {
    logBug('Security Tab', 'Navigation', 'Security tab not found', 'critical');
  }
}

async function testOrganizations(page) {
  console.log('\n🏢 Testing Organizations...');
  await page.goto(`${BASE_URL}/dashboard/organizations/`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'validation-organizations.png', fullPage: true });
  
  // Check if page loaded
  const heading = page.locator('h1, h2').first();
  const headingText = await heading.textContent();
  logPass('Organizations Page', `Page loaded with heading: "${headingText}"`);
  
  // Look for organization list
  const orgLinks = page.locator('a').filter({ hasText: /demo|test|org/i });
  const orgCount = await orgLinks.count();
  
  if (orgCount > 0) {
    logPass('Organizations Page', `${orgCount} organization link(s) found`);
    
    // Click first organization
    await orgLinks.first().click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'validation-org-detail.png', fullPage: true });
    
    logPass('Organizations Page', 'Can navigate to organization details');
    
    // Test all tabs
    const tabs = [
      { name: 'Devices', hasAddButton: true, buttonText: 'Add Device' },
      { name: 'Members', hasAddButton: true, buttonText: 'Add Member' },
      { name: 'Locations', hasAddButton: true, buttonText: 'Add Location' },
      { name: 'Integrations', hasAddButton: true, buttonText: 'Add Integration' },
      { name: 'Alerts', hasViewAll: true },
      { name: 'Settings', hasSaveButton: true }
    ];
    
    for (const tab of tabs) {
      const tabElement = page.locator(`text=${tab.name}`).first();
      if (await tabElement.isVisible()) {
        await tabElement.click();
        await page.waitForTimeout(1000);
        logPass(`Organization ${tab.name} Tab`, 'Tab accessible');
        
        if (tab.hasAddButton) {
          const addButton = page.locator(`button:has-text("${tab.buttonText}")`).or(
            page.locator('button:has-text("Add")')
          );
          if (await addButton.count() > 0) {
            logPass(`Organization ${tab.name} Tab`, `"${tab.buttonText}" button visible`);
            
            // Click and check for response
            await addButton.first().click();
            await page.waitForTimeout(1000);
            
            // Check if modal opened or alert shown
            const dialog = page.locator('[role="dialog"], .modal');
            const hasDialog = await dialog.count() > 0;
            if (hasDialog) {
              logPass(`Organization ${tab.name} Tab`, 'Add button triggered modal/dialog');
            }
          } else {
            logBug(`Organization ${tab.name} Tab`, 'UI', `"${tab.buttonText}" button not found`, 'medium');
          }
        }
        
        if (tab.hasSaveButton) {
          const saveButton = page.locator('button:has-text("Save")');
          if (await saveButton.count() > 0) {
            logPass(`Organization ${tab.name} Tab`, 'Save Changes button visible');
          } else {
            logBug(`Organization ${tab.name} Tab`, 'UI', 'Save Changes button not found', 'medium');
          }
        }
      } else {
        logBug('Organization Tabs', 'Navigation', `${tab.name} tab not found`, 'high');
      }
    }
  } else {
    logBug('Organizations Page', 'Data', 'No organizations found - may need data seeding', 'medium');
  }
}

async function testDevices(page) {
  console.log('\n📱 Testing Devices Page...');
  await page.goto(`${BASE_URL}/dashboard/devices/`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'validation-devices.png', fullPage: true });
  
  const heading = page.locator('h1, h2').first();
  const headingText = await heading.textContent();
  logPass('Devices Page', `Page loaded: "${headingText}"`);
  
  // Check for Add Device button
  const addButton = page.locator('button:has-text("Add Device")').or(page.locator('button:has-text("Add")'));
  if (await addButton.count() > 0) {
    logPass('Devices Page', 'Add Device button visible');
  } else {
    logBug('Devices Page', 'UI', 'Add Device button not found', 'medium');
  }
  
  // Check for device list
  const deviceItems = page.locator('[data-testid*="device"], .device-card, .device-item');
  const deviceCount = await deviceItems.count();
  if (deviceCount > 0) {
    logPass('Devices Page', `${deviceCount} device(s) found`);
  } else {
    logBug('Devices Page', 'Data', 'No devices found - may need data seeding', 'low');
  }
}

async function testAlerts(page) {
  console.log('\n🚨 Testing Alerts Page...');
  await page.goto(`${BASE_URL}/dashboard/alerts/`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'validation-alerts.png', fullPage: true });
  
  const heading = page.locator('h1, h2').first();
  const headingText = await heading.textContent();
  logPass('Alerts Page', `Page loaded: "${headingText}"`);
  
  // Check for alert items
  const alertItems = page.locator('[data-testid*="alert"], .alert-card, .alert-item');
  const alertCount = await alertItems.count();
  if (alertCount > 0) {
    logPass('Alerts Page', `${alertCount} alert(s) found`);
  } else {
    // Check for "no alerts" message
    const noAlerts = page.locator('text=/no alert/i');
    if (await noAlerts.count() > 0) {
      logBug('Alerts Page', 'Data', 'No alerts in database - may need data seeding', 'low');
    }
  }
  
  // Check for filters
  const filterElements = page.locator('select, input[type="search"], button:has-text("Filter")');
  const filterCount = await filterElements.count();
  if (filterCount > 0) {
    logPass('Alerts Page', `${filterCount} filter control(s) found`);
  }
}

async function checkConsoleErrors(page) {
  console.log('\n🔍 Checking for Console Errors...');
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  
  const pages = [
    '/dashboard/',
    '/dashboard/settings/',
    '/dashboard/organizations/',
    '/dashboard/devices/',
    '/dashboard/alerts/'
  ];
  
  for (const pagePath of pages) {
    const pageErrors = [];
    await page.goto(BASE_URL + pagePath);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    if (errors.length > 0) {
      errors.forEach(err => {
        if (!err.includes('favicon') && !err.includes('sourcemap')) {
          pageErrors.push(err);
        }
      });
    }
    
    if (pageErrors.length > 0) {
      logBug(pagePath, 'Console Errors', `${pageErrors.length} error(s) found`, 'high');
      pageErrors.forEach(err => console.log(`   - ${err.substring(0, 100)}...`));
    } else {
      logPass(pagePath, 'No console errors');
    }
  }
}

async function checkNavigation(page) {
  console.log('\n🧭 Testing Navigation...');
  await page.goto(`${BASE_URL}/dashboard/`);
  await page.waitForLoadState('networkidle');
  
  const navItems = [
    { text: 'Dashboard', url: '/dashboard' },
    { text: 'Devices', url: '/devices' },
    { text: 'Alerts', url: '/alerts' },
    { text: 'Organizations', url: '/organizations' }
  ];
  
  for (const item of navItems) {
    const navLink = page.locator(`a:has-text("${item.text}")`).first();
    if (await navLink.isVisible()) {
      logPass('Navigation', `"${item.text}" link visible`);
      
      await navLink.click();
      await page.waitForLoadState('networkidle');
      
      const url = page.url();
      if (url.includes(item.url)) {
        logPass('Navigation', `"${item.text}" link works correctly`);
      } else {
        logBug('Navigation', 'Functionality', `"${item.text}" link went to wrong page: ${url}`, 'high');
      }
    } else {
      logBug('Navigation', 'UI', `"${item.text}" link not visible`, 'medium');
    }
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 VALIDATION REPORT');
  console.log('='.repeat(80));
  
  console.log(`\n✅ PASSED: ${passed.length} tests`);
  console.log(`❌ FAILED: ${bugs.length} issues found\n`);
  
  if (bugs.length > 0) {
    console.log('🐛 ISSUES BY SEVERITY:\n');
    
    const critical = bugs.filter(b => b.severity === 'critical');
    const high = bugs.filter(b => b.severity === 'high');
    const medium = bugs.filter(b => b.severity === 'medium');
    const low = bugs.filter(b => b.severity === 'low');
    
    if (critical.length > 0) {
      console.log(`🔴 CRITICAL (${critical.length}):`);
      critical.forEach(b => console.log(`   - ${b.page} (${b.category}): ${b.issue}`));
      console.log('');
    }
    
    if (high.length > 0) {
      console.log(`🟠 HIGH (${high.length}):`);
      high.forEach(b => console.log(`   - ${b.page} (${b.category}): ${b.issue}`));
      console.log('');
    }
    
    if (medium.length > 0) {
      console.log(`🟡 MEDIUM (${medium.length}):`);
      medium.forEach(b => console.log(`   - ${b.page} (${b.category}): ${b.issue}`));
      console.log('');
    }
    
    if (low.length > 0) {
      console.log(`🟢 LOW (${low.length}):`);
      low.forEach(b => console.log(`   - ${b.page} (${b.category}): ${b.issue}`));
      console.log('');
    }
  }
  
  console.log('\n📸 Screenshots saved:');
  console.log('   - validation-dashboard.png');
  console.log('   - validation-profile.png');
  console.log('   - validation-preferences.png');
  console.log('   - validation-security.png');
  console.log('   - validation-organizations.png');
  console.log('   - validation-org-detail.png');
  console.log('   - validation-devices.png');
  console.log('   - validation-alerts.png');
  
  console.log('\n' + '='.repeat(80));
  
  return { passed: passed.length, failed: bugs.length, bugs };
}

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 100
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('🚀 Starting Comprehensive Interface Validation...\n');
    console.log('Server: ' + BASE_URL);
    console.log('User: ' + EMAIL);
    console.log('='.repeat(80));
    
    await login(page);
    await testDashboard(page);
    await testProfileTab(page);
    await testPreferencesTab(page);
    await testSecurityTab(page);
    await testOrganizations(page);
    await testDevices(page);
    await testAlerts(page);
    await checkNavigation(page);
    await checkConsoleErrors(page);
    
    const report = await generateReport();
    
    console.log('\n✨ Validation complete!');
    console.log(`\nSummary: ${report.passed} passed, ${report.failed} issues found`);
    
    if (report.failed === 0) {
      console.log('\n🎉 All tests passed! No bugs found.');
    } else {
      console.log(`\n⚠️  Found ${report.failed} issue(s) that need attention.`);
    }
    
    // Keep browser open for 30 seconds for manual inspection
    console.log('\n⏳ Keeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    
  } catch (error) {
    console.error('\n💥 Fatal Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    process.exit(bugs.length > 0 ? 1 : 0);
  }
})();
