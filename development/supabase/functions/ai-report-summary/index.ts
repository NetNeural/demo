// AI Report Summary Edge Function
// Generates executive summaries for reports using OpenAI GPT-3.5-turbo
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface ReportData {
  reportType:
    | 'alert_history'
    | 'telemetry_trends'
    | 'audit_log'
    | 'device_health'
  dateRange: string
  totalRecords: number
  data: Record<string, unknown>[]
  organizationId: string
}

interface AIReportSummary {
  keyFindings: string[]
  redFlags: string[]
  recommendations: string[]
  trendAnalysis: string
}

const CACHE_DURATION_MINUTES = 30
const MAX_TOKENS = 600

serve(async (req) => {
  try {
    // CORS
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

    // Check OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.warn('⚠️ OPENAI_API_KEY not configured')
      return new Response(
        JSON.stringify({
          error: 'OpenAI API not configured',
          fallback: true,
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

    const reportData: ReportData = await req.json()
    const { reportType, dateRange, totalRecords, data, organizationId } =
      reportData

    if (totalRecords === 0) {
      return new Response(
        JSON.stringify({
          summary: {
            keyFindings: [],
            redFlags: [],
            recommendations: [],
            trendAnalysis: 'No data available for this report period.',
          },
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check cache
    const cacheKey = `report_summary:${reportType}:${organizationId}:${dateRange}`
    const { data: cached } = await supabase
      .from('ai_insights_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (cached) {
      console.log(`✅ Cache hit for report summary ${reportType}`)
      return new Response(
        JSON.stringify({
          summary: cached.insights,
          cached: true,
          generatedAt: cached.generated_at,
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    console.log(`🤖 Generating AI summary for ${reportType}`)

    // Prepare summary of data
    const dataSummary = prepareReportSummary(reportData)

    // Call OpenAI
    const openaiResponse = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `You are an expert IoT data analyst. Analyze report data and provide:
1. keyFindings: 3-5 key facts (array of strings, max 80 chars each)
2. redFlags: 0-3 critical issues requiring immediate attention (array of strings)
3. recommendations: 3-5 actionable recommendations (array of strings, max 100 chars each)
4. trendAnalysis: Executive summary paragraph (max 200 chars)

Respond ONLY with valid JSON matching this structure.`,
            },
            {
              role: 'user',
              content: `Report Type: ${reportType}
Date Range: ${dateRange}
Total Records: ${totalRecords}

${dataSummary}

Provide executive summary as JSON:
{"keyFindings": [...], "redFlags": [...], "recommendations": [...], "trendAnalysis": "..."}`,
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

    let summary: AIReportSummary
    try {
      summary = JSON.parse(content)
    } catch {
      throw new Error('Invalid JSON response from OpenAI')
    }

    // Validate and sanitize
    summary = {
      keyFindings: (summary.keyFindings || [])
        .slice(0, 5)
        .map((s) => String(s).substring(0, 80)),
      redFlags: (summary.redFlags || [])
        .slice(0, 3)
        .map((s) => String(s).substring(0, 100)),
      recommendations: (summary.recommendations || [])
        .slice(0, 5)
        .map((s) => String(s).substring(0, 100)),
      trendAnalysis: String(summary.trendAnalysis || '').substring(0, 200),
    }

    // Cache the result
    const expiresAt = new Date(
      Date.now() + CACHE_DURATION_MINUTES * 60 * 1000
    ).toISOString()
    await supabase.from('ai_insights_cache').upsert({
      cache_key: cacheKey,
      device_id: null,
      organization_id: organizationId,
      insights: summary,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt,
      token_usage: openaiData.usage?.total_tokens || 0,
    })

    console.log(
      `📊 OpenAI usage: ${openaiData.usage?.total_tokens || 0} tokens`
    )

    return new Response(
      JSON.stringify({
        summary,
        cached: false,
        generatedAt: new Date().toISOString(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        error: String(error),
        fallback: true,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})

function prepareReportSummary(reportData: ReportData): string {
  const { reportType, data } = reportData

  switch (reportType) {
    case 'alert_history': {
      const alerts = data as Array<{
        severity: string
        is_resolved: boolean
        alert_type: string
      }>
      const bySeverity = alerts.reduce(
        (acc, a) => {
          acc[a.severity] = (acc[a.severity] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      const unresolvedCount = alerts.filter((a) => !a.is_resolved).length

      return `Alert Summary:
- Critical: ${bySeverity.critical || 0}
- High: ${bySeverity.high || 0}
- Medium: ${bySeverity.medium || 0}
- Low: ${bySeverity.low || 0}
- Unresolved: ${unresolvedCount}
- Resolution Rate: ${((1 - unresolvedCount / alerts.length) * 100).toFixed(1)}%`
    }

    case 'audit_log': {
      const logs = data as Array<{ action_category: string; status: string }>
      const byCategory = logs.reduce(
        (acc, l) => {
          acc[l.action_category] = (acc[l.action_category] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      const failedCount = logs.filter(
        (l) => l.status === 'failed' || l.status === 'error'
      ).length

      return `Audit Log Summary:
- Total Actions: ${logs.length}
- Failed: ${failedCount}
- Success Rate: ${((1 - failedCount / logs.length) * 100).toFixed(1)}%
- Top Categories: ${Object.entries(byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}(${v})`)
        .join(', ')}`
    }

    case 'telemetry_trends':
      return `Telemetry data analyzed across multiple devices with statistical summaries and threshold comparisons.`

    case 'device_health':
      return `Device fleet health metrics including uptime, connectivity, and performance indicators.`

    default:
      return `Report data with ${data.length} records.`
  }
}
