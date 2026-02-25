# E2E Testing Guide

## Overview

This document provides comprehensive guidance for running and maintaining end-to-end (E2E) tests for the NetNeural IoT Platform using Playwright.

## Table of Contents

- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Test User Setup](#test-user-setup)
- [Writing Tests](#writing-tests)
- [Test Workflows](#test-workflows)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Test Structure

E2E tests are organized in the `e2e/` directory with the following structure:

```
e2e/
├── auth.spec.ts          # Authentication flows (login/logout/session)
├── devices.spec.ts       # Device management (listing/filtering/sync/telemetry)
├── alerts.spec.ts        # Alert management (acknowledgment/thresholds/notifications)
└── reporting.spec.ts     # Report generation and export (coming soon)
```

Additional tests in `tests/playwright/` include:

- Production validation tests
- Bug hunting and validation tests
- Golioth integration tests

---

## Running Tests

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test e2e/auth.spec.ts
npx playwright test e2e/devices.spec.ts
npx playwright test e2e/alerts.spec.ts
```

### Run in UI Mode (Interactive)

```bash
npm run test:e2e:ui
```

This opens Playwright's interactive UI where you can:

- Run tests step-by-step
- See live browser actions
- Debug failures visually
- Inspect DOM and network activity

### Run Tests in Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

### Run Tests with Debugging

```bash
npx playwright test --debug
```

Opens Playwright Inspector for step-by-step debugging.

### Run Tests in Headed Mode

```bash
npx playwright test --headed
```

Shows browser window during test execution (useful for debugging).

---

## Test User Setup

E2E tests require pre-configured test users in your local Supabase instance.

### Required Test Users

1. **Regular User**
   - Email: `test@netneural.ai`
   - Password: `TestPassword123!`
   - Role: Regular user
   - Organization: Test Org

2. **Admin User**
   - Email: `admin@netneural.ai`
   - Password: `AdminPassword123!`
   - Role: Administrator
   - Organization: Test Org

### Seeding Test Users

Create test users via Supabase SQL:

```sql
-- Insert test organization
INSERT INTO organizations (id, name, created_at)
VALUES ('test-org-123', 'Test Organization', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test user (regular)
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
VALUES (
  'test-user-123',
  'test@netneural.ai',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Add user to organization
INSERT INTO organization_members (
  organization_id,
  user_id,
  role,
  created_at
)
VALUES (
  'test-org-123',
  'test-user-123',
  'member',
  NOW()
)
ON CONFLICT DO NOTHING;

-- Create admin user
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
VALUES (
  'admin-user-123',
  'admin@netneural.ai',
  crypt('AdminPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Add admin to organization
INSERT INTO organization_members (
  organization_id,
  user_id,
  role,
  created_at
)
VALUES (
  'test-org-123',
  'admin-user-123',
  'admin',
  NOW()
)
ON CONFLICT DO NOTHING;
```

### Seed Test Devices (Optional)

```sql
-- Insert test device
INSERT INTO devices (
  id,
  organization_id,
  name,
  device_type,
  model,
  online_status,
  battery_percent,
  created_at
)
VALUES (
  'test-device-123',
  'test-org-123',
  'Test Sensor 1',
  'sensor',
  'NetNeural Sensor V1',
  'online',
  85,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Insert test telemetry data
INSERT INTO device_telemetry_history (
  device_id,
  temperature_f,
  humidity,
  battery_percent,
  created_at
)
VALUES (
  'test-device-123',
  72.5,
  45.2,
  85,
  NOW()
);
```

---

## Writing Tests

### Test File Template

```typescript
import { test, expect, Page } from '@playwright/test'

// Test user credentials
const TEST_USER = {
  email: 'test@netneural.ai',
  password: 'TestPassword123!',
}

/**
 * Helper: Login and navigate
 */
async function setupPage(page: Page) {
  await page.goto('/auth/login')
  await page.waitForLoadState('networkidle')

  // Perform login
  await page.locator('input[type="email"]').fill(TEST_USER.email)
  await page.locator('input[type="password"]').fill(TEST_USER.password)
  await page.locator('button[type="submit"]').click()
  await page.waitForLoadState('networkidle')
}

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page)
  })

  test('should do something', async ({ page }) => {
    // Your test here
    await expect(page.locator('text=Expected Text')).toBeVisible()
  })
})
```

### Best Practices

#### 1. Use Data Test IDs

Prefer `data-testid` attributes for reliable selectors:

```typescript
// Good
await page.locator('[data-testid="device-card"]').click()

// Avoid
await page.locator('.card-container .device-item').click()
```

#### 2. Wait for Network Idle

Always wait for page loads:

```typescript
await page.waitForLoadState('networkidle')
```

#### 3. Use Flexible Selectors

Combine multiple selector strategies:

```typescript
const button = page
  .locator('[data-testid="submit"]')
  .or(page.locator('button:has-text("Submit")'))
```

#### 4. Handle Optional Elements

Check visibility before action:

```typescript
if (await element.isVisible({ timeout: 5000 })) {
  await element.click()
}
```

#### 5. Use Helper Functions

Extract common patterns:

```typescript
async function performLogin(page: Page, email: string, password: string) {
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button[type="submit"]').click()
}
```

---

## Test Workflows

### Authentication Flow Tests (`auth.spec.ts`)

- ✅ User login/logout
- ✅ Session persistence
- ✅ Protected route redirection
- ✅ Remember Me functionality
- ✅ Password reset flow
- ✅ Multi-tenant isolation

### Device Management Tests (`devices.spec.ts`)

- ✅ Device listing and pagination
- ✅ Type/status filtering
- ✅ Search and sorting
- ✅ Temperature unit toggle (°F ↔ °C)
- ✅ Device sync (Golioth integration)
- ✅ Telemetry viewing
- ✅ CSV export
- ✅ Error handling

### Alert Management Tests (`alerts.spec.ts`)

- ✅ Alert listing with severity indicators
- ✅ Tab filtering (all/unacknowledged/connectivity/security/environmental)
- ✅ Severity and category filters
- ✅ View modes (cards/table)
- ✅ Alert details dialog
- ✅ Single and bulk acknowledgment
- ✅ Acknowledgment types (acknowledged/dismissed/resolved/false-positive)
- ✅ Notes and user tracking
- ✅ Grouped alerts
- ✅ Real-time updates (WebSocket)

### Reporting Tests (`reporting.spec.ts`) - Coming Soon

- ⏳ Report generation
- ⏳ CSV/PDF export
- ⏳ Filter and date range selection
- ⏳ Report scheduling

---

## Configuration

### Playwright Config (`playwright.config.js`)

```javascript
module.exports = defineConfig({
  testDir: './tests/playwright',
  testMatch: ['**/tests/playwright/**/*.spec.ts', '**/e2e/**/*.spec.ts'],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
})
```

### Environment Variables

E2E tests use the following environment:

- **Base URL**: `http://localhost:3000` (local dev server)
- **Supabase**: Local Supabase Docker instance
- **Test Users**: Seeded in local database

---

## Troubleshooting

### Tests Fail with "element not visible"

**Solution**: Increase timeout or wait for network idle:

```typescript
await page.locator('element').waitFor({ state: 'visible', timeout: 10000 })
await page.waitForLoadState('networkidle')
```

### Login Fails

**Solution**: Verify test users are seeded:

```bash
cd development
npm run supabase:db:reset  # Reset and reseed database
```

### Webserver Won't Start

**Solution**: Kill existing processes:

```bash
pkill -f "next dev"
pkill -f "supabase"
npm run dev  # Restart manually
```

### Tests Hang or Timeout

**Solution**:1. Check local Supabase is running: `npm run supabase:status` 2. Verify dev server is running: `curl http://localhost:3000` 3. Increase global timeout in `playwright.config.js`

### Screenshot/Video Not Captured

**Solution**: Tests only capture on failure. Force capture:

```typescript
await page.screenshot({ path: 'debug.png' })
```

---

## CI/CD Integration

### GitHub Actions

E2E tests run automatically on pull requests via `.github/workflows/test.yml`:

```yaml
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    CI: true
```

Tests run against:

- Local Supabase Docker instance
- Seeded test data
- Headless Chrome

---

## Coverage and Reporting

### View Test Results

After running tests, view HTML report:

```bash
npx playwright show-report
```

### Test Results Location

- **HTML Report**: `playwright-report/index.html`
- **JSON Results**: `test-results/results.json`
- **Screenshots**: `test-results/`
- **Videos**: `test-results/`

---

## Next Steps

1. ✅ Setup test user accounts in local Supabase
2. ✅ Run `npm run test:e2e` to verify tests pass
3. ✅ Add data-testid attributes to components for reliable selectors
4. ⏳ Complete reporting tests once reporting interface is finished
5. ⏳ Add performance testing (Story 2.5)
6. ⏳ Configure CI/CD quality gates (Story 2.6)

---

## Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [TESTING.md](./TESTING.md) - Unit testing guide
- [EXECUTIVE_MVP_ASSESSMENT.md](../EXECUTIVE_MVP_ASSESSMENT.md) - MVP progress tracking

---

**Last Updated**: February 17, 2026  
**Status**: E2E testing infrastructure complete (Story 2.4)  
**Coverage**: Authentication, Devices, Alerts (Reporting pending)
