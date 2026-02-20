/**
 * Unit Conversion Tests
 * 
 * Tests for the unit conversion utility to verify accurate conversions
 * across different measurement types.
 */

import {
  convertUnit,
  canConvertUnit,
  getAvailableConversions,
  convertMeasurementValues,
} from '@/lib/unit-conversion'

describe('Unit Conversion Utilities', () => {
  describe('convertUnit', () => {
    // Temperature conversions
    test('converts Celsius to Fahrenheit', () => {
      const result = convertUnit(20, '°C', '°F')
      expect(result).toBe(68)
    })

    test('converts Fahrenheit to Celsius', () => {
      const result = convertUnit(32, '°F', '°C')
      expect(result).toBeCloseTo(0, 5)
    })

    test('converts Celsius to Kelvin', () => {
      const result = convertUnit(0, '°C', 'K')
      expect(result).toBeCloseTo(273.15, 5)
    })

    // Pressure conversions
    test('converts hPa to psi', () => {
      const result = convertUnit(1013.25, 'hPa', 'psi')
      expect(result).toBeCloseTo(14.696, 3)
    })

    test('converts psi to hPa', () => {
      const result = convertUnit(14.696, 'psi', 'hPa')
      expect(result).toBeCloseTo(1013.25, 1)
    })

    // Distance conversions
    test('converts meters to feet', () => {
      const result = convertUnit(1, 'm', 'ft')
      expect(result).toBeCloseTo(3.28084, 5)
    })

    test('converts kilometers to miles', () => {
      const result = convertUnit(1, 'km', 'ft')
      expect(result).not.toBeNull()
    })

    // Same unit returns same value
    test('returns same value for same unit', () => {
      const result = convertUnit(100, '°C', '°C')
      expect(result).toBe(100)
    })

    // Unavailable conversion returns null
    test('returns null for unavailable conversion', () => {
      const result = convertUnit(100, '°C', 'ppm')
      expect(result).toBeNull()
    })
  })

  describe('canConvertUnit', () => {
    test('returns true for available conversion', () => {
      expect(canConvertUnit('°C', '°F')).toBe(true)
    })

    test('returns true for same unit', () => {
      expect(canConvertUnit('°C', '°C')).toBe(true)
    })

    test('returns false for unavailable conversion', () => {
      expect(canConvertUnit('°C', 'ppm')).toBe(false)
    })

    test('returns false for unknown source unit', () => {
      expect(canConvertUnit('unknown', '°F')).toBe(false)
    })
  })

  describe('getAvailableConversions', () => {
    test('returns available conversions for temperature', () => {
      const conversions = getAvailableConversions('°C')
      expect(conversions).toContain('°C')
      expect(conversions).toContain('°F')
      expect(conversions).toContain('K')
    })

    test('returns available conversions for distance', () => {
      const conversions = getAvailableConversions('m')
      expect(conversions).toContain('m')
      expect(conversions).toContain('ft')
      expect(conversions).toContain('km')
    })

    test('returns empty array for unknown unit', () => {
      const conversions = getAvailableConversions('unknown')
      expect(conversions).toEqual([])
    })
  })

  describe('convertMeasurementValues', () => {
    test('converts temperature thresholds from Celsius to Fahrenheit', () => {
      const result = convertMeasurementValues('18', '26', '10', '35', '°C', '°F')
      expect(parseFloat(result.lowerNormal)).toBeCloseTo(64.4, 1)
      expect(parseFloat(result.upperNormal)).toBeCloseTo(78.8, 1)
      expect(parseFloat(result.lowerAlert)).toBeCloseTo(50, 1)
      expect(parseFloat(result.upperAlert)).toBeCloseTo(95, 1)
    })

    test('handles empty alert thresholds', () => {
      const result = convertMeasurementValues('0', '100', '', '', 'K', '°C')
      expect(result.lowerNormal).toBe('-273.15')
      expect(result.upperNormal).toBe('-173.15')
      expect(result.lowerAlert).toBe('')
      expect(result.upperAlert).toBe('')
    })

    test('handles invalid numeric values gracefully', () => {
      const result = convertMeasurementValues('invalid', '26', '10', '35', '°C', '°F')
      expect(result.lowerNormal).toBe('')
      expect(result.upperNormal).toBeCloseTo(78.8, 1)
    })

    test('returns empty strings when conversion not available', () => {
      const result = convertMeasurementValues('18', '26', '10', '35', '°C', 'ppm')
      expect(result.lowerNormal).toBe('')
      expect(result.upperNormal).toBe('')
      expect(result.lowerAlert).toBe('')
      expect(result.upperAlert).toBe('')
    })

    test('converts distance measurements', () => {
      const result = convertMeasurementValues('0', '100', '10', '90', 'm', 'ft')
      expect(parseFloat(result.lowerNormal)).toBeCloseTo(0, 1)
      expect(parseFloat(result.upperNormal)).toBeCloseTo(328.08, 1)
      expect(parseFloat(result.lowerAlert)).toBeCloseTo(32.81, 1)
      expect(parseFloat(result.upperAlert)).toBeCloseTo(295.27, 1)
    })
  })

  describe('Bidirectional conversions', () => {
    test('converting back and forth preserves original value', () => {
      const original = 72
      const converted = convertUnit(original, '°F', '°C')
      const backToF = convertUnit(converted!, '°C', '°F')
      expect(backToF).toBeCloseTo(original, 10)
    })

    test('pressure conversions are consistent', () => {
      const original = 1000
      const toMbar = convertUnit(original, 'hPa', 'mbar')
      expect(toMbar).toBeCloseTo(1000, 5)
      const toPa = convertUnit(original, 'hPa', 'Pa')
      expect(toPa).toBeCloseTo(100000, 5)
    })
  })
})
