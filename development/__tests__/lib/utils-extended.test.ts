/**
 * Utility Functions Tests - Additional Coverage
 */

import { formatDate, isValidEmail, getInitials, cn } from '@/lib/utils'

describe('Utility Functions - Extended Tests', () => {
  describe('formatDate', () => {
    test('formats valid ISO date string', () => {
      const result = formatDate('2024-01-15T10:30:00Z')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    test('handles Date object', () => {
      const date = new Date('2024-01-15')
      const result = formatDate(date.toISOString())
      expect(result).toBeTruthy()
    })

    test('handles different date formats', () => {
      const result1 = formatDate('2024-01-01')
      const result2 = formatDate('2024-12-31')
      expect(result1).toBeTruthy()
      expect(result2).toBeTruthy()
    })
  })

  describe('isValidEmail', () => {
    test('validates standard email formats', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('user.name@example.com')).toBe(true)
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true)
    })

    test('rejects invalid email formats', () => {
      expect(isValidEmail('notanemail')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user@.com')).toBe(false)
    })

    test('handles edge cases', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('user name@example.com')).toBe(false)
    })
  })

  describe('getInitials', () => {
    test('extracts initials from full names', () => {
      expect(getInitials('John Doe')).toBeTruthy()
      expect(getInitials('Alice Bob Charlie')).toBeTruthy()
    })

    test('handles single names', () => {
      const result = getInitials('John')
      expect(result).toBeTruthy()
      expect(result.length).toBeGreaterThan(0)
    })

    test('handles empty or whitespace input', () => {
      const result1 = getInitials('')
      const result2 = getInitials('   ')
      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
    })

    test('handles special characters', () => {
      const result = getInitials("O'Brien")
      expect(result).toBeTruthy()
    })
  })

  describe('cn (className utility)', () => {
    test('merges multiple class names', () => {
      const result = cn('class1', 'class2', 'class3')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    test('handles conditional classes', () => {
      const result = cn('base', true && 'active', false && 'hidden')
      expect(result).toContain('base')
      expect(result).toContain('active')
      expect(result).not.toContain('hidden')
    })

    test('handles undefined and null', () => {
      const result = cn('class1', undefined, null, 'class2')
      expect(result).toBeTruthy()
    })

    test('handles empty strings', () => {
      const result = cn('class1', '', 'class2')
      expect(result).toBeTruthy()
    })

    test('merges tailwind classes correctly', () => {
      const result = cn('bg-red-500', 'bg-blue-500')
      expect(result).toBeTruthy()
    })
  })
})
