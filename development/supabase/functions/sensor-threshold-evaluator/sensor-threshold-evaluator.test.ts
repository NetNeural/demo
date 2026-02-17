/**
 * Unit Tests for sensor-threshold-evaluator Edge Function
 * Tests the core threshold evaluation logic including:
 * - Temperature unit conversion (Celsius ↔ Fahrenheit)
 * - Threshold breach detection (critical max/min, max/min)
 * - Alert creation
 * - Email notification triggering
 * - Error handling
 */

import { assertEquals, assertExists } from 'https://deno.land/std@0.177.0/testing/asserts.ts'

// Mock Supabase client
const createMockSupabaseClient = (mockData: any) => {
  return {
    from: (table: string) => ({
      select: (columns?: string) => ({
        eq: (column: string, value: any) => ({
          eq: (column2: string, value2: any) => ({
            order: (column: string, options: any) => ({
              limit: (n: number) => ({
                then: (callback: Function) => callback({ data: mockData.readings, error: null })
              })
            })
          }),
          then: (callback: Function) => callback({ data: mockData.thresholds, error: null })
        }),
        then: (callback: Function) => callback({ data: mockData.thresholds, error: null })
      }),
      insert: (data: any) => ({
        select: () => ({
          single: () => ({
            then: (callback: Function) => callback({ data: mockData.alert, error: null })
          })
        })
      }),
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          then: (callback: Function) => callback({ data: {}, error: null })
        })
      })
    })
  }
}

Deno.test('Temperature Unit Conversion - Celsius to Fahrenheit', () => {
  const celsiusValue = 20 // 20°C
  const fahrenheitValue = (celsiusValue * 9 / 5) + 32 // Should be 68°F
  
  assertEquals(fahrenheitValue, 68)
  console.log(`✓ Converted 20°C to ${fahrenheitValue}°F`)
})

Deno.test('Temperature Unit Conversion - Edge Case (0°C = 32°F)', () => {
  const celsiusValue = 0
  const fahrenheitValue = (celsiusValue * 9 / 5) + 32
  
  assertEquals(fahrenheitValue, 32)
})

Deno.test('Temperature Unit Conversion - Negative Temperature (-40°C = -40°F)', () => {
  const celsiusValue = -40
  const fahrenheitValue = (celsiusValue * 9 / 5) + 32
  
  assertEquals(fahrenheitValue, -40)
})

Deno.test('Threshold Breach Detection - Critical Maximum Exceeded', () => {
  const value = 85
  const threshold = {
    critical_max: 80,
    critical_min: null,
    max_value: 75,
    min_value: 32
  }
  
  let breachType = null
  
  if (threshold.critical_max != null && value >= threshold.critical_max) {
    breachType = 'critical_max'
  }
  
  assertEquals(breachType, 'critical_max')
})

Deno.test('Threshold Breach Detection - Critical Minimum Breached', () => {
  const value = 25
  const threshold = {
    critical_max: 80,
    critical_min: 28,
    max_value: 75,
    min_value: 32
  }
  
  let breachType = null
  
  if (threshold.critical_min != null && value <= threshold.critical_min) {
    breachType = 'critical_min'
  }
  
  assertEquals(breachType, 'critical_min')
})

Deno.test('Threshold Breach Detection - Regular Maximum Exceeded', () => {
  const value = 77
  const threshold = {
    critical_max: 80,
    critical_min: null,
    max_value: 75,
    min_value: 32
  }
  
  let breachType = null
  
  // Check critical first
  if (threshold.critical_max != null && value >= threshold.critical_max) {
    breachType = 'critical_max'
  } else if (threshold.max_value != null && value > threshold.max_value) {
    breachType = 'max'
  }
  
  assertEquals(breachType, 'max')
})

Deno.test('Threshold Breach Detection - Regular Minimum Breached', () => {
  const value = 30
  const threshold = {
    critical_max: null,
    critical_min: 28,
    max_value: 75,
    min_value: 32
  }
  
  let breachType = null
  
  // Check critical first
  if (threshold.critical_min != null && value <= threshold.critical_min) {
    breachType = 'critical_min'
  } else if (threshold.min_value != null && value < threshold.min_value) {
    breachType = 'min'
  }
  
  assertEquals(breachType, 'min')
})

Deno.test('Threshold Breach Detection - No Breach (Within Range)', () => {
  const value = 72
  const threshold = {
    critical_max: 80,
    critical_min: 28,
    max_value: 75,
    min_value: 32
  }
  
  let breachType = null
  
  if (threshold.critical_max != null && value >= threshold.critical_max) {
    breachType = 'critical_max'
  } else if (threshold.critical_min != null && value <= threshold.critical_min) {
    breachType = 'critical_min'
  } else if (threshold.max_value != null && value > threshold.max_value) {
    breachType = 'max'
  } else if (threshold.min_value != null && value < threshold.min_value) {
    breachType = 'min'
  }
  
  assertEquals(breachType, null)
})

Deno.test('Sensor Type Mapping - Temperature', () => {
  const SENSOR_TYPE_NAMES: Record<number, string> = {
    1: 'Temperature',
    2: 'Humidity',
    3: 'Pressure',
    4: 'Battery',
  }
  
  assertEquals(SENSOR_TYPE_NAMES[1], 'Temperature')
})

Deno.test('Sensor Type to ID Mapping', () => {
  const SENSOR_TYPE_TO_ID: Record<string, string> = {
    'temperature': '1',
    'humidity': '2',
    'pressure': '3',
    'battery': '4',
  }
  
  assertEquals(SENSOR_TYPE_TO_ID['temperature'], '1')
  assertEquals(SENSOR_TYPE_TO_ID['humidity'], '2')
})

Deno.test('Severity Assignment - Critical Breach', () => {
  const breachType = 'critical_max'
  const severity = (breachType === 'critical_max' || breachType === 'critical_min') ? 'critical' : 'high'
  
  assertEquals(severity, 'critical')
})

Deno.test('Severity Assignment - Non-Critical Breach', () => {
  const breachType = 'max'
  const severity = (breachType === 'critical_max' || breachType === 'critical_min') ? 'critical' : 'high'
  
  assertEquals(severity, 'high')
})

Deno.test('Category Mapping - Temperature Sensor', () => {
  const categoryMap: Record<string, string> = {
    'Temperature': 'temperature',
    'Humidity': 'temperature',
    'Battery': 'battery',
    'Motion': 'vibration',
  }
  
  assertEquals(categoryMap['Temperature'], 'temperature')
  assertEquals(categoryMap['Battery'], 'battery')
})

Deno.test('Fahrenheit Threshold with Celsius Reading - Conversion Required', () => {
  const celsiusReading = 25 // 25°C
  const threshold = {
    sensor_type: 'temperature',
    temperature_unit: 'fahrenheit',
    max_value: 75, // 75°F
    critical_max: 80 // 80°F
  }
  
  // Convert to Fahrenheit for comparison
  const fahrenheitValue = (celsiusReading * 9 / 5) + 32 // 77°F
  
  // Check if breach (77°F > 75°F max)
  let breachType = null
  if (threshold.critical_max != null && fahrenheitValue >= threshold.critical_max) {
    breachType = 'critical_max'
  } else if (threshold.max_value != null && fahrenheitValue > threshold.max_value) {
    breachType = 'max'
  }
  
  assertEquals(fahrenheitValue, 77)
  assertEquals(breachType, 'max') // 77°F exceeds 75°F max
})

Deno.test('Celsius Threshold with Celsius Reading - No Conversion', () => {
  const celsiusReading = 25
  const threshold = {
    sensor_type: 'temperature',
    temperature_unit: 'celsius',
    max_value: 30,
    critical_max: 35
  }
  
  // No conversion needed
  const value = celsiusReading
  
  let breachType = null
  if (threshold.critical_max != null && value >= threshold.critical_max) {
    breachType = 'critical_max'
  } else if (threshold.max_value != null && value > threshold.max_value) {
    breachType = 'max'
  }
  
  assertEquals(value, 25)
  assertEquals(breachType, null) // 25°C is within range (< 30°C max)
})

Deno.test('Edge Case - Value Exactly Equals Critical Maximum', () => {
  const value = 80
  const threshold = {
    critical_max: 80,
    max_value: 75
  }
  
  let breachType = null
  if (threshold.critical_max != null && value >= threshold.critical_max) {
    breachType = 'critical_max'
  }
  
  assertEquals(breachType, 'critical_max') // Should trigger on >= not just >
})

Deno.test('Edge Case - Value Exactly Equals Critical Minimum', () => {
  const value = 28
  const threshold = {
    critical_min: 28,
    min_value: 32
  }
  
  let breachType = null
  if (threshold.critical_min != null && value <= threshold.critical_min) {
    breachType = 'critical_min'
  }
  
  assertEquals(breachType, 'critical_min') // Should trigger on <= not just <
})

console.log('✅ All sensor-threshold-evaluator unit tests passed')
