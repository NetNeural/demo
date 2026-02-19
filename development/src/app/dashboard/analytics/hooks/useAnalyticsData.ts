'use client';

import { useEffect, useState, useCallback } from 'react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { createClient } from '@/lib/supabase/client';
import { extractMetricValue } from '@/lib/telemetry-utils';
import type {
  AnalyticsData,
  Device,
  DevicePerformance,
  TimeRange,
} from '../types/analytics.types';
import { getTimeRangeHours } from '../types/analytics.types';

const EMPTY_DATA: AnalyticsData = {
  devicePerformance: [],
  alertStats: {
    total_alerts: 0,
    critical_alerts: 0,
    high_alerts: 0,
    medium_alerts: 0,
    low_alerts: 0,
    resolved_alerts: 0,
    pending_alerts: 0,
  },
  systemHealth: {
    overall_health: 0,
    connectivity_rate: 0,
    error_rate: 0,
    performance_score: 0,
    avg_battery_health: 0,
    avg_data_collection_rate: 0,
  },
};

export function useAnalyticsData(timeRange: TimeRange) {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!currentOrganization) {
      setLoading(false);
      return;
    }

    async function fetchAnalytics() {
      try {
        setLoading(true);
        if (!currentOrganization) return;

        const hours = getTimeRangeHours(timeRange);
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        // Fetch devices directly via Supabase (more reliable than edge function for analytics)
        const { data: devicesData, error: devicesError } = await supabase
          .from('devices')
          .select('id, name, status, last_seen, serial_number, device_type, metadata, organization_id')
          .eq('organization_id', currentOrganization.id)
          .order('name');

        if (devicesError) {
          console.error('[Analytics] Devices fetch error:', devicesError);
          throw new Error('Failed to fetch devices data');
        }

        const devices: Device[] = (devicesData as unknown as Device[]) || [];

        // Fetch alerts
        const { data: alertData, error: alertError } = await supabase
          .from('alerts')
          .select('id, severity, is_resolved, resolved_at, created_at')
          .eq('organization_id', currentOrganization.id)
          .gte('created_at', startTime);

        if (alertError) console.error('[Analytics] Alert fetch error:', alertError);

        const alerts = alertData || [];
        const totalAlerts = alerts.length;
        const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
        const highAlerts = alerts.filter(a => a.severity === 'high').length;
        const mediumAlerts = alerts.filter(a => a.severity === 'medium').length;
        const lowAlerts = alerts.filter(a => a.severity === 'low').length;
        const resolvedAlerts = alerts.filter(a => a.is_resolved).length;
        const pendingAlerts = totalAlerts - resolvedAlerts;

        // Fetch acknowledgement data for response times
        const { data: ackData } = await supabase
          .from('alert_acknowledgements')
          .select('alert_id, acknowledged_at, alerts!inner(created_at, resolved_at)')
          .eq('alerts.organization_id', currentOrganization.id)
          .gte('alerts.created_at', startTime);

        const avgResponseTime =
          ackData && ackData.length > 0
            ? ackData.reduce((sum, ack) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const a = ack.alerts as any;
                if (!a?.created_at) return sum;
                return sum + (new Date(ack.acknowledged_at).getTime() - new Date(a.created_at).getTime()) / 60000;
              }, 0) / ackData.length
            : undefined;

        const resolvedAlertsWithTime = alerts.filter(a => a.resolved_at && a.is_resolved && a.created_at);
        const avgResolutionTime =
          resolvedAlertsWithTime.length > 0
            ? resolvedAlertsWithTime.reduce((sum, a) => {
                if (!a.resolved_at || !a.created_at) return sum;
                return sum + (new Date(a.resolved_at).getTime() - new Date(a.created_at).getTime()) / 60000;
              }, 0) / resolvedAlertsWithTime.length
            : undefined;

        // Per-device performance
        const devicePerformancePromises = devices.map(async (device): Promise<DevicePerformance> => {
          const { data: telemetryData, error: telemetryError } = await supabase
            .from('device_telemetry_history')
            .select('telemetry, received_at, device_timestamp')
            .eq('device_id', device.id)
            .gte('received_at', startTime)
            .order('received_at', { ascending: false })
            .limit(1000);

          if (telemetryError) console.error(`[Analytics] Telemetry error for ${device.name}:`, telemetryError);

          const telemetry = telemetryData || [];
          const dataPointsCount = telemetry.length;

          const batteryValues = telemetry
            .map(t => extractMetricValue(t.telemetry as Record<string, unknown>, 'battery'))
            .filter((b): b is number => b !== null);
          const avgBattery = batteryValues.length > 0 ? batteryValues.reduce((a, b) => a + b, 0) / batteryValues.length : undefined;

          const rssiValues = telemetry
            .map(t => extractMetricValue(t.telemetry as Record<string, unknown>, 'rssi'))
            .filter((r): r is number => r !== null);
          const avgRssi = rssiValues.length > 0 ? rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length : undefined;

          const { data: lastErrorAlert } = await supabase
            .from('alerts')
            .select('message, created_at')
            .eq('device_id', device.id)
            .eq('severity', 'critical')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const expectedDataPoints = hours * 12;
          const uptimePercentage = Math.min(100, (dataPointsCount / expectedDataPoints) * 100);

          return {
            device_id: device.id,
            device_name: device.name,
            uptime_percentage: device.status === 'online' ? Math.max(uptimePercentage, 75) : uptimePercentage,
            data_points_count: dataPointsCount,
            last_error: lastErrorAlert?.message,
            last_error_time: lastErrorAlert?.created_at,
            avg_battery: avgBattery,
            avg_rssi: avgRssi,
          };
        });

        const devicePerformance = await Promise.all(devicePerformancePromises);

        // System health calculations
        const totalDevices = devices.length;
        const onlineDevices = devices.filter(d => d.status === 'online').length;
        const offlineDevices = devices.filter(d => d.status === 'offline').length;
        const errorDevices = devices.filter(d => d.status === 'error').length;
        const overallHealth = totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0;

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentlyActive = devices.filter(d => d.last_seen && new Date(d.last_seen) >= fiveMinutesAgo).length;
        const connectivityRate = totalDevices > 0 ? Math.round((recentlyActive / totalDevices) * 100) : 0;
        const errorRate = totalDevices > 0 ? Math.round(((errorDevices + offlineDevices) / totalDevices) * 100) : 0;
        const performanceScore = Math.round(overallHealth * 0.6 + connectivityRate * 0.3 + (100 - errorRate) * 0.1);

        const avgBatteryHealth =
          devicePerformance.reduce((sum, d) => sum + (d.avg_battery || 0), 0) /
          (devicePerformance.filter(d => d.avg_battery).length || 1);
        const totalDataPoints = devicePerformance.reduce((sum, d) => sum + d.data_points_count, 0);

        setData({
          devicePerformance,
          alertStats: {
            total_alerts: totalAlerts,
            critical_alerts: criticalAlerts,
            high_alerts: highAlerts,
            medium_alerts: mediumAlerts,
            low_alerts: lowAlerts,
            resolved_alerts: resolvedAlerts,
            pending_alerts: pendingAlerts,
            avg_response_time_minutes: avgResponseTime,
            avg_resolution_time_minutes: avgResolutionTime,
          },
          systemHealth: {
            overall_health: overallHealth,
            connectivity_rate: connectivityRate,
            error_rate: errorRate,
            performance_score: performanceScore,
            avg_battery_health: avgBatteryHealth,
            avg_data_collection_rate: totalDataPoints / hours,
          },
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setData(EMPTY_DATA);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [currentOrganization, timeRange, supabase]);

  // Real-time subscription
  useEffect(() => {
    if (!currentOrganization) return;

    const channel = supabase
      .channel('analytics-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'device_telemetry_history',
          filter: `device_id=in.(${data?.devicePerformance.map(d => d.device_id).join(',') || ''})`,
        },
        () => {
          console.log('[Analytics] Real-time update received');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization, data, supabase]);

  // CSV export
  const exportToCSV = useCallback(() => {
    if (!data) return;

    const csvRows = [
      ['Device Performance Report'],
      ['Generated:', new Date().toISOString()],
      ['Organization:', currentOrganization?.name || ''],
      ['Time Range:', timeRange],
      [],
      ['Device Name', 'Uptime %', 'Data Points', 'Avg Battery %', 'Avg RSSI', 'Last Error'],
      ...data.devicePerformance.map(d => [
        d.device_name,
        d.uptime_percentage.toFixed(2),
        d.data_points_count.toString(),
        d.avg_battery?.toFixed(2) || 'N/A',
        d.avg_rssi?.toFixed(2) || 'N/A',
        d.last_error || 'None',
      ]),
    ];

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${currentOrganization?.name}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [data, currentOrganization, timeRange]);

  return { data, loading, exportToCSV, currentOrganization };
}
