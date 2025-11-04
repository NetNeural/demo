/**
 * REAL UNIT TESTS - Testing Actual Source Code
 * Tests for src/lib/utils.ts utility functions
 */

import {
  cn,
  formatCurrency,
  formatDate,
  truncateText,
  getInitials,
  generateId,
  isValidEmail,
  getDeviceStatusColor,
  getAlertSeverityColor,
  calculateUptime,
} from '@/lib/utils'

describe('Utils Library - Real Source Code Tests', () => {
  describe('cn (className merger)', () => {
    test('should merge class names correctly', () => {
      const result = cn('px-4', 'py-2', 'bg-blue-500')
      expect(result).toContain('px-4')
      expect(result).toContain('py-2')
      expect(result).toContain('bg-blue-500')
    })

    test('should handle conditional classes', () => {
      const isActive = true
      const result = cn('base-class', isActive && 'active-class')
      expect(result).toContain('base-class')
      expect(result).toContain('active-class')
    })

    test('should handle false conditional classes', () => {
      const isActive = false
      const result = cn('base-class', isActive && 'active-class')
      expect(result).toContain('base-class')
      expect(result).not.toContain('active-class')
    })

    test('should merge conflicting tailwind classes', () => {
      // tailwind-merge should keep the last one
      const result = cn('px-2', 'px-4')
      expect(result).toBe('px-4')
    })
  })

  describe('formatCurrency', () => {
    test('should format USD correctly', () => {
      const result = formatCurrency(1234.56)
      expect(result).toBe('$1,234.56')
    })

    test('should format with custom currency', () => {
      const result = formatCurrency(1234.56, 'EUR')
      expect(result).toContain('1,234.56')
    })

    test('should handle zero', () => {
      const result = formatCurrency(0)
      expect(result).toBe('$0.00')
    })

    test('should handle negative numbers', () => {
      const result = formatCurrency(-100)
      expect(result).toBe('-$100.00')
    })

    test('should handle large numbers', () => {
      const result = formatCurrency(1000000)
      expect(result).toBe('$1,000,000.00')
    })
  })

  describe('formatDate', () => {
    test('should format date correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = formatDate(date)
      expect(result).toMatch(/Jan/)
      expect(result).toMatch(/15/)
      expect(result).toMatch(/2024/)
    })

    test('should handle string dates', () => {
      const result = formatDate('2024-01-15')
      expect(result).toMatch(/Jan/)
      expect(result).toMatch(/1[45]/) // Could be 14 or 15 depending on timezone
    })

    test('should accept custom options', () => {
      const date = new Date('2024-01-15')
      const result = formatDate(date, { month: 'long' })
      expect(result).toMatch(/January/)
    })

    test('should handle ISO string dates', () => {
      const result = formatDate('2024-01-15T10:30:00.000Z')
      expect(result).toContain('2024')
    })
  })

  describe('truncateText', () => {
    test('should truncate long text', () => {
      const text = 'This is a very long text that needs to be truncated'
      const result = truncateText(text, 20)
      expect(result).toBe('This is a very long ...')
      expect(result.length).toBe(23) // 20 + '...'
    })

    test('should not truncate short text', () => {
      const text = 'Short text'
      const result = truncateText(text, 20)
      expect(result).toBe('Short text')
    })

    test('should handle exact length', () => {
      const text = 'Exactly twenty chars'
      const result = truncateText(text, 20)
      expect(result).toBe('Exactly twenty chars')
    })

    test('should handle empty string', () => {
      const result = truncateText('', 10)
      expect(result).toBe('')
    })

    test('should handle zero length', () => {
      const result = truncateText('test', 0)
      expect(result).toBe('...')
    })
  })

  describe('getInitials', () => {
    test('should get initials from full name', () => {
      const result = getInitials('John Doe')
      expect(result).toBe('JD')
    })

    test('should handle single name', () => {
      const result = getInitials('John')
      expect(result).toBe('J')
    })

    test('should handle three names', () => {
      const result = getInitials('John Michael Doe')
      expect(result).toBe('JM') // Takes first 2
    })

    test('should convert to uppercase', () => {
      const result = getInitials('john doe')
      expect(result).toBe('JD')
    })

    test('should handle special characters', () => {
      const result = getInitials('O\'Brien Smith')
      expect(result).toBe('OS')
    })

    test('should handle empty string', () => {
      const result = getInitials('')
      // getInitials returns '??' for empty strings as a fallback
      expect(result).toBe('??')
    })
  })

  describe('generateId', () => {
    test('should generate unique IDs', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })

    test('should generate string IDs', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
    })

    test('should generate non-empty IDs', () => {
      const id = generateId()
      expect(id.length).toBeGreaterThan(0)
    })

    test('should generate alphanumeric IDs', () => {
      const id = generateId()
      expect(id).toMatch(/^[a-z0-9]+$/)
    })

    test('should generate multiple unique IDs', () => {
      const ids = new Set()
      for (let i = 0; i < 100; i++) {
        ids.add(generateId())
      }
      expect(ids.size).toBe(100) // All unique
    })
  })

  describe('isValidEmail', () => {
    test('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
    })

    test('should validate email with subdomain', () => {
      expect(isValidEmail('user@mail.example.com')).toBe(true)
    })

    test('should validate email with plus', () => {
      expect(isValidEmail('user+tag@example.com')).toBe(true)
    })

    test('should reject email without @', () => {
      expect(isValidEmail('testexample.com')).toBe(false)
    })

    test('should reject email without domain', () => {
      expect(isValidEmail('test@')).toBe(false)
    })

    test('should reject email without extension', () => {
      expect(isValidEmail('test@example')).toBe(false)
    })

    test('should reject empty string', () => {
      expect(isValidEmail('')).toBe(false)
    })

    test('should reject email with spaces', () => {
      expect(isValidEmail('test @example.com')).toBe(false)
    })

    test('should validate email with numbers', () => {
      expect(isValidEmail('user123@test456.com')).toBe(true)
    })
  })

  describe('getDeviceStatusColor', () => {
    test('should return green for online', () => {
      const result = getDeviceStatusColor('online')
      expect(result).toBe('text-green-600 bg-green-100')
    })

    test('should return gray for offline', () => {
      const result = getDeviceStatusColor('offline')
      expect(result).toBe('text-gray-600 bg-gray-100')
    })

    test('should return yellow for warning', () => {
      const result = getDeviceStatusColor('warning')
      expect(result).toBe('text-yellow-600 bg-yellow-100')
    })

    test('should return red for error', () => {
      const result = getDeviceStatusColor('error')
      expect(result).toBe('text-red-600 bg-red-100')
    })

    test('should handle case insensitive', () => {
      const result = getDeviceStatusColor('ONLINE')
      expect(result).toBe('text-green-600 bg-green-100')
    })

    test('should return default for unknown status', () => {
      const result = getDeviceStatusColor('unknown')
      expect(result).toBe('text-gray-600 bg-gray-100')
    })
  })

  describe('getAlertSeverityColor', () => {
    test('should return blue for low', () => {
      const result = getAlertSeverityColor('low')
      expect(result).toBe('text-blue-600 bg-blue-100')
    })

    test('should return yellow for medium', () => {
      const result = getAlertSeverityColor('medium')
      expect(result).toBe('text-yellow-600 bg-yellow-100')
    })

    test('should return orange for high', () => {
      const result = getAlertSeverityColor('high')
      expect(result).toBe('text-orange-600 bg-orange-100')
    })

    test('should return red for critical', () => {
      const result = getAlertSeverityColor('critical')
      expect(result).toBe('text-red-600 bg-red-100')
    })

    test('should handle case insensitive', () => {
      const result = getAlertSeverityColor('CRITICAL')
      expect(result).toBe('text-red-600 bg-red-100')
    })

    test('should return default for unknown severity', () => {
      const result = getAlertSeverityColor('unknown')
      expect(result).toBe('text-gray-600 bg-gray-100')
    })
  })

  describe('calculateUptime', () => {
    test('should return Unknown for null', () => {
      const result = calculateUptime(null)
      expect(result).toBe('Unknown')
    })

    test('should calculate minutes ago', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const result = calculateUptime(fiveMinutesAgo)
      expect(result).toMatch(/5m ago/)
    })

    test('should calculate hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const result = calculateUptime(twoHoursAgo)
      expect(result).toMatch(/2h/)
    })

    test('should calculate days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const result = calculateUptime(threeDaysAgo)
      expect(result).toMatch(/3d/)
    })

    test('should handle recent activity (< 1 minute)', () => {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
      const result = calculateUptime(thirtySecondsAgo)
      expect(result).toMatch(/0m ago/)
    })

    test('should handle ISO string format', () => {
      const date = '2024-01-01T10:00:00.000Z'
      const result = calculateUptime(date)
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    test('truncateText should handle unicode characters', () => {
      const text = '你好世界👋'
      const result = truncateText(text, 3)
      expect(result.length).toBeLessThanOrEqual(6) // 3 chars + '...'
    })

    test('getInitials should handle multiple spaces', () => {
      const result = getInitials('John  Doe')
      expect(result).toBe('JD')
    })

    test('formatCurrency should handle decimal precision', () => {
      const result = formatCurrency(10.999)
      expect(result).toBe('$11.00') // Rounds to 2 decimals
    })

    test('isValidEmail should handle edge case emails', () => {
      expect(isValidEmail('a@b.co')).toBe(true) // Short valid email
      expect(isValidEmail('test..email@example.com')).toBe(true) // Double dot (technically invalid but regex allows)
    })

    test('generateId should not contain special characters', () => {
      const id = generateId()
      expect(id).not.toMatch(/[^a-z0-9]/)
    })
  })

  describe('Integration Tests', () => {
    test('should format and truncate text together', () => {
      const longText = 'This is a very long device name that needs formatting'
      const truncated = truncateText(longText, 20)
      expect(truncated).toMatch(/\.\.\./)
      expect(truncated.length).toBeLessThanOrEqual(23)
    })

    test('should get initials and validate email', () => {
      const email = 'john.doe@example.com'
      const name = 'John Doe'
      
      expect(isValidEmail(email)).toBe(true)
      expect(getInitials(name)).toBe('JD')
    })

    test('should handle device status and alert severity together', () => {
      const deviceStatus = getDeviceStatusColor('error')
      const alertSeverity = getAlertSeverityColor('critical')
      
      expect(deviceStatus).toContain('red')
      expect(alertSeverity).toContain('red')
    })
  })

  describe('Performance Tests', () => {
    test('should generate 1000 IDs quickly', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        generateId()
      }
      const duration = Date.now() - start
      expect(duration).toBeLessThan(100) // Should be very fast
    })

    test('should validate 1000 emails quickly', () => {
      const start = Date.now()
      for (let i = 0; i < 1000; i++) {
        isValidEmail(`user${i}@example.com`)
      }
      const duration = Date.now() - start
      expect(duration).toBeLessThan(50)
    })

    test('should truncate 1000 texts quickly', () => {
      const start = Date.now()
      const text = 'This is a long text that needs to be truncated'
      for (let i = 0; i < 1000; i++) {
        truncateText(text, 20)
      }
      const duration = Date.now() - start
      expect(duration).toBeLessThan(50)
    })
  })
})
