'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Activity, Zap, AlertTriangle, Download, Clock, Battery } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { edgeFunctions } from "@/lib/edge-functions/client";
import { TelemetryLineChart } from "@/components/telemetry/TelemetryLineChart";
import { createClient } from "@/lib/supabase/client";

interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance';
  last_seen?: string;
}

interface DevicePerformance {
  device_id: string;
  device_name: string;
  uptime_percentage: number;
  data_points_count: number;
  last_error?: string;
  last_error_time?: string | null;
  avg_battery?: number;
  avg_rssi?: number;
}

interface AlertStats {
  total_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  medium_alerts: number;
  low_alerts: number;
  resolved_alerts: number;
  pending_alerts: number;
  avg_response_time_minutes?: number;
  avg_resolution_time_minutes?: number;
}

interface AnalyticsData {
  devicePerformance: DevicePerformance[];
  alertStats: AlertStats;
  systemHealth: {
    overall_health: number;
    connectivity_rate: number;
    error_rate: number;
    performance_score: number;
    avg_battery_health: number;
    avg_data_collection_rate: number;
  };
}

type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

export default function AnalyticsPage() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const supabase = createClient();

  // CSV Export Function
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
        d.last_error || 'None'
      ])
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

  const getTimeRangeHours = (range: TimeRange): number => {
    const map: Record<TimeRange, number> = {
      '1h': 1,
      '6h': 6,
      '24h': 24,
      '7d': 168,
      '30d': 720
    };
    return map[range];
  };

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
        
        // Fetch devices data using SDK
        const devicesResponse = await edgeFunctions.devices.list(currentOrganization.id);
        
        if (!devicesResponse.success) {
          throw new Error('Failed to fetch devices data');
        }
        
        const devices: Device[] = (devicesResponse.data?.devices as Device[]) || [];
        console.log('[Analytics] Devices loaded:', devices.length, 'devices');
        
        // Fetch alert statistics
        const { data: alertData, error: alertError } = await supabase
          .from('alerts')
          .select('id, severity, is_resolved, resolved_at, created_at')
          .eq('organization_id', currentOrganization.id)
          .gte('created_at', startTime);
        
        if (alertError) {
          console.error('[Analytics] Alert fetch error:', alertError);
        }
        
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
        
        // Calculate average response time (time to acknowledge)
        const avgResponseTime = ackData && ackData.length > 0
          ? ackData.reduce((sum, ack) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const alerts = ack.alerts as any;
              if (!alerts || !alerts.created_at) return sum;
              const created = new Date(alerts.created_at).getTime();
              const acked = new Date(ack.acknowledged_at).getTime();
              return sum + (acked - created) / (1000 * 60); // minutes
            }, 0) / ackData.length
          : undefined;
        
        // Calculate average resolution time
        const resolvedAlertsWithTime = alerts.filter(a => a.resolved_at && a.is_resolved && a.created_at);
        const avgResolutionTime = resolvedAlertsWithTime.length > 0
          ? resolvedAlertsWithTime.reduce((sum, a) => {
              if (!a.resolved_at || !a.created_at) return sum; // Extra safety check for TypeScript
              const created = new Date(a.created_at).getTime();
              const resolved = new Date(a.resolved_at).getTime();
              return sum + (resolved - created) / (1000 * 60); // minutes
            }, 0) / resolvedAlertsWithTime.length
          : undefined;
        
        // Fetch telemetry data for each device
        const devicePerformancePromises = devices.map(async (device) => {
          const { data: telemetryData, error: telemetryError } = await supabase
            .from('device_telemetry_history')
            .select('telemetry, device_timestamp')
            .eq('device_id', device.id)
            .gte('device_timestamp', startTime);
          
          if (telemetryError) {
            console.error(`[Analytics] Telemetry error for ${device.name}:`, telemetryError);
          }
          
          const telemetry = telemetryData || [];
          const dataPointsCount = telemetry.length;
          
          // Calculate averages
          const batteryValues = telemetry
            .map(t => {
              const tel = t.telemetry as Record<string, unknown>;
              return typeof tel?.battery === 'number' ? tel.battery : null;
            })
            .filter((b): b is number => b !== null);
          const avgBattery = batteryValues.length > 0
            ? batteryValues.reduce((a, b) => a + b, 0) / batteryValues.length
            : undefined;
          
          const rssiValues = telemetry
            .map(t => {
              const tel = t.telemetry as Record<string, unknown>;
              return typeof tel?.rssi === 'number' ? tel.rssi : null;
            })
            .filter((r): r is number => r !== null);
          const avgRssi = rssiValues.length > 0
            ? rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length
            : undefined;
          
          // Get last error from alerts
          const { data: lastErrorAlert } = await supabase
            .from('alerts')
            .select('message, created_at')
            .eq('device_id', device.id)
            .eq('severity', 'critical')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          // Calculate uptime based on data collection consistency
          const expectedDataPoints = hours * 12; // Assuming ~12 data points per hour
          const uptimePercentage = Math.min(100, (dataPointsCount / expectedDataPoints) * 100);
          
          return {
            device_id: device.id,
            device_name: device.name,
            uptime_percentage: device.status === 'online' ? Math.max(uptimePercentage, 75) : uptimePercentage,
            data_points_count: dataPointsCount,
            last_error: lastErrorAlert?.message,
            last_error_time: lastErrorAlert?.created_at,
            avg_battery: avgBattery,
            avg_rssi: avgRssi
          };
        });
        
        const devicePerformance = await Promise.all(devicePerformancePromises);
        
        // Calculate system health metrics
        const totalDevices = devices.length;
        const onlineDevices = devices.filter(d => d.status === 'online').length;
        const offlineDevices = devices.filter(d => d.status === 'offline').length;
        const errorDevices = devices.filter(d => d.status === 'error').length;
        
        const overallHealth = totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0;
        
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        const recentlyActiveDevices = devices.filter(d => {
          if (!d.last_seen) return false;
          const lastSeen = new Date(d.last_seen);
          return lastSeen >= fiveMinutesAgo;
        }).length;
        const connectivityRate = totalDevices > 0 ? Math.round((recentlyActiveDevices / totalDevices) * 100) : 0;
        
        const errorRate = totalDevices > 0 ? Math.round(((errorDevices + offlineDevices) / totalDevices) * 100) : 0;
        
        const performanceScore = Math.round(
          (overallHealth * 0.6) + 
          (connectivityRate * 0.3) + 
          ((100 - errorRate) * 0.1)
        );
        
        const avgBatteryHealth = devicePerformance.reduce((sum, d) => 
          sum + (d.avg_battery || 0), 0) / (devicePerformance.filter(d => d.avg_battery).length || 1);
        
        const totalDataPoints = devicePerformance.reduce((sum, d) => sum + d.data_points_count, 0);
        const avgDataCollectionRate = totalDataPoints / hours; // points per hour
        
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
            avg_resolution_time_minutes: avgResolutionTime
          },
          systemHealth: {
            overall_health: overallHealth,
            connectivity_rate: connectivityRate,
            error_rate: errorRate,
            performance_score: performanceScore,
            avg_battery_health: avgBatteryHealth,
            avg_data_collection_rate: avgDataCollectionRate
          }
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setData({
          devicePerformance: [],
          alertStats: {
            total_alerts: 0,
            critical_alerts: 0,
            high_alerts: 0,
            medium_alerts: 0,
            low_alerts: 0,
            resolved_alerts: 0,
            pending_alerts: 0
          },
          systemHealth: {
            overall_health: 0,
            connectivity_rate: 0,
            error_rate: 0,
            performance_score: 0,
            avg_battery_health: 0,
            avg_data_collection_rate: 0
          }
        });
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [currentOrganization, timeRange, supabase]);

  // Real-time subscription for updates
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
          filter: `device_id=in.(${data?.devicePerformance.map(d => d.device_id).join(',') || ''})`
        },
        () => {
          console.log('[Analytics] Real-time update received');
          // Trigger a refresh (debounced in production)
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization, data, supabase]);

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center p-12 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">Please select an organization from the sidebar to view analytics</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Analytics for {currentOrganization.name}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
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
          <h2 className="text-3xl font-bold tracking-tight">Analytics for {currentOrganization.name}</h2>
        </div>
        <div className="text-center">
          <p className="text-red-500">Failed to load analytics data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="6h">Last 6 Hours</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground">
          Real-time performance and health metrics for {currentOrganization.name}
        </p>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth.overall_health}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.systemHealth.overall_health > 80 ? 'System healthy' : data.systemHealth.overall_health > 50 ? 'Some issues detected' : 'Needs attention'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connectivity</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth.connectivity_rate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active in last 5 minutes
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth.performance_score}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Out of 100 points
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Battery Health</CardTitle>
            <Battery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth.avg_battery_health.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Fleet average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Telemetry Trends */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Telemetry Trends</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base">Temperature</CardTitle>
              <CardDescription>Real-time temperature monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <TelemetryLineChart
                organizationId={currentOrganization.id}
                metric="temperature"
                metricLabel="Temperature"
                timeRange={timeRange}
                unit="°C"
                height={280}
              />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base">Battery Level</CardTitle>
              <CardDescription>Fleet-wide battery health</CardDescription>
            </CardHeader>
            <CardContent>
              <TelemetryLineChart
                organizationId={currentOrganization.id}
                metric="battery"
                metricLabel="Battery"
                timeRange={timeRange}
                unit="%"
                height={280}
              />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base">Signal Strength</CardTitle>
              <CardDescription>Network connectivity quality</CardDescription>
            </CardHeader>
            <CardContent>
              <TelemetryLineChart
                organizationId={currentOrganization.id}
                metric="rssi"
                metricLabel="RSSI"
                timeRange={timeRange}
                unit="dBm"
                height={280}
              />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base">Humidity</CardTitle>
              <CardDescription>Environmental conditions</CardDescription>
            </CardHeader>
            <CardContent>
              <TelemetryLineChart
                organizationId={currentOrganization.id}
                metric="humidity"
                metricLabel="Humidity"
                timeRange={timeRange}
                unit="%"
                height={280}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Device Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alert Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Performance</CardTitle>
              <CardDescription>Detailed metrics for each device in your fleet</CardDescription>
            </CardHeader>
            <CardContent>
              {data.devicePerformance.length === 0 ? (
                <div className="text-center py-12">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No device data available for the selected time range</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.devicePerformance
                    .sort((a, b) => b.uptime_percentage - a.uptime_percentage)
                    .map((device) => (
                    <div 
                      key={device.device_id} 
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium">{device.device_name}</h3>
                          {!device.last_error ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Healthy
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              Error
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>{device.data_points_count.toLocaleString()} data points</span>
                          {device.avg_battery !== undefined && (
                            <span>Battery: {device.avg_battery.toFixed(0)}%</span>
                          )}
                          {device.avg_rssi !== undefined && (
                            <span>Signal: {device.avg_rssi.toFixed(0)} dBm</span>
                          )}
                        </div>
                        {device.last_error && (
                          <p className="text-xs text-red-600 mt-1">{device.last_error}</p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-lg font-bold">
                          {device.uptime_percentage.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">Uptime</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>Alert Overview</CardTitle>
                <CardDescription>Alert counts by severity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center pb-4 border-b">
                  <div className="text-4xl font-bold">{data.alertStats.total_alerts}</div>
                  <p className="text-sm text-muted-foreground mt-1">Total Alerts</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Critical</span>
                    <span className="text-sm font-medium">{data.alertStats.critical_alerts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">High</span>
                    <span className="text-sm font-medium">{data.alertStats.high_alerts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Medium</span>
                    <span className="text-sm font-medium">{data.alertStats.medium_alerts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Low</span>
                    <span className="text-sm font-medium">{data.alertStats.low_alerts}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t">
                    <span className="text-sm">Resolved</span>
                    <span className="text-sm font-medium text-green-600">{data.alertStats.resolved_alerts}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Pending</span>
                    <span className="text-sm font-medium text-orange-600">{data.alertStats.pending_alerts}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>Response Metrics</CardTitle>
                <CardDescription>Alert handling performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center pb-4 border-b">
                  <div className="text-4xl font-bold">
                    {data.alertStats.total_alerts > 0 
                      ? Math.round((data.alertStats.resolved_alerts / data.alertStats.total_alerts) * 100)
                      : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Resolution Rate</p>
                </div>
                
                <div className="space-y-3">
                  {data.alertStats.avg_response_time_minutes !== undefined && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Avg Response Time</span>
                      </div>
                      <span className="text-sm font-medium">
                        {data.alertStats.avg_response_time_minutes < 60 
                          ? `${Math.round(data.alertStats.avg_response_time_minutes)}m`
                          : `${(data.alertStats.avg_response_time_minutes / 60).toFixed(1)}h`}
                      </span>
                    </div>
                  )}
                  
                  {data.alertStats.avg_resolution_time_minutes !== undefined && (
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Avg Resolution Time</span>
                      </div>
                      <span className="text-sm font-medium">
                        {data.alertStats.avg_resolution_time_minutes < 60 
                          ? `${Math.round(data.alertStats.avg_resolution_time_minutes)}m`
                          : `${(data.alertStats.avg_resolution_time_minutes / 60).toFixed(1)}h`}
                      </span>
                    </div>
                  )}

                  {data.alertStats.total_alerts === 0 && (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No alerts in the selected time range</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}