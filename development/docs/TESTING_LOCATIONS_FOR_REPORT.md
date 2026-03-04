# Testing Locations for Software Assessment Report

This quick reference documents where tests are located so assessment reports can cite them consistently.

## Test Locations (5 areas)

### 1. `development/__tests__/` — Unit & Component Tests (74 files)

- Jest-based unit, component, hooks, API client, bug-fix regression, and service-layer tests
- Subdirectories: `alerts/`, `analytics/`, `api/`, `app/`, `auth/`, `bugfixes/`, `components/`, `configuration/`, `critical-issues/`, `devices/`, `edge-functions/`, `github-issues/`, `hooks/`, `integrations/`, `lib/`, `organizations/`, `pages/`, `services/`, `utils/`
- Also includes 2 test files under `development/src/lib/sync/__tests__/`

### 2. `development/tests/` — Integration & Playwright (22 files)

- `tests/integration/` — 17 files (2 formal `.test.ts` + 15 test-\*.mjs integration scripts)
- `tests/playwright/` — 5 Playwright spec files (bug-hunting, production-validation, golioth, superadmin, screenshots)
- `tests/fixtures/` — 12 SQL fixture/seed files for test data
- `tests/output/` — Test output capture

### 3. `development/e2e/` — E2E Browser Tests (4 files)

- Playwright specs: `alerts.spec.ts`, `auth.spec.ts`, `devices.spec.ts`, `device-detail.spec.ts`

### 4. `development/supabase/functions/` — Edge Function Tests (4 files)

- `ai-insights/ai-insights.test.ts`
- `send-alert-email/send-alert-email.test.ts`
- `sensor-threshold-evaluator/sensor-threshold-evaluator.test.ts`
- `user-actions/user-actions.test.ts`

### 5. Test Scripts — `development/scripts/` + `scripts/` + standalone (31 files)

- `development/scripts/` — 24 test scripts (`test-azure-iot.js`, `test-mqtt-broker.js`, `test-edge-functions.js`, `test-encryption.js`, `test-rls-auth.js`, `create-test-users.js`, `cleanup-test-orgs.js`, etc.)
- `scripts/` (root) — 3 test scripts (`test-staging-rls.js`, `test-frontend-connection.sh`, `test-aws-iot.js`)
- `development/` (root) — 3 standalone test files (`test-ai-insights.js`, `test-golioth-api.js`, `test-golioth-apis.sh`)
- Root — 1 test (`test-supabase-alerts.js`)

### Additional test-related files

- `development/test-app.spec.ts` — standalone root-level Playwright spec (1)
- `development/__tests__/utils/test-utils.tsx` — shared test utility helper (1)
- `development/src/lib/supabase/test-telemetry.ts` — telemetry test helper (1)
- `development/services/mqtt-subscriber/test-setup.sh` — MQTT test setup (1)
- `.github/workflows/test.yml` — CI test workflow (1)

## Runner Configuration

- `development/package.json`
  - `npm test` → Jest (unit/component tests)
  - `npm run test:e2e` → Playwright (E2E + playwright specs)
- `development/playwright.config.js`
  - `testMatch` includes:
    - `e2e/**/*.spec.ts`
    - `tests/playwright/**/*.spec.ts`

## Snapshot Counts (March 1, 2026)

### Strict Test/Spec Count (_.test._ or _.spec._ files)

| Location                             | Count  |
| ------------------------------------ | ------ |
| `__tests__/` + `src/`                | 74     |
| `e2e/`                               | 4      |
| `test-app.spec.ts` (root)            | 1      |
| `supabase/functions/`                | 4      |
| `tests/playwright/`                  | 5      |
| `tests/integration/` (_.test._ only) | 2      |
| **Strict total**                     | **90** |

### Full Testing Inventory (all test-related assets)

| Category                               | Count   |
| -------------------------------------- | ------- |
| Strict test/spec files                 | 90      |
| Integration test scripts (test-\*.mjs) | 15      |
| Test scripts (development/scripts/)    | 24      |
| Root + root scripts/ test files        | 4       |
| Standalone dev test files              | 3       |
| Test helpers + utilities               | 2       |
| Services test setup                    | 1       |
| CI test workflow                       | 1       |
| Test fixtures (SQL)                    | 12      |
| **Full inventory total**               | **152** |
