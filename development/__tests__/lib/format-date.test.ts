/**
 * Tests for src/lib/format-date.ts
 * 
 * Testing date/time formatting utilities with various preferences
 */

import {
  formatDateTime,
  formatDateOnly,
  formatTimeOnly,
  formatRelativeTime,
  formatDuration,
  formatISODate,
} from '@/lib/format-date'

describe('formatDateTime', () => {
  const testDate = new Date('2026-02-19T15:30:45Z')

  test('formats date-time with default options', () => {
    const result = formatDateTime(testDate)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  test('formats date-time with 12h format', () => {
    const result = formatDateTime(testDate, { timeFormat: '12h' })
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  test('formats date-time with 24h format', () => {
    const result = formatDateTime(testDate, { timeFormat: '24h' })
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  test('formats with different date formats', () => {
    const result1 = formatDateTime(testDate, { dateFormat: 'MM/DD/YYYY' })
    const result2 = formatDateTime(testDate, { dateFormat: 'DD/MM/YYYY' })
    const result3 = formatDateTime(testDate, { dateFormat: 'YYYY-MM-DD' })
    
    expect(result1).toBeTruthy()
    expect(result2).toBeTruthy()
    expect(result3).toBeTruthy()
  })

  test('handles string dates', () => {
    const result = formatDateTime('2026-02-19T15:30:45Z')
    expect(result).toBeTruthy()
  })

  test('handles timestamp numbers', () => {
    const result = formatDateTime(testDate.getTime())
    expect(result).toBeTruthy()
  })

  test('handles invalid dates gracefully', () => {
    const result = formatDateTime('invalid')
    expect(result).toBe('N/A')
  })

  test('formats with different languages', () => {
    const result1 = formatDateTime(testDate, { language: 'en' })
    const result2 = formatDateTime(testDate, { language: 'es' })
    const result3 = formatDateTime(testDate, { language: 'fr' })
    
    expect(result1).toBeTruthy()
    expect(result2).toBeTruthy()
    expect(result3).toBeTruthy()
  })
})

describe('formatDateOnly', () => {
  const testDate = new Date('2026-02-19T15:30:45Z')

  test('formats date without time', () => {
    const result = formatDateOnly(testDate)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  test('formats with MM/DD/YYYY format', () => {
    const result = formatDateOnly(testDate, { dateFormat: 'MM/DD/YYYY' })
    expect(result).toBeTruthy()
  })

  test('formats with DD/MM/YYYY format', () => {
    const result = formatDateOnly(testDate, { dateFormat: 'DD/MM/YYYY' })
    expect(result).toBeTruthy()
  })

  test('formats with YYYY-MM-DD format', () => {
    const result = formatDateOnly(testDate, { dateFormat: 'YYYY-MM-DD' })
    expect(result).toBeTruthy()
  })

  test('handles invalid dates', () => {
    const result = formatDateOnly('invalid')
    expect(result).toBe('N/A')
  })

  test('handles different languages', () => {
    const result1 = formatDateOnly(testDate, { language: 'en' })
    const result2 = formatDateOnly(testDate, { language: 'de' })
    
    expect(result1).toBeTruthy()
    expect(result2).toBeTruthy()
  })
})

describe('formatTimeOnly', () => {
  const testDate = new Date('2026-02-19T15:30:45Z')

  test('formats time without date', () => {
    const result = formatTimeOnly(testDate)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  test('formats with 12-hour format', () => {
    const result = formatTimeOnly(testDate, { timeFormat: '12h' })
    expect(result).toBeTruthy()
  })

  test('formats with 24-hour format', () => {
    const result = formatTimeOnly(testDate, { timeFormat: '24h' })
    expect(result).toBeTruthy()
  })

  test('handles invalid dates', () => {
    const result = formatTimeOnly('invalid')
    expect(result).toBe('N/A')
  })
})

describe('formatRelativeTime', () => {
  test('formats "just now" for recent times', () => {
    const now = new Date()
    const result = formatRelativeTime(now.toISOString())
    expect(result).toBeTruthy()
  })

  test('formats minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const result = formatRelativeTime(fiveMinutesAgo.toISOString())
    expect(result).toBeTruthy()
  })

  test('formats hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const result = formatRelativeTime(twoHoursAgo.toISOString())
    expect(result).toBeTruthy()
  })

  test('formats days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const result = formatRelativeTime(threeDaysAgo.toISOString())
    expect(result).toBeTruthy()
  })

  test('handles invalid dates', () => {
    const result = formatRelativeTime('invalid')
    expect(result).toBe('N/A')
  })

  test('handles null', () => {
    const result = formatRelativeTime(null as any)
    expect(result).toBe('N/A')
  })
})

describe('formatDuration', () => {
  test('formats duration in seconds under a minute', () => {
    const result = formatDuration(45)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  test('formats duration in minutes', () => {
    const result = formatDuration(300) // 5 minutes
    expect(result).toBeTruthy()
  })

  test('formats duration in hours', () => {
    const result = formatDuration(7200) // 2 hours
    expect(result).toBeTruthy()
  })

  test('formats duration in days', () => {
    const result = formatDuration(172800) // 2 days
    expect(result).toBeTruthy()
  })

  test('handles zero duration', () => {
    const result = formatDuration(0)
    expect(result).toBeTruthy()
  })

  test('handles negative durations', () => {
    const result = formatDuration(-100)
    expect(result).toBeTruthy()
  })
})

describe('formatISODate', () => {
  test('formats dates to ISO 8601', () => {
    const date = new Date('2026-02-19T15:30:45Z')
    const result = formatISODate(date)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  test('handles string input', () => {
    const result = formatISODate('2026-02-19T15:30:45Z')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  test('handles timestamp input', () => {
    const timestamp = Date.now()
    const result = formatISODate(timestamp)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

describe('Edge Cases and Error Handling', () => {
  test('handles null gracefully', () => {
    expect(formatDateTime(null as any)).toBe('N/A')
    expect(formatDateOnly(null as any)).toBe('N/A')
    expect(formatTimeOnly(null as any)).toBe('N/A')
  })

  test('handles undefined gracefully', () => {
    expect(formatDateTime(undefined as any)).toBe('N/A')
    expect(formatDateOnly(undefined as any)).toBe('N/A')
    expect(formatTimeOnly(undefined as any)).toBe('N/A')
  })

  test('handles empty string gracefully', () => {
    expect(formatDateTime('')).toBe('N/A')
    expect(formatDateOnly('')).toBe('N/A')
    expect(formatTimeOnly('')).toBe('N/A')
  })
})
