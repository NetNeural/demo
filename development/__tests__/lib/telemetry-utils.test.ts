/**
 * Tests for src/lib/telemetry-utils.ts
 * 
 * Testing telemetry data extraction from various formats
 */

import { extractMetricValue, METRIC_TO_SENSOR_TYPE, METRIC_TO_SENSOR_NAMES } from '@/lib/telemetry-utils'

describe('extractMetricValue', () => {
  describe('Flat key format', () => {
    test('extracts temperature from flat key', () => {
      const telemetry = { temperature: 23.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })

    test('extracts humidity from flat key', () => {
      const telemetry = { humidity: 65.2 }
      const result = extractMetricValue(telemetry, 'humidity')
      expect(result).toBe(65.2)
    })

    test('extracts pressure from flat key', () => {
      const telemetry = { pressure: 1013.25 }
      const result = extractMetricValue(telemetry, 'pressure')
      expect(result).toBe(1013.25)
    })

    test('extracts battery from flat key', () => {
      const telemetry = { battery: 85 }
      const result = extractMetricValue(telemetry, 'battery')
      expect(result).toBe(85)
    })

    test('handles string numbers', () => {
      const telemetry = { temperature: '23.5' }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })
  })

  describe('Golioth sensor type format', () => {
    test('extracts temperature using type ID', () => {
      const telemetry = { type: '1', value: 23.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })

    test('extracts humidity using type ID', () => {
      const telemetry = { type: '2', value: 65.2 }
      const result = extractMetricValue(telemetry, 'humidity')
      expect(result).toBe(65.2)
    })

    test('extracts pressure using type ID', () => {
      const telemetry = { type: '3', value: 1013.25 }
      const result = extractMetricValue(telemetry, 'pressure')
      expect(result).toBe(1013.25)
    })

    test('extracts battery using type ID', () => {
      const telemetry = { type: '4', value: 85 }
      const result = extractMetricValue(telemetry, 'battery')
      expect(result).toBe(85)
    })

    test('extracts CO2 using type ID', () => {
      const telemetry = { type: '7', value: 450 }
      const result = extractMetricValue(telemetry, 'co2')
      expect(result).toBe(450)
    })

    test('extracts TVOC using type ID', () => {
      const telemetry = { type: '8', value: 120 }
      const result = extractMetricValue(telemetry, 'tvoc')
      expect(result).toBe(120)
    })

    test('extracts light using type ID', () => {
      const telemetry = { type: '9', value: 500 }
      const result = extractMetricValue(telemetry, 'light')
      expect(result).toBe(500)
    })

    test('extracts motion using type ID', () => {
      const telemetry = { type: '10', value: 1 }
      const result = extractMetricValue(telemetry, 'motion')
      expect(result).toBe(1)
    })
  })

  describe('Golioth sensor name format', () => {
    test('extracts temperature using sensor name', () => {
      const telemetry = { sensor: 'temp', value: 23.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })

    test('extracts temperature using full sensor name', () => {
      const telemetry = { sensor: 'temperature', value: 23.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })

    test('extracts humidity using sensor name', () => {
      const telemetry = { sensor: 'hum', value: 65.2 }
      const result = extractMetricValue(telemetry, 'humidity')
      expect(result).toBe(65.2)
    })

    test('extracts battery using sensor name', () => {
      const telemetry = { sensor: 'bat', value: 85 }
      const result = extractMetricValue(telemetry, 'battery')
      expect(result).toBe(85)
    })

    test('handles case insensitive sensor names', () => {
      const telemetry = { sensor: 'TEMP', value: 23.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })
  })

  describe('Nested env format', () => {
    test('extracts temperature from env object', () => {
      const telemetry = { env: { temp: 23.5 } }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })

    test('extracts temperature using full name in env', () => {
      const telemetry = { env: { temperature: 23.5 } }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })

    test('extracts humidity from env object', () => {
      const telemetry = { env: { hum: 65.2 } }
      const result = extractMetricValue(telemetry, 'humidity')
      expect(result).toBe(65.2)
    })

    test('extracts multiple metrics from env', () => {
      const telemetry = { env: { temp: 23.5, hum: 65.2, press: 1013.25 } }
      
      expect(extractMetricValue(telemetry, 'temperature')).toBe(23.5)
      expect(extractMetricValue(telemetry, 'humidity')).toBe(65.2)
      expect(extractMetricValue(telemetry, 'pressure')).toBe(1013.25)
    })
  })

  describe('Alternative flat key aliases', () => {
    test('extracts temperature using "temp" alias', () => {
      const telemetry = { temp: 23.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })

    test('extracts humidity using "hum" alias', () => {
      const telemetry = { hum: 65.2 }
      const result = extractMetricValue(telemetry, 'humidity')
      expect(result).toBe(65.2)
    })

    test('extracts battery using "bat" alias', () => {
      const telemetry = { bat: 85 }
      const result = extractMetricValue(telemetry, 'battery')
      expect(result).toBe(85)
    })

    test('extracts battery using "battery_level" alias', () => {
      const telemetry = { battery_level: 85 }
      const result = extractMetricValue(telemetry, 'battery')
      expect(result).toBe(85)
    })

    test('extracts rssi using "signal_strength" alias', () => {
      const telemetry = { signal_strength: -65 }
      const result = extractMetricValue(telemetry, 'rssi')
      expect(result).toBe(-65)
    })
  })

  describe('Priority and fallback logic', () => {
    test('prefers direct flat key over aliases', () => {
      const telemetry = { temperature: 25.0, temp: 23.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(25.0)
    })

    test('falls back to alias if direct key not found', () => {
      const telemetry = { temp: 23.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(23.5)
    })

    test('prefers Golioth format when type and value present', () => {
      const telemetry = { type: '1', value: 25.0, температуре: 23.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      // Should use Golioth format (type + value)
      expect(result).not.toBeNull()
    })
  })

  describe('Error handling and edge cases', () => {
    test('returns null for null telemetry', () => {
      const result = extractMetricValue(null, 'temperature')
      expect(result).toBeNull()
    })

    test('returns null for undefined telemetry', () => {
      const result = extractMetricValue(undefined, 'temperature')
      expect(result).toBeNull()
    })

    test('returns null for empty object', () => {
      const result = extractMetricValue({}, 'temperature')
      expect(result).toBeNull()
    })

    test('returns null for non-existent metric', () => {
      const telemetry = { temperature: 23.5 }
      const result = extractMetricValue(telemetry, 'humidity')
      expect(result).toBeNull()
    })

    test('handles NaN values', () => {
      const telemetry = { temperature: 'not-a-number' }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBeNull()
    })

    test('handles null values', () => {
      const telemetry = { temperature: null }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBeNull()
    })

    test('handles undefined values', () => {
      const telemetry = { temperature: undefined }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBeNull()
    })

    test('handles zero values correctly', () => {
      const telemetry = { temperature: 0 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(0)
    })

    test('handles negative values correctly', () => {
      const telemetry = { temperature: -5.5 }
      const result = extractMetricValue(telemetry, 'temperature')
      expect(result).toBe(-5.5)
    })
  })

  describe('Complex real-world scenarios', () => {
    test('extracts from mixed Golioth and flat format', () => {
      const telemetry = {
        type: '1',
        value: 23.5,
        sensor: 'temp',
        humidity: 65.2,
        battery: 85,
      }
      
      expect(extractMetricValue(telemetry, 'temperature')).toBe(23.5)
      expect(extractMetricValue(telemetry, 'humidity')).toBe(65.2)
      expect(extractMetricValue(telemetry, 'battery')).toBe(85)
    })

    test('extracts from nested env with multiple readings', () => {
      const telemetry = {
        timestamp: '2026-02-19T12:00:00Z',
        device_id: 'sensor-001',
        env: {
          temp: 23.5,
          hum: 65.2,
          press: 1013.25,
          bat: 85,
        },
      }
      
      expect(extractMetricValue(telemetry, 'temperature')).toBe(23.5)
      expect(extractMetricValue(telemetry, 'humidity')).toBe(65.2)
      expect(extractMetricValue(telemetry, 'pressure')).toBe(1013.25)
      expect(extractMetricValue(telemetry, 'battery')).toBe(85)
    })
  })
})

describe('METRIC_TO_SENSOR_TYPE constant', () => {
  test('defines type IDs for all metrics', () => {
    expect(METRIC_TO_SENSOR_TYPE.temperature).toEqual(['1'])
    expect(METRIC_TO_SENSOR_TYPE.humidity).toEqual(['2'])
    expect(METRIC_TO_SENSOR_TYPE.pressure).toEqual(['3'])
    expect(METRIC_TO_SENSOR_TYPE.battery).toEqual(['4'])
    expect(METRIC_TO_SENSOR_TYPE.co2).toEqual(['7'])
    expect(METRIC_TO_SENSOR_TYPE.tvoc).toEqual(['8'])
    expect(METRIC_TO_SENSOR_TYPE.light).toEqual(['9'])
    expect(METRIC_TO_SENSOR_TYPE.motion).toEqual(['10'])
  })

  test('RSSI has empty array (no specific type ID)', () => {
    expect(METRIC_TO_SENSOR_TYPE.rssi).toEqual([])
  })
})

describe('METRIC_TO_SENSOR_NAMES constant', () => {
  test('defines aliases for all metrics', () => {
    expect(METRIC_TO_SENSOR_NAMES.temperature).toContain('temp')
    expect(METRIC_TO_SENSOR_NAMES.temperature).toContain('temperature')
    expect(METRIC_TO_SENSOR_NAMES.humidity).toContain('hum')
    expect(METRIC_TO_SENSOR_NAMES.humidity).toContain('humidity')
    expect(METRIC_TO_SENSOR_NAMES.battery).toContain('bat')
    expect(METRIC_TO_SENSOR_NAMES.battery).toContain('battery')
    expect(METRIC_TO_SENSOR_NAMES.battery).toContain('battery_level')
    expect(METRIC_TO_SENSOR_NAMES.rssi).toContain('rssi')
    expect(METRIC_TO_SENSOR_NAMES.rssi).toContain('signal_strength')
  })
})
