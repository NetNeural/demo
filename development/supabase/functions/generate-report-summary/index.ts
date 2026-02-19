// AI Report Summary Generator Edge Function
// Generates intelligent summaries for reports using OpenAI GPT-3.5-turbo
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

interface ReportSummaryRequest {
  reportType: 'alert-history' | 'telemetry-trends' | 'audit-log'
  reportData: {
    dateRange: string
    totalRecords: number
    criticalCount?: number
    metadata?: Record<string, unknown>
  }
  organizationId: string
}

interface AISummary {
  keyFindings: string[]
  redFlags: string[]
  recommendations: string[]
  trendAnalysis: string
  confidence: number
  generatedAt: string
  cached?: boolean
}

const CACHE_DURATION_MINUTES = 30 // Cache summaries for 30 minutes
const MAX_TOKENS = 400

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.warn('⚠️ OPENAI_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'AI not configured', fallback: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const requestData: ReportSummaryRequest = await req.json()
    const { reportType, reportData, organizationId } = requestData

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check cache
    const cacheKey = `report_summary:${reportType}:${organizationId}:${reportData.dateRange}`
    const { data: cached } = await supabase
      .from('ai_report_summaries_cache')
      .select('*')
      .eq('report_type', reportType)
      .eq('organization_id', organizationId)
      .gte('expires_at', new Date().toISOString())
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (cached) {
      console.log(`✅ Cache hit for report summary ${reportType}`)
      return new Response(JSON.stringify({ ...cached.summary, cached: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    console.log(`🤖 Generating AI summary for ${reportType} report`)

    // Prepare prompt based on report type
    const prompt = generatePrompt(reportType, reportData)

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert IoT data analyst. Generate concise report summaries in JSON format with:
- keyFindings: array of 2-3 key insights (max 100 chars each)
- redFlags: array of 0-2 critical issues (max 100 chars each)  
- recommendations: array of 2-3 actionable items (max 120 chars each)
- trendAnalysis: one paragraph summary (max 200 chars)
- confidence: 0-1 score

Be specific, actionable, and data-driven.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`)
    }

    const openaiData = await openaiResponse.json()
    const content = openaiData.choices[0].message.content

    let summary: AISummary
    try {
      const parsed = JSON.parse(content)
      summary = {
        keyFindings: (parsed.keyFindings || []).slice(0, 3),
        redFlags: (parsed.redFlags || []).slice(0, 2),
        recommendations: (parsed.recommendations || []).slice(0, 3),
        trendAnalysis: (parsed.trendAnalysis || '').substring(0, 200),
        confidence: parsed.confidence || 0.8,
        generatedAt: new Date().toISOString(),
      }
    } catch {
      summary = {
        keyFindings: ['Report generated successfully'],
        redFlags: [],
        recommendations: ['Continue monitoring'],
        trendAnalysis: content.substring(0, 200),
        confidence: 0.7,
        generatedAt: new Date().toISOString(),
      }
    }

    // Cache the result
    const expiresAt = new Date(Date.now() + CACHE_DURATION_MINUTES * 60 * 1000).toISOString()
    await supabase.from('ai_report_summaries_cache').insert({
      report_type: reportType,
      organization_id: organizationId,
      summary: summary,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt,
      token_usage: openaiData.usage?.total_tokens || 0,
    })

    console.log(`📊 OpenAI usage: ${openaiData.usage?.total_tokens || 0} tokens`)

    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (error) {
    console.error('[generate-report-summary] Error:', error)
    return new Response(JSON.stringify({ error: error.message, fallback: true }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})

function generatePrompt(reportType: string, reportData: any): string {
  switch (reportType) {
    case 'alert-history':
      return `Analyze this Alert History Report:

Date Range: ${reportData.dateRange}
Total Alerts: ${reportData.totalRecords}
Critical Alerts: ${reportData.criticalCount || 0}

Generate summary as JSON with keyFindings, redFlags, recommendations, trendAnalysis, confidence.`

    case 'telemetry-trends':
      return `Analyze this Telemetry Trends Report:

Date Range: ${reportData.dateRange}
Total Data Points: ${reportData.totalRecords}
Devices: ${reportData.metadata?.deviceCount || 'Multiple'}

Generate summary as JSON with keyFindings, redFlags, recommendations, trendAnalysis, confidence.`

    case 'audit-log':
      return `Analyze this Audit Log Report:

Date Range: ${reportData.dateRange}
Total Actions: ${reportData.totalRecords}
Failed Actions: ${reportData.metadata?.failedCount || 0}

Generate summary as JSON with keyFindings, redFlags, recommendations, trendAnalysis, confidence.`

    default:
      return `Analyze this report (type: ${reportType}) with ${reportData.totalRecords} records in ${reportData.dateRange}. Generate JSON summary.`
  }
}
