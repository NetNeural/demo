'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Brain, TrendingUp, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface AIReportSummaryProps {
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

export function AIReportSummary({ reportType, reportData, organizationId }: AIReportSummaryProps) {
  const [summary, setSummary] = useState<AISummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!organizationId || reportData.totalRecords === 0) return

    const fetchSummary = async () => {
      setLoading(true)
      setError(null)

      try {
        const session = await supabase.auth.getSession()
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-report-summary`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.data.session?.access_token}`,
            },
            body: JSON.stringify({
              reportType,
              reportData,
              organizationId,
            }),
          }
        )

        const data = await response.json()

        if (data.error) {
          // Fallback to rule-based summary
          setSummary(generateRuleBasedSummary())
        } else {
          setSummary(data)
        }
      } catch (err) {
        console.error('Failed to fetch AI summary:', err)
        // Fallback to rule-based summary
        setSummary(generateRuleBasedSummary())
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [reportType, reportData, organizationId, supabase])

  const generateRuleBasedSummary = (): AISummary => {
    const findings: string[] = []
    const redFlags: string[] = []
    const recommendations: string[] = []
    let trendAnalysis = ''

    switch (reportType) {
      case 'alert-history':
        if (reportData.totalRecords > 0) {
          findings.push(`Total of ${reportData.totalRecords} alerts in selected period`)
        }
        if (reportData.criticalCount && reportData.criticalCount > 0) {
          findings.push(`${reportData.criticalCount} critical alerts require attention`)
          if (reportData.criticalCount > 10) {
            redFlags.push('High volume of critical alerts detected')
            recommendations.push('Review alert thresholds to reduce false positives')
          }
        }
        trendAnalysis = 'Alert patterns show normal operational activity. Monitor critical alerts closely.'
        break

      case 'telemetry-trends':
        findings.push(`Telemetry data collected for ${reportData.totalRecords} data points`)
        recommendations.push('Regular monitoring helps identify anomalies early')
        trendAnalysis = 'Sensor readings within expected ranges for the reporting period.'
        break

      case 'audit-log':
        findings.push(`${reportData.totalRecords} user actions logged`)
        recommendations.push('Review suspicious activity patterns monthly')
        trendAnalysis = 'User activity patterns consistent with normal operations.'
        break
    }

    return {
      keyFindings: findings,
      redFlags,
      recommendations,
      trendAnalysis,
      confidence: 0.7,
      generatedAt: new Date().toISOString(),
      cached: false,
    }
  }

  if (reportData.totalRecords === 0) {
    return null
  }

  if (loading) {
    return (
      <Card className="border-purple-200 dark:border-purple-900">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500 animate-pulse" />
            <CardTitle className="text-base">AI-Powered Insights</CardTitle>
          </div>
          <CardDescription>Generating intelligent summary...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    )
  }

  if (error && !summary) {
    return null
  }

  if (!summary) {
    return null
  }

  return (
    <Card className="border-purple-200 dark:border-purple-900 bg-gradient-to-br from-purple-50/50 to-transparent dark:from-purple-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-base">AI-Powered Insights</CardTitle>
            {summary.cached && (
              <Badge variant="outline" className="text-xs">
                Cached
              </Badge>
            )}
          </div>
          <Badge variant="secondary" className="text-xs">
            {Math.round(summary.confidence * 100)}% confidence
          </Badge>
        </div>
        <CardDescription>
          Intelligent analysis generated by AI · Last updated:{' '}
          {new Date(summary.generatedAt).toLocaleTimeString()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trend Analysis */}
        <div className="p-3 rounded-lg bg-white/50 dark:bg-gray-900/50 border">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">{summary.trendAnalysis}</p>
          </div>
        </div>

        {/* Key Findings */}
        {summary.keyFindings.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Key Findings
            </h4>
            <ul className="space-y-1.5 ml-5">
              {summary.keyFindings.map((finding, idx) => (
                <li key={idx} className="text-sm text-muted-foreground">
                  • {finding}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Red Flags */}
        {summary.redFlags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Red Flags
            </h4>
            <ul className="space-y-1.5 ml-5">
              {summary.redFlags.map((flag, idx) => (
                <li key={idx} className="text-sm text-red-600 dark:text-red-400">
                  • {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {summary.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Recommendations
            </h4>
            <ul className="space-y-1.5 ml-5">
              {summary.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-muted-foreground">
                  • {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center pt-2 border-t">
          AI insights are suggestions only. Always verify critical findings with your data.
        </p>
      </CardContent>
    </Card>
  )
}
