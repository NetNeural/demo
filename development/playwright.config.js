const { defineConfig } = require('@playwright/test')

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: '.',
  /* Match tests in e2e/, tests/playwright/, and root-level spec files */
  testMatch: [
    'e2e/**/*.spec.ts',
    'tests/playwright/**/*.spec.ts',
    'test-app.spec.ts',
  ],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Generous timeout for remote testing with MFA login */
  timeout: 120000,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI or remote testing — transient profile_load_failed can cause flakes */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://sentinel.netneural.ai'
        : 'http://localhost:3000'),

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Navigation and action timeouts for remote sites */
    navigationTimeout: 30000,
    actionTimeout: 15000,

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
        // Use real Chrome for better testing
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

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...require('@playwright/test').devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...require('@playwright/test').devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: {
        ...require('@playwright/test').devices['Desktop Edge'],
        channel: 'msedge',
      },
    },
    {
      name: 'Google Chrome',
      use: {
        ...require('@playwright/test').devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],

  /* Run your local dev server before starting the tests.
   * Skipped when PLAYWRIGHT_BASE_URL is set (remote testing against dev/staging/prod). */
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },

  /* Global test timeout — 60s for remote testing (MFA + auth flows) */
  timeout: 60000,

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Output directory for test artifacts */
  outputDir: 'test-results/',

  /* Global setup and teardown */
  globalSetup: require.resolve('./tests/global-setup'),
  globalTeardown: require.resolve('./tests/global-teardown'),

  /* Test match patterns are defined at the top of this config */
})
