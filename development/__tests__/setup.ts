/**
 * Test Environment Setup (TypeScript)
 * 
 * This file provides additional test setup and utilities in TypeScript.
 * It complements jest.setup.js with type-safe helpers and configuration.
 */

// Extend Jest matchers with custom expectations
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R
      toBeValidDate(): R
      toBeValidEmail(): R
    }
  }
}

/**
 * Custom matcher: Validate UUID format
 */
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const pass = uuidRegex.test(received)
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
    }
  },
})

/**
 * Custom matcher: Validate ISO date string
 */
expect.extend({
  toBeValidDate(received: string) {
    const date = new Date(received)
    const pass = !isNaN(date.getTime())
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid date`
          : `expected ${received} to be a valid date`,
    }
  },
})

/**
 * Custom matcher: Validate email format
 */
expect.extend({
  toBeValidEmail(received: string) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const pass = emailRegex.test(received)
    
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid email`
          : `expected ${received} to be a valid email`,
    }
  },
})

/**
 * Utility: Wait for async operations to complete
 */
export const waitForAsync = () => 
  new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Utility: Mock console methods during a test
 */
export const mockConsole = () => {
  const originalConsole = { ...console }
  
  beforeEach(() => {
    global.console = {
      ...console,
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    }
  })
  
  afterEach(() => {
    global.console = originalConsole
  })
}

/**
 * Utility: Create mock file for upload testing
 */
export const createMockFile= (
  name: string = 'test.txt',
  size: number = 1024,
  type: string = 'text/plain'
): File => {
  const blob = new Blob(['a'.repeat(size)], { type })
  return new File([blob], name, { type })
}

/**
 * Utility: Create mock FormData
 */
export const createMockFormData = (data: Record<string, string | File>): FormData => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    formData.append(key, value)
  })
  return formData
}

/**
 * Test environment info
 */
export const testEnv = {
  isCI: process.env.CI === 'true',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
}

/**
 * Common test timeouts
 */
export const timeouts = {
  short: 1000,
  medium: 5000,
  long: 10000,
  veryLong: 30000,
}

export default {}
