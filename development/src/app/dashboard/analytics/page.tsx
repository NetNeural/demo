'use client'

import { useState, useEffect } from 'react'
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
import type { TimeRange } from './types/analytics.types'

export default function AnalyticsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const { data, loading, exportToCSV, currentOrganization } =
    useAnalyticsData(timeRange)

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
