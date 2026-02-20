/**
 * Shared telemetry utilities for extracting metric values from various
 * telemetry JSON formats stored in the database.
 *
 * Golioth devices store telemetry as: { type: "1", value: 23.5, sensor: "temp", units: 1 }
 * MQTT listener normalizes to flat keys: { temperature: 23.5, humidity: 45.2 }
 * Some devices use nested env: { env: { temp: 23.5 } }
 */

// Maps metric names to Golioth sensor type IDs
export const METRIC_TO_SENSOR_TYPE: Record<string, string[]> = {
  temperature: ['1'],
  humidity: ['2'],
  pressure: ['3'],
  battery: ['4'],
  rssi: [], // RSSI typically comes via flat key or connectivity data
  co2: ['7'],
  tvoc: ['8'],
  light: ['9'],
  motion: ['10'],
}

// Maps metric names to short sensor name aliases used in Golioth payloads
export const METRIC_TO_SENSOR_NAMES: Record<string, string[]> = {
  temperature: ['temp', 'temperature'],
  humidity: ['hum', 'humidity'],
  battery: ['bat', 'battery', 'battery_level'],
  rssi: ['rssi', 'signal_strength'],
  pressure: ['press', 'pressure'],
  co2: ['co2'],
  tvoc: ['tvoc'],
  light: ['light', 'lux'],
  motion: ['motion'],
}

/**
 * Extract a metric value from a telemetry JSON object.
 * Supports multiple data formats:
 * 1. Flat key: { temperature: 23.5 } → looks up telemetry[metric]
 * 2. Golioth sensor format: { type: "1", value: 23.5, sensor: "temp" }
 * 3. Nested env format: { env: { temp: 23.5 } }
 * 4. Alternative flat key aliases: { temp: 23.5 } when looking for "temperature"
 */
export function extractMetricValue(
  telemetry: Record<string, unknown> | null | undefined,
  metric: string
): number | null {
  if (!telemetry) return null

  // 1. Direct flat key match (e.g. telemetry.temperature)
  const directValue = telemetry[metric]
  if (directValue !== undefined && directValue !== null) {
    const num = parseFloat(String(directValue))
    if (!isNaN(num)) return num
  }

  // 2. Golioth sensor type format: { type: "1", value: 23.5 }
  const sensorTypeIds = METRIC_TO_SENSOR_TYPE[metric] || []
  const telemetryType = String(telemetry.type ?? '')
  if (sensorTypeIds.includes(telemetryType) && telemetry.value !== undefined) {
    const num = parseFloat(String(telemetry.value))
    if (!isNaN(num)) return num
  }

  // 3. Golioth sensor name format: { sensor: "temp", value: 23.5 }
  const sensorNames = METRIC_TO_SENSOR_NAMES[metric] || []
  const sensorField = String(telemetry.sensor ?? '').toLowerCase()
  if (sensorNames.includes(sensorField) && telemetry.value !== undefined) {
    const num = parseFloat(String(telemetry.value))
    if (!isNaN(num)) return num
  }

  // 4. Nested env format: { env: { temp: 23.5 } }
  if (typeof telemetry.env === 'object' && telemetry.env !== null) {
    const env = telemetry.env as Record<string, unknown>
    for (const alias of [metric, ...(METRIC_TO_SENSOR_NAMES[metric] || [])]) {
      const val = env[alias]
      if (val !== undefined && val !== null) {
        const num = parseFloat(String(val))
        if (!isNaN(num)) return num
      }
    }
  }

  // 5. Check alternative flat key aliases
  for (const alias of METRIC_TO_SENSOR_NAMES[metric] || []) {
    const val = telemetry[alias]
    if (val !== undefined && val !== null) {
      const num = parseFloat(String(val))
      if (!isNaN(num)) return num
    }
  }

  return null
}
