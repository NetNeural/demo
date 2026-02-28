// ===========================================================================
// Edge Function: threshold-ai-recommend
// ===========================================================================
// Analyzes historical telemetry data to recommend optimal threshold ranges.
// Uses statistical analysis (mean ± standard deviations) to calculate
// warning and critical boundaries based on observed sensor behavior.
// ===========================================================================

import {
  createEdgeFunction,
  createSuccessResponse,
  DatabaseError,
} from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { getUserContext } from '../_shared/auth.ts'

// Sensor type name to telemetry type ID mapping
const SENSOR_TYPE_TO_ID: Record<string, string> = {
  temperature: '1',
  humidity: '2',
  pressure: '3',
  battery: '4',
  co2: '7',
  tvoc: '8',
  light: '9',
  motion: '10',
}

// Minimum number of data points needed for reliable recommendations
const MIN_DATA_POINTS = 50

// How many days of history to analyze
const ANALYSIS_WINDOW_DAYS = 30

interface RecommendationResult {
  available: boolean
  data_points: number
  analysis_window_days: number
  earliest_reading: string | null
  latest_reading: string | null
  statistics: {
    mean: number
    stddev: number
    min_observed: number
    max_observed: number
    p5: number // 5th percentile
    p95: number // 95th percentile
  } | null
  recommended: {
    min_value: number
    max_value: number
    critical_min: number
    critical_max: number
    temperature_unit?: string
  } | null
  message: string
}

export default createEdgeFunction(async ({ req }) => {
  const userContext = await getUserContext(req)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  if (req.method !== 'GET') {
    throw new Error('Only GET method is supported')
  }

  const url = new URL(req.url)
  const deviceId = url.searchParams.get('device_id')
  const sensorType = url.searchParams.get('sensor_type')
  const temperatureUnit = url.searchParams.get('temperature_unit') || 'celsius'

  if (!deviceId || !sensorType) {
    throw new Error('device_id and sensor_type are required')
  }

  console.log(
    `[threshold-ai-recommend] Analyzing telemetry for device=${deviceId}, sensor=${sensorType}, unit=${temperatureUnit}`
  )

  // Resolve sensor type to telemetry type ID
  const sensorTypeId = SENSOR_TYPE_TO_ID[sensorType.toLowerCase()] || sensorType

  // Query historical telemetry data
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - ANALYSIS_WINDOW_DAYS)

  const { data: readings, error: readingsError } = await supabaseAdmin
    .from('device_telemetry_history')
    .select('telemetry, received_at')
    .eq('device_id', deviceId)
    .eq('telemetry->>type', sensorTypeId)
    .gte('received_at', cutoffDate.toISOString())
    .order('received_at', { ascending: true })

  if (readingsError) {
    throw new DatabaseError(
      `Failed to fetch telemetry: ${readingsError.message}`
    )
  }

  // Not enough data
  if (!readings || readings.length < MIN_DATA_POINTS) {
    const result: RecommendationResult = {
      available: false,
      data_points: readings?.length || 0,
      analysis_window_days: ANALYSIS_WINDOW_DAYS,
      earliest_reading: readings?.[0]?.received_at || null,
      latest_reading: readings?.[readings.length - 1]?.received_at || null,
      statistics: null,
      recommended: null,
      message:
        readings?.length === 0
          ? `No telemetry data found for this sensor. Once the device begins reporting data, AI recommendations will become available after ${MIN_DATA_POINTS} readings are collected.`
          : `Only ${readings.length} data points available (need at least ${MIN_DATA_POINTS}). Continue collecting data — AI recommendations will be available soon.`,
    }
    return createSuccessResponse(result)
  }

  // Extract values (telemetry is always in Celsius for temperature)
  const rawValues: number[] = readings
    .map((r: any) => {
      const val =
        typeof r.telemetry === 'string' ? JSON.parse(r.telemetry) : r.telemetry
      return Number(val.value)
    })
    .filter((v: number) => !isNaN(v) && isFinite(v))

  if (rawValues.length < MIN_DATA_POINTS) {
    const result: RecommendationResult = {
      available: false,
      data_points: rawValues.length,
      analysis_window_days: ANALYSIS_WINDOW_DAYS,
      earliest_reading: readings[0]?.received_at || null,
      latest_reading: readings[readings.length - 1]?.received_at || null,
      statistics: null,
      recommended: null,
      message: `Only ${rawValues.length} valid readings found. Need at least ${MIN_DATA_POINTS} for reliable recommendations.`,
    }
    return createSuccessResponse(result)
  }

  // Convert to target unit if needed
  let values = rawValues
  if (
    sensorType.toLowerCase() === 'temperature' &&
    temperatureUnit === 'fahrenheit'
  ) {
    values = rawValues.map((v) => (v * 9) / 5 + 32)
  }

  // Calculate statistics
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const mean = values.reduce((sum, v) => sum + v, 0) / n
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1)
  const stddev = Math.sqrt(variance)
  const minObserved = sorted[0]
  const maxObserved = sorted[n - 1]

  // Percentiles (linear interpolation)
  const percentile = (p: number): number => {
    const idx = (p / 100) * (n - 1)
    const lower = Math.floor(idx)
    const upper = Math.ceil(idx)
    if (lower === upper) return sorted[lower]
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
  }

  const p5 = percentile(5)
  const p95 = percentile(95)

  // Calculate recommended thresholds using statistical approach:
  // Warning range: mean ± 2 standard deviations (covers ~95% of normal)
  // Critical range: mean ± 3 standard deviations (covers ~99.7% of normal)
  // Also bounded by observed data with margin

  const warningMin = roundTo2(Math.min(mean - 2 * stddev, p5))
  const warningMax = roundTo2(Math.max(mean + 2 * stddev, p95))
  const criticalMin = roundTo2(mean - 3 * stddev)
  const criticalMax = roundTo2(mean + 3 * stddev)

  // Ensure hierarchy: critical_min ≤ warning_min ≤ warning_max ≤ critical_max
  const finalCritMin = Math.min(criticalMin, warningMin)
  const finalCritMax = Math.max(criticalMax, warningMax)

  const statistics = {
    mean: roundTo2(mean),
    stddev: roundTo2(stddev),
    min_observed: roundTo2(minObserved),
    max_observed: roundTo2(maxObserved),
    p5: roundTo2(p5),
    p95: roundTo2(p95),
  }

  const recommended = {
    min_value: warningMin,
    max_value: warningMax,
    critical_min: finalCritMin,
    critical_max: finalCritMax,
    ...(sensorType.toLowerCase() === 'temperature'
      ? { temperature_unit: temperatureUnit }
      : {}),
  }

  console.log(`[threshold-ai-recommend] Analysis complete:`, {
    data_points: n,
    statistics,
    recommended,
  })

  const result: RecommendationResult = {
    available: true,
    data_points: n,
    analysis_window_days: ANALYSIS_WINDOW_DAYS,
    earliest_reading: readings[0]?.received_at,
    latest_reading: readings[readings.length - 1]?.received_at,
    statistics,
    recommended,
    message: `Analyzed ${n} data points over the last ${ANALYSIS_WINDOW_DAYS} days. Warning range set at ±2σ from mean, critical range at ±3σ.`,
  }

  return createSuccessResponse(result)
})

function roundTo2(val: number): number {
  return Math.round(val * 100) / 100
}
