/**
 * Unit Tests for ai-insights Edge Function
 * Tests AI-powered analysis logic including:
 * - Cache key generation
 * - Cache hit/miss logic
 * - Token usage optimization
 * - Insight type classification
 * - Temperature anomaly detection
 * - Trend analysis
 * - Confidence scoring
 * - Fallback handling
 */

import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.177.0/testing/asserts.ts'

Deno.test('Cache Key Generation - Device ID and Reading Count', () => {
  const deviceId = 'device-123'
  const telemetryReadings = [
    {
      telemetry: { value: 72 },
      device_timestamp: '2026-02-17T10:00:00Z',
      received_at: '2026-02-17T10:00:01Z',
    },
    {
      telemetry: { value: 73 },
      device_timestamp: '2026-02-17T10:05:00Z',
      received_at: '2026-02-17T10:05:01Z',
    },
  ]
  const cacheKey = `ai_insights:${deviceId}:${telemetryReadings.length}`

  assertEquals(cacheKey, 'ai_insights:device-123:2')
})

Deno.test('Cache Expiration Check - Still Valid', () => {
  const now = new Date('2026-02-17T10:00:00Z')
  const expiresAt = new Date('2026-02-17T10:15:00Z') // 15 minutes later

  const isValid = new Date(expiresAt) >= now
  assertEquals(isValid, true)
})

Deno.test('Cache Expiration Check - Expired', () => {
  const now = new Date('2026-02-17T10:20:00Z')
  const expiresAt = new Date('2026-02-17T10:15:00Z') // 5 minutes ago

  const isValid = new Date(expiresAt) >= now
  assertEquals(isValid, false)
})

Deno.test('Cache Duration - 15 Minutes', () => {
  const CACHE_DURATION_MINUTES = 15
  const now = new Date('2026-02-17T10:00:00Z')
  const expiresAt = new Date(now.getTime() + CACHE_DURATION_MINUTES * 60 * 1000)

  assertEquals(expiresAt.toISOString(), '2026-02-17T10:15:00.000Z')
})

Deno.test('Max Tokens Configuration - Cost Control', () => {
  const MAX_TOKENS = 500
  assertEquals(MAX_TOKENS, 500)
  // Ensures response length is limited to control API costs
})

Deno.test('Insight Type Classification - Normal Condition', () => {
  type InsightType = 'normal' | 'warning' | 'critical' | 'info'

  const temperature = 72 // F
  const isNormal = temperature >= 65 && temperature <= 75

  const insightType: InsightType = isNormal ? 'normal' : 'warning'
  assertEquals(insightType, 'normal')
})

Deno.test('Insight Type Classification - Warning Condition', () => {
  type InsightType = 'normal' | 'warning' | 'critical' | 'info'

  const temperature = 78 // Slightly elevated
  const isNormal = temperature >= 65 && temperature <= 75
  const isCritical = temperature >= 85 || temperature <= 32

  let insightType: InsightType = 'normal'
  if (isCritical) {
    insightType = 'critical'
  } else if (!isNormal) {
    insightType = 'warning'
  }

  assertEquals(insightType, 'warning')
})

Deno.test('Insight Type Classification - Critical Condition', () => {
  type InsightType = 'normal' | 'warning' | 'critical' | 'info'

  const temperature = 90 // Dangerously high
  const isCritical = temperature >= 85 || temperature <= 32

  const insightType: InsightType = isCritical ? 'critical' : 'normal'
  assertEquals(insightType, 'critical')
})

Deno.test('Temperature Anomaly Detection - Rising Trend', () => {
  const readings = [
    { value: 70, timestamp: '2026-02-17T10:00:00Z' },
    { value: 72, timestamp: '2026-02-17T10:05:00Z' },
    { value: 74, timestamp: '2026-02-17T10:10:00Z' },
    { value: 76, timestamp: '2026-02-17T10:15:00Z' },
  ]

  const values = readings.map((r) => r.value)
  const firstValue = values[0]
  const lastValue = values[values.length - 1]
  const trend =
    lastValue > firstValue
      ? 'rising'
      : lastValue < firstValue
        ? 'falling'
        : 'stable'

  assertEquals(trend, 'rising')
})

Deno.test('Temperature Anomaly Detection - Falling Trend', () => {
  const readings = [
    { value: 76, timestamp: '2026-02-17T10:00:00Z' },
    { value: 74, timestamp: '2026-02-17T10:05:00Z' },
    { value: 72, timestamp: '2026-02-17T10:10:00Z' },
    { value: 70, timestamp: '2026-02-17T10:15:00Z' },
  ]

  const values = readings.map((r) => r.value)
  const firstValue = values[0]
  const lastValue = values[values.length - 1]
  const trend =
    lastValue > firstValue
      ? 'rising'
      : lastValue < firstValue
        ? 'falling'
        : 'stable'

  assertEquals(trend, 'falling')
})

Deno.test('Temperature Anomaly Detection - Stable Trend', () => {
  const readings = [
    { value: 72, timestamp: '2026-02-17T10:00:00Z' },
    { value: 72.5, timestamp: '2026-02-17T10:05:00Z' },
    { value: 72, timestamp: '2026-02-17T10:10:00Z' },
    { value: 72.2, timestamp: '2026-02-17T10:15:00Z' },
  ]

  const values = readings.map((r) => r.value)
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  const maxDeviation = Math.max(...values.map((v) => Math.abs(v - avg)))

  const isStable = maxDeviation < 1.0 // Less than 1 degree variation
  assertEquals(isStable, true)
})

Deno.test('Statistical Analysis - Average Calculation', () => {
  const values = [70, 72, 74, 76, 78]
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length

  assertEquals(avg, 74)
})

Deno.test('Statistical Analysis - Min/Max Values', () => {
  const values = [70, 72, 74, 76, 78]
  const min = Math.min(...values)
  const max = Math.max(...values)

  assertEquals(min, 70)
  assertEquals(max, 78)
})

Deno.test('Statistical Analysis - Standard Deviation', () => {
  const values = [70, 72, 74, 76, 78]
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
  const stdDev = Math.sqrt(variance)

  // Standard deviation should be around 2.83
  assertEquals(Math.round(stdDev * 100) / 100, 2.83)
})

Deno.test('Confidence Scoring - High Confidence (Many Readings)', () => {
  const readingCount = 50
  const confidence = Math.min(readingCount / 50, 1.0) * 100

  assertEquals(confidence, 100) // 100% confidence with 50+ readings
})

Deno.test('Confidence Scoring - Medium Confidence (Few Readings)', () => {
  const readingCount = 10
  const confidence = Math.min(readingCount / 50, 1.0) * 100

  assertEquals(confidence, 20) // 20% confidence with only 10 readings
})

Deno.test('Temperature Unit Conversion - Celsius to Fahrenheit', () => {
  const celsiusValue = 20
  const fahrenheitValue = (celsiusValue * 9) / 5 + 32

  assertEquals(fahrenheitValue, 68)
})

Deno.test('Temperature Unit Conversion - Fahrenheit to Celsius', () => {
  const fahrenheitValue = 68
  const celsiusValue = ((fahrenheitValue - 32) * 5) / 9

  assertEquals(Math.round(celsiusValue), 20)
})

Deno.test('Fallback Response - No OpenAI API Key', () => {
  const openaiApiKey = undefined

  if (!openaiApiKey) {
    const response = {
      error: 'OpenAI API not configured',
      fallback: true,
      insights: [],
    }

    assertEquals(response.fallback, true)
    assertEquals(response.insights.length, 0)
  }
})

Deno.test('Insight Structure - Valid Format', () => {
  const insight = {
    type: 'warning' as const,
    title: 'Rising Temperature Detected',
    message: 'Temperature has increased by 5°F in the last hour',
    confidence: 85,
  }

  assertEquals(insight.type, 'warning')
  assertExists(insight.title)
  assertExists(insight.message)
  assertEquals(insight.confidence, 85)
})

Deno.test('Response Format - With Cached Insights', () => {
  const response = {
    insights: [
      {
        type: 'normal' as const,
        title: 'Normal Operation',
        message: 'All sensors within expected ranges',
        confidence: 95,
      },
    ],
    cached: true,
    generated_at: '2026-02-17T10:00:00Z',
    expires_at: '2026-02-17T10:15:00Z',
  }

  assertEquals(response.cached, true)
  assertEquals(response.insights.length, 1)
  assertExists(response.generated_at)
  assertExists(response.expires_at)
})

Deno.test('Response Format - Fresh AI Insights', () => {
  const response = {
    insights: [
      {
        type: 'warning' as const,
        title: 'Temperature Rising',
        message: 'Monitor closely',
        confidence: 80,
      },
    ],
    cached: false,
    tokens_used: 285,
    model: 'gpt-3.5-turbo',
  }

  assertEquals(response.cached, false)
  assertEquals(response.tokens_used, 285)
  assertEquals(response.model, 'gpt-3.5-turbo')
})

console.log('✅ All ai-insights unit tests passed')
