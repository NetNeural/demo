'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAnalyticsData } from './hooks/useAnalyticsData'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import {
  AnalyticsHeader,
  SystemHealthCards,
  ProblematicDevicesCard,
  AIForecastingSection,
  TelemetryChartsSection,
  DevicePerformanceTable,
  AlertStatsCards,
} from './components'
import {
  SendReportDialog,
  type ReportPayload,
} from '@/components/reports/SendReportDialog'
import type { TimeRange } from './types/analytics.types'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AnalyticsPageContent />
    </Suspense>
  )
}

function AnalyticsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const { data, loading, exportToCSV, currentOrganization } =
    useAnalyticsData(timeRange)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)

  const getReportPayload = useCallback((): ReportPayload => {
    // Sanitize a value for safe CSV inclusion (prevent formula injection)
    const sanitize = (v: string) => {
      if (/^[=+\-@\t\r]/.test(v)) return `'${v}`
      return v.includes(',') || v.includes('"')
        ? `"${v.replace(/"/g, '""')}"`
        : v
    }

    const csvRows = [
      ['Device Performance Report'],
      ['Generated:', new Date().toISOString()],
      ['Organization:', sanitize(currentOrganization?.name || '')],
      ['Time Range:', timeRange],
      [],
      [
        'Device Name',
        'Uptime %',
        'Data Points',
        'Avg Battery %',
        'Avg RSSI',
        'Last Error',
      ],
      ...(data?.devicePerformance.map((d) => [
        sanitize(d.device_name),
        d.uptime_percentage.toFixed(2),
        d.data_points_count.toString(),
        d.avg_battery?.toFixed(2) || 'N/A',
        d.avg_rssi?.toFixed(2) || 'N/A',
        sanitize(d.last_error || 'None'),
      ]) || []),
    ]
    const csvContent = csvRows.map((row) => row.join(',')).join('\n')
    const deviceCount = data?.devicePerformance.length || 0
    const health = data?.systemHealth.overall_health || 0
    return {
      title: 'AI Analytics Report',
      csvContent,
      csvFilename: `analytics-${currentOrganization?.name || 'report'}-${new Date().toISOString().split('T')[0]}.csv`,
      smsSummary: `${deviceCount} devices, ${health}% fleet health, ${data?.alertStats.total_alerts || 0} alerts (${data?.alertStats.critical_alerts || 0} critical). Time range: ${timeRange}.`,
    }
  }, [data, currentOrganization, timeRange])

  // Initialize activeTab from URL parameter or default
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return searchParams.get('tab') || 'devices'
    }
    return 'devices'
  })

  // Update activeTab when URL parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams, activeTab])

  // Handle tab change - update both state and URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization from the sidebar to view analytics
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={currentOrganization?.name || 'NetNeural'}
            size="xl"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {currentOrganization.name} AI Analytics
            </h2>
            <p className="text-muted-foreground">
              AI-powered insights, forecasting, and fleet health
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="mb-2 h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-8 w-1/2 rounded bg-gray-200" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={currentOrganization?.name || 'NetNeural'}
            size="xl"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {currentOrganization.name} AI Analytics
            </h2>
            <p className="text-muted-foreground">
              AI-powered insights, forecasting, and fleet health
            </p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-red-500">Failed to load analytics data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <AnalyticsHeader
        organizationName={currentOrganization.name}
        organizationSettings={currentOrganization.settings}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onExport={exportToCSV}
        onSendReport={() => setSendDialogOpen(true)}
      />

      <SendReportDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        getReportPayload={getReportPayload}
      />

      <SystemHealthCards health={data.systemHealth} />

      <ProblematicDevicesCard devices={data.devicePerformance} />

      <AIForecastingSection
        organizationId={currentOrganization.id}
        timeRange={timeRange}
      />

      <TelemetryChartsSection
        organizationId={currentOrganization.id}
        timeRange={timeRange}
      />

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="devices">Device Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alert Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <DevicePerformanceTable devices={data.devicePerformance} />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertStatsCards stats={data.alertStats} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
