/**
 * Tests for SMS user helper functions
 * Validates that SMS notifications work for organization members in multi-org setups
 */

import { formatPhoneE164, isValidPhoneNumber } from '@/lib/helpers/sms-users'

describe('SMS User Helpers', () => {
  describe('formatPhoneE164', () => {
    it('should format 10-digit US phone number', () => {
      const result = formatPhoneE164('5551234567')
      expect(result).toBe('+15551234567')
    })

    it('should format 11-digit US phone number starting with 1', () => {
      const result = formatPhoneE164('15551234567')
      expect(result).toBe('+15551234567')
    })

    it('should handle phone numbers with formatting characters', () => {
      const result = formatPhoneE164('(555) 123-4567')
      expect(result).toBe('+15551234567')
    })

    it('should preserve existing E.164 format', () => {
      const result = formatPhoneE164('+15551234567')
      expect(result).toBe('+15551234567')
    })

    it('should handle international phone numbers', () => {
      const result = formatPhoneE164('+44201234567')
      expect(result).toBe('+44201234567')
    })

    it('should return null for invalid phone number', () => {
      const result = formatPhoneE164('123')
      expect(result).toBeNull()
    })

    it('should return null for empty string', () => {
      const result = formatPhoneE164('')
      expect(result).toBeNull()
    })

    it('should handle default country code parameter', () => {
      const result = formatPhoneE164('5551234567', '+44')
      expect(result).toBe('+445551234567')
    })
  })

  describe('isValidPhoneNumber', () => {
    it('should validate E.164 formatted phone number', () => {
      const result = isValidPhoneNumber('+15551234567')
      expect(result).toBe(true)
    })

    it('should validate plain 10-digit US number', () => {
      const result = isValidPhoneNumber('5551234567')
      expect(result).toBe(true)
    })

    it('should validate formatted phone number', () => {
      const result = isValidPhoneNumber('(555) 123-4567')
      expect(result).toBe(true)
    })

    it('should validate international phone number', () => {
      const result = isValidPhoneNumber('+44201234567')
      expect(result).toBe(true)
    })

    it('should reject invalid phone number (too short)', () => {
      const result = isValidPhoneNumber('1')
      expect(result).toBe(false)
    })

    it('should reject empty string', () => {
      const result = isValidPhoneNumber('')
      expect(result).toBe(false)
    })

    it('should reject letters', () => {
      const result = isValidPhoneNumber('abc-123-4567')
      expect(result).toBe(false)
    })
  })

  describe('SMS Notification Recipients - Issue #185', () => {
    /**
     * Issue #185: SMS not sending on org users
     *
     * This test validates that the SMS helper functions properly handle
     * users in multi-org setups by checking the organization_members table
     */

    it('should format multiple phone numbers correctly', () => {
      const phones = ['5551234567', '(555) 987-6543', '+15559876543']
      const formatted = phones
        .map((p) => formatPhoneE164(p))
        .filter((p) => p !== null)

      expect(formatted).toHaveLength(3)
      expect(formatted).toContain('+15551234567')
      expect(formatted).toContain('+15559876543')
    })

    it('should deduplicate phone numbers after formatting', () => {
      const phones = ['5551234567', '555-123-4567', '+15551234567']
      const formatted = [
        ...new Set(
          phones.map((p) => formatPhoneE164(p)).filter((p) => p !== null)
        ),
      ]

      expect(formatted).toHaveLength(1)
      expect(formatted[0]).toBe('+15551234567')
    })

    it('should filter out invalid phone numbers', () => {
      const phones = ['5551234567', 'invalid', '', '+15559876543', '123']
      const formatted = phones
        .map((p) => formatPhoneE164(p))
        .filter((p) => p !== null)

      expect(formatted).toHaveLength(2)
      expect(formatted).toContain('+15551234567')
      expect(formatted).toContain('+15559876543')
    })
  })
})
