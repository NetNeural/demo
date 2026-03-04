/**
 * Playwright config for running E2E tests against the live staging environment.
 *
 * Usage:
 *   $env:SUPABASE_URL = "https://atgbmxicqikmapfqouco.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<staging-service-role-key>"
 *   npx playwright test --config=playwright.staging.config.js e2e/critical-flows.spec.ts --project=chromium
 */
const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: '.',
  testMatch: [
    'e2e/**/*.spec.ts',
    'tests/playwright/**/*.spec.ts',
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://demo-stage.netneural.ai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
    {
      name: 'firefox',
      use: { ...require('@playwright/test').devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...require('@playwright/test').devices['Desktop Safari'] },
    },
  ],

  // NO webServer — testing against the live staging site
  // NO globalSetup — test user already exists on staging

  globalSetup: require.resolve('./tests/global-setup'),
  globalTeardown: require.resolve('./tests/global-teardown'),

  timeout: 60000,
  expect: { timeout: 10000 },
  outputDir: 'test-results/',
})
