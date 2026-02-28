// AI Insights Edge Function - OpenAI Integration
// Provides real AI-powered predictive analysis for IoT sensor data
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface TelemetryReading {
  telemetry: {
    value?: number
    type?: number
    sensor?: string
    [key: string]: unknown
  }
  device_timestamp: string | null
  received_at: string
}

interface AIInsightRequest {
  deviceId: string
  deviceName: string
  installedAt?: string
  telemetryReadings: TelemetryReading[]
  temperatureUnit: 'celsius' | 'fahrenheit'
  organizationId: string
}

interface AIInsight {
  type: 'normal' | 'warning' | 'critical' | 'info'
  title: string
  message: string
  confidence?: number
}

interface CachedInsight {
  insights: AIInsight[]
  generated_at: string
  expires_at: string
}

const CACHE_DURATION_MINUTES = 15 // Cache AI insights for 15 minutes
const MAX_TOKENS = 500 // Limit response length to control costs

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers':
            'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Verify we have OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.warn(
        '⚠️ OPENAI_API_KEY not configured - returning fallback insights'
      )
      return new Response(
        JSON.stringify({
          error: 'OpenAI API not configured',
          fallback: true,
          insights: [],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Get request data
    const requestData: AIInsightRequest = await req.json()
    const {
      deviceId,
      deviceName,
      installedAt,
      telemetryReadings,
      temperatureUnit,
      organizationId,
    } = requestData

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // --- Tier-based AI gating ---
    // Look up the org's billing plan and verify AI features are enabled
    const { data: org } = await supabase
      .from('organizations')
      .select('billing_plan_id')
      .eq('id', organizationId)
      .single()

    if (org?.billing_plan_id) {
      const { data: plan } = await supabase
        .from('billing_plans')
        .select('features, slug')
        .eq('id', org.billing_plan_id)
        .single()

      if (plan && !plan.features?.ai_analytics) {
        console.log(
          `🚫 AI insights blocked for org ${organizationId} — plan "${plan.slug}" does not include AI`
        )
        return new Response(
          JSON.stringify({
            error: 'AI features are not available on your current plan',
            upgrade_required: true,
            insights: [],
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        )
      }
    }

    // Check cache first
    const cacheKey = `ai_insights:${deviceId}:${telemetryReadings.length}`
    const { data: cached } = await supabase
      .from('ai_insights_cache')
      .select('*')
      .eq('device_id', deviceId)
      .eq('organization_id', organizationId)
      .gte('expires_at', new Date().toISOString())
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached) {
      console.log(`✅ Cache hit for device ${deviceId}`)
      return new Response(
        JSON.stringify({
          insights: cached.insights,
          cached: true,
          generated_at: cached.generated_at,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    console.log(`🤖 Generating new AI insights for device ${deviceId}`)

    // Prepare data summary for OpenAI
    const dataSummary = prepareTelemetrySummary(
      telemetryReadings,
      temperatureUnit
    )

    // Call OpenAI API
    const openaiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo', // Cost-efficient model
          messages: [
            {
              role: 'system',
              content: `You are an expert IoT sensor analyst. Analyze sensor data and provide 2-4 actionable insights in JSON format. Each insight should have:
- type: "critical" | "warning" | "normal" | "info"
- title: Brief title (max 50 chars)
- message: Actionable recommendation (max 150 chars)
- confidence: 0-1 score

Focus on: anomalies, trends, predictions, maintenance needs, and efficiency improvements.`,
            },
            {
              role: 'user',
              content: `Analyze this ${installedAt || 'sensor'} data for "${deviceName}":

${dataSummary}

Provide insights as JSON array: [{"type": "...", "title": "...", "message": "...", "confidence": 0.X}]`,
            },
          ],
          max_tokens: MAX_TOKENS,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
      }
    )

    if (!openaiResponse.ok) {
      const error = await openaiResponse.text()
      console.error('OpenAI API error:', error)
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices[0].message.content

    // Parse AI response
    let insights: AIInsight[]
    try {
      const parsed = JSON.parse(content)
      insights = parsed.insights || parsed // Handle both {"insights": [...]} and [...]
    } catch {
      // Fallback: extract insights from text
      insights = [
        {
          type: 'info',
          title: 'AI Analysis Complete',
          message: content.substring(0, 150),
          confidence: 0.8,
        },
      ]
    }

    // Validate and sanitize insights
    insights = insights
      .filter((i) => i.type && i.title && i.message)
      .slice(0, 4) // Max 4 insights
      .map((i) => ({
        type: i.type,
        title: i.title.substring(0, 50),
        message: i.message.substring(0, 150),
        confidence: i.confidence || 0.8,
      }))

    // Cache the results
    const expiresAt = new Date(
      Date.now() + CACHE_DURATION_MINUTES * 60 * 1000
    ).toISOString()
    await supabase.from('ai_insights_cache').upsert({
      device_id: deviceId,
      organization_id: organizationId,
      insights: insights,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt,
      token_usage: openaiData.usage?.total_tokens || 0,
    })

    // Log usage for cost tracking
    console.log(
      `📊 OpenAI usage: ${openaiData.usage?.total_tokens || 0} tokens`
    )

    return new Response(
      JSON.stringify({
        insights,
        cached: false,
        generated_at: new Date().toISOString(),
        token_usage: openaiData.usage?.total_tokens,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    // Degrade silently — AI insights are non-critical, don't surface 500 to the browser
    console.error('AI Insights error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        fallback: true,
        insights: [],
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})

// Helper function to prepare telemetry summary
function prepareTelemetrySummary(
  readings: TelemetryReading[],
  unit: string
): string {
  if (readings.length === 0) return 'No telemetry data available'

  // Group by sensor type
  const sensorGroups: Record<string, number[]> = {}

  for (const reading of readings) {
    const sensorKey =
      reading.telemetry.sensor || `type_${reading.telemetry.type}` || 'unknown'
    const value = reading.telemetry.value

    if (value != null) {
      if (!sensorGroups[sensorKey]) sensorGroups[sensorKey] = []
      sensorGroups[sensorKey].push(value)
    }
  }

  // Calculate statistics for each sensor
  const summary: string[] = []
  const now = Date.now()
  const oldestReading = readings[readings.length - 1]
  const timespan = oldestReading?.received_at
    ? Math.round(
        (now - new Date(oldestReading.received_at).getTime()) / (1000 * 60)
      )
    : 0

  summary.push(`Data: ${readings.length} readings over ${timespan} minutes`)

  for (const [sensor, values] of Object.entries(sensorGroups)) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)
    const current = values[0]

    // Calculate trend
    const halfPoint = Math.floor(values.length / 2)
    const recentAvg =
      values.slice(0, halfPoint).reduce((a, b) => a + b, 0) / halfPoint
    const olderAvg =
      values.slice(halfPoint).reduce((a, b) => a + b, 0) /
      (values.length - halfPoint)
    const trendPct = (((recentAvg - olderAvg) / olderAvg) * 100).toFixed(1)
    const trend =
      Math.abs(parseFloat(trendPct)) > 5 ? (trendPct > 0 ? '↑' : '↓') : '→'

    const unitStr = sensor.includes('temp')
      ? `°${unit === 'fahrenheit' ? 'F' : 'C'}`
      : sensor.includes('humidity')
        ? '%'
        : sensor.includes('pressure')
          ? ' hPa'
          : ''

    summary.push(
      `${sensor}: Current ${current.toFixed(1)}${unitStr} | Avg ${avg.toFixed(1)} | Range ${min.toFixed(1)}-${max.toFixed(1)} | Trend ${trend}${trendPct}%`
    )
  }

  return summary.join('\n')
}
