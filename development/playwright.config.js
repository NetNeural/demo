const { defineConfig } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests/playwright',
  /* Also include e2e tests */
  testMatch: ['**/tests/playwright/**/*.spec.ts', '**/e2e/**/*.spec.ts'],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.NODE_ENV === 'production' 
      ? 'https://netneural.github.io/SoftwareMono' 
      : 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
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
        channel: 'chrome'
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
        channel: 'msedge' 
      },
    },
    {
      name: 'Google Chrome',
      use: { 
        ...require('@playwright/test').devices['Desktop Chrome'], 
        channel: 'chrome' 
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  
  /* Global test timeout */
  timeout: 30000,
  
  /* Expect timeout */
  expect: {
    timeout: 5000,
  },
  
  /* Output directory for test artifacts */
  outputDir: 'test-results/',
  
  /* Global setup and teardown */
  globalSetup: require.resolve('./tests/global-setup'),
  globalTeardown: require.resolve('./tests/global-teardown'),
  
  /* Test match patterns */
  testMatch: [
    '**/__tests__/**/*.{test,spec}.ts',
    '**/tests/**/*.{test,spec}.ts',
    '**/*.{test,spec}.ts'
  ],
});