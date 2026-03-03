/**
 * Vitest → Jest compatibility shim
 *
 * Several test files import helpers from 'vitest'. Since this project
 * runs Jest, we re-export the Jest globals so those imports resolve.
 */

module.exports = {
  describe: global.describe,
  it: global.it,
  test: global.test,
  expect: global.expect,
  beforeEach: global.beforeEach,
  afterEach: global.afterEach,
  beforeAll: global.beforeAll,
  afterAll: global.afterAll,
  // vi maps to jest (spies, mocks, etc.)
  vi: jest,
}
