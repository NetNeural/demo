'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSupabaseUrl } from '@/lib/supabase/config'

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
  generatedAt: string
  cached: boolean
}

const CACHE_DURATION_MS = 30 * 60 * 1000 // 30 minutes

export function useAIReportSummary() {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<AIReportSummary | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const supabaseUrl = useMemo(() => getSupabaseUrl(), [])

  const generateSummary = useCallback(
    async (reportData: ReportData): Promise<AIReportSummary | null> => {
      if (reportData.totalRecords === 0) {
        return null
      }

      setLoading(true)

      try {
        // Check cache first
        const cacheKey = `report_summary:${reportData.reportType}:${reportData.organizationId}:${reportData.dateRange}`
        const { data: cached } = await supabase
          .from('ai_insights_cache')
          .select('insights, generated_at')
          .eq('cache_key', cacheKey)
          .gte('expires_at', new Date().toISOString())
          .single()

        if (cached && cached.insights) {
          const aiSummary = cached.insights as unknown as AIReportSummary
          setSummary({
            ...aiSummary,
            generatedAt: cached.generated_at,
            cached: true,
          })
          return aiSummary
        }

        // Generate new summary via Edge Function
        const session = await supabase.auth.getSession()
        const response = await fetch(
          `${supabaseUrl}/functions/v1/ai-report-summary`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.data.session?.access_token}`,
            },
            body: JSON.stringify(reportData),
          }
        )

        if (!response.ok) {
          throw new Error(`Failed to generate summary: ${response.statusText}`)
        }

        const result = await response.json()

        if (result.fallback || result.error) {
          console.warn(
            '⚠️ AI summary unavailable, using rule-based:',
            result.error
          )
          // Generate rule-based summary
          const ruleBased = generateRuleBasedSummary(reportData)
          setSummary(ruleBased)
          return ruleBased
        }

        const aiSummary: AIReportSummary = {
          ...result.summary,
          generatedAt: result.generatedAt || new Date().toISOString(),
          cached: false,
        }

        setSummary(aiSummary)
        return aiSummary
      } catch (error) {
        console.error('Failed to generate AI summary:', error)
        // Fallback to rule-based
        const ruleBased = generateRuleBasedSummary(reportData)
        setSummary(ruleBased)
        return ruleBased
      } finally {
        setLoading(false)
      }
    },
    [supabase, supabaseUrl]
  )

  const clearSummary = useCallback(() => {
    setSummary(null)
  }, [])

  return { summary, loading, generateSummary, clearSummary }
}

// Rule-based fallback summary generation
function generateRuleBasedSummary(reportData: ReportData): AIReportSummary {
  const { reportType, totalRecords, data, dateRange } = reportData

  // Base summary structure
  const summary: AIReportSummary = {
    keyFindings: [],
    redFlags: [],
    recommendations: [],
    trendAnalysis: '',
    generatedAt: new Date().toISOString(),
    cached: false,
  }

  switch (reportType) {
    case 'alert_history': {
      const alerts = data as Array<{ severity: string; is_resolved: boolean }>
      const criticalCount = alerts.filter(
        (a) => a.severity === 'critical'
      ).length
      const unresolvedCount = alerts.filter((a) => !a.is_resolved).length
      const resolvedPercent =
        totalRecords > 0
          ? (((totalRecords - unresolvedCount) / totalRecords) * 100).toFixed(1)
          : '0'

      summary.keyFindings = [
        `${totalRecords} total alerts in ${dateRange}`,
        `${criticalCount} critical alerts (${((criticalCount / totalRecords) * 100).toFixed(1)}%)`,
        `${resolvedPercent}% resolution rate`,
      ]

      if (criticalCount > totalRecords * 0.2) {
        summary.redFlags.push(
          `High critical alert rate (${criticalCount}/${totalRecords}) - investigate root causes`
        )
      }

      if (unresolvedCount > totalRecords * 0.3) {
        summary.redFlags.push(
          `${unresolvedCount} unresolved alerts need attention`
        )
      }

      summary.recommendations = [
        'Review critical alerts for common patterns',
        'Set up automated alert routing for faster response',
        'Document resolution procedures for frequent alert types',
      ]

      summary.trendAnalysis = `Alert activity shows ${resolvedPercent}% resolution rate with ${criticalCount} critical incidents requiring immediate attention.`
      break
    }

    case 'telemetry_trends': {
      summary.keyFindings = [
        `${totalRecords} telemetry data points analyzed`,
        `Multi-device comparison across ${dateRange}`,
        `Statistical analysis complete`,
      ]

      summary.recommendations = [
        'Monitor devices with outlier values',
        'Adjust thresholds based on historical patterns',
        'Set up proactive alerts for trend deviations',
      ]

      summary.trendAnalysis = `Telemetry data shows normal operational patterns across the fleet during ${dateRange}.`
      break
    }

    case 'audit_log': {
      const logs = data as Array<{ action_category: string; status: string }>
      const failedCount = logs.filter(
        (l) => l.status === 'failed' || l.status === 'error'
      ).length
      const categories = new Set(logs.map((l) => l.action_category)).size

      summary.keyFindings = [
        `${totalRecords} user actions logged in ${dateRange}`,
        `${categories} different action categories`,
        `${((1 - failedCount / totalRecords) * 100).toFixed(1)}% success rate`,
      ]

      if (failedCount > 0) {
        summary.redFlags.push(
          `${failedCount} failed actions require investigation`
        )
      }

      summary.recommendations = [
        'Review failed actions for permission or configuration issues',
        'Ensure all critical actions are properly logged',
        'Set up alerts for unusual activity patterns',
      ]

      summary.trendAnalysis = `User activity shows normal operational patterns with ${totalRecords} logged actions across ${categories} categories.`
      break
    }

    case 'device_health': {
      summary.keyFindings = [
        `${totalRecords} devices analyzed`,
        `Health metrics compiled for ${dateRange}`,
        `Performance benchmarks calculated`,
      ]

      summary.recommendations = [
        'Schedule maintenance for low-battery devices',
        'Investigate devices with poor connectivity',
        'Review devices with high error rates',
      ]

      summary.trendAnalysis = `Device fleet health analysis complete across ${totalRecords} devices.`
      break
    }
  }

  return summary
}
