'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnalyticsData } from './hooks/useAnalyticsData';
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo';
import {
  AnalyticsHeader,
  SystemHealthCards,
  ProblematicDevicesCard,
  AIForecastingSection,
  TelemetryChartsSection,
  DevicePerformanceTable,
  AlertStatsCards,
} from './components';
import type { TimeRange } from './types/analytics.types';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const { data, loading, exportToCSV, currentOrganization } = useAnalyticsData(timeRange);

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center p-12 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization from the sidebar to view analytics
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <div className="flex items-center gap-3">
            <OrganizationLogo
              settings={currentOrganization?.settings}
              name={currentOrganization?.name || 'NetNeural'}
              size="xl"
            />
            <h2 className="text-3xl font-bold tracking-tight">{currentOrganization.name} AI Analytics</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-8 bg-gray-200 rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <div className="flex items-center gap-3">
            <OrganizationLogo
              settings={currentOrganization?.settings}
              name={currentOrganization?.name || 'NetNeural'}
              size="xl"
            />
            <h2 className="text-3xl font-bold tracking-tight">{currentOrganization.name} AI Analytics</h2>
          </div>
        </div>
        <div className="text-center">
          <p className="text-red-500">Failed to load analytics data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <AnalyticsHeader
        organizationName={currentOrganization.name}
        organizationSettings={currentOrganization.settings}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        onExport={exportToCSV}
      />

      <SystemHealthCards health={data.systemHealth} />

      <ProblematicDevicesCard devices={data.devicePerformance} />

      <AIForecastingSection organizationId={currentOrganization.id} timeRange={timeRange} />

      <TelemetryChartsSection organizationId={currentOrganization.id} timeRange={timeRange} />

      <Tabs defaultValue="devices" className="space-y-4">
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
  );
}
