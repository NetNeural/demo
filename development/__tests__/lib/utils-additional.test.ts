/**
 * Utility and Helper Functions Tests
 * Tests for lib and utility functions
 */

import { formatDate, isValidEmail, getInitials, cn } from '@/lib/utils'

describe('Utils - formatDate', () => {
  test('formats date correctly', () => {
    const date = new Date('2024-01-15T10:30:00Z')
    const formatted = formatDate(date.toISOString())
    expect(formatted).toContain('Jan')
  })

  test('handles invalid date', () => {
    const result = formatDate('invalid')
    expect(result).toBe('Invalid Date')
  })
})

describe('Utils - isValidEmail', () => {
  test('validates correct email', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
  })

  test('rejects invalid email', () => {
    expect(isValidEmail('notanemail')).toBe(false)
  })

  test('rejects email without domain', () => {
    expect(isValidEmail('test@')).toBe(false)
  })
})

describe('Utils - getInitials', () => {
  test('gets initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  test('handles single name', () => {
    expect(getInitials('John')).toBe('J')
  })

  test('handles empty string', () => {
    expect(getInitials('')).toBe('??')
  })
})

describe('Utils - cn (className merger)', () => {
  test('merges classnames', () => {
    const result = cn('class1', 'class2')
    expect(result).toContain('class1')
    expect(result).toContain('class2')
  })

  test('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', true && 'visible')
    expect(result).toContain('base')
    expect(result).toContain('visible')
    expect(result).not.toContain('hidden')
  })
})
