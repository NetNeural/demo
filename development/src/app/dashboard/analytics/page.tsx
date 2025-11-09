'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, Zap, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance';
  last_seen?: string;
}

interface AnalyticsData {
  devicePerformance: {
    device_name: string;
    uptime_percentage: number;
    data_points_count: number;
    last_error?: string;
  }[];
  alertStats: {
    total_alerts: number;
    critical_alerts: number;
    resolved_alerts: number;
    pending_alerts: number;
  };
  systemHealth: {
    overall_health: number;
    connectivity_rate: number;
    error_rate: number;
    performance_score: number;
  };
}

export default function AnalyticsPage() {
  const { currentOrganization } = useOrganization();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrganization) {
      setLoading(false);
      return;
    }

    async function fetchAnalytics() {
      try {
        setLoading(true);
        
        if (!currentOrganization) return;
        
        // Get auth session
        const supabase = (await import('@/lib/supabase/client')).createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.error('[Analytics] No session found');
          throw new Error('Not authenticated');
        }
        
        // Fetch devices data to calculate analytics
        const devicesResponse = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices?organization_id=${currentOrganization.id}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (devicesResponse.ok) {
          const devicesData = await devicesResponse.json();
          const devices: Device[] = devicesData.devices || [];
          
          console.log('[Analytics] Devices loaded:', devices.length, 'devices');
          
          // Calculate system health metrics
          const totalDevices = devices.length;
          const onlineDevices = devices.filter(d => d.status === 'online').length;
          const offlineDevices = devices.filter(d => d.status === 'offline').length;
          const errorDevices = devices.filter(d => d.status === 'error').length;
          
          console.log('[Analytics] Device status:', { totalDevices, onlineDevices, offlineDevices, errorDevices });
          
          // Overall Health: percentage of devices that are online
          const overall_health = totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0;
          
          // Connectivity Rate: devices that have been seen in last 5 minutes
          const now = new Date();
          const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
          const recentlyActiveDevices = devices.filter(d => {
            if (!d.last_seen) return false;
            const lastSeen = new Date(d.last_seen);
            return lastSeen >= fiveMinutesAgo;
          }).length;
          const connectivity_rate = totalDevices > 0 ? Math.round((recentlyActiveDevices / totalDevices) * 100) : 0;
          
          // Error Rate: percentage of devices in error or offline status
          const error_rate = totalDevices > 0 ? Math.round(((errorDevices + offlineDevices) / totalDevices) * 100) : 0;
          
          // Performance Score: weighted average (60% health, 30% connectivity, 10% inverse of error rate)
          const performance_score = Math.round(
            (overall_health * 0.6) + 
            (connectivity_rate * 0.3) + 
            ((100 - error_rate) * 0.1)
          );
          
          console.log('[Analytics] Calculated metrics:', { 
            overall_health, 
            connectivity_rate, 
            error_rate, 
            performance_score 
          });
          
          setData({
            devicePerformance: devices.map(d => ({
              device_name: d.name,
              uptime_percentage: d.status === 'online' ? 99 : d.status === 'offline' ? 0 : 75,
              data_points_count: 1000, // Placeholder
              last_error: d.status === 'error' ? 'Connection timeout' : undefined
            })),
            alertStats: {
              total_alerts: 0,
              critical_alerts: 0,
              resolved_alerts: 0,
              pending_alerts: 0
            },
            systemHealth: {
              overall_health,
              connectivity_rate,
              error_rate,
              performance_score
            }
          });
        } else {
          throw new Error('Failed to fetch devices data');
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        // Show empty state on error instead of mock data
        setData({
          devicePerformance: [],
          alertStats: {
            total_alerts: 0,
            critical_alerts: 0,
            resolved_alerts: 0,
            pending_alerts: 0
          },
          systemHealth: {
            overall_health: 0,
            connectivity_rate: 0,
            error_rate: 0,
            performance_score: 0
          }
        });
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [currentOrganization]);

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
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard - {currentOrganization.name}</h2>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Health</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth.overall_health}%</div>
            <Progress value={data.systemHealth.overall_health} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connectivity Rate</CardTitle>
            <Zap className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth.connectivity_rate}%</div>
            <Progress value={data.systemHealth.connectivity_rate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth.error_rate}%</div>
            <div className="text-xs text-muted-foreground">Target: &lt;5%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.systemHealth.performance_score}</div>
            <div className="text-xs text-muted-foreground">Out of 100</div>
          </CardContent>
        </Card>
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
              <CardTitle>Device Performance Analysis</CardTitle>
              <CardDescription>Individual device uptime and data collection metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.devicePerformance.map((device, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <h3 className="font-medium">{device.device_name}</h3>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{device.data_points_count.toLocaleString()} data points</span>
                        {device.last_error && (
                          <Badge variant="destructive" className="text-xs">
                            {device.last_error}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{device.uptime_percentage.toFixed(1)}%</div>
                      <Progress value={device.uptime_percentage} className="w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Analytics</CardTitle>
              <CardDescription>Alert resolution and severity breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{data.alertStats.total_alerts}</div>
                    <div className="text-sm text-muted-foreground">Total Alerts</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Critical</span>
                      <Badge variant="destructive">{data.alertStats.critical_alerts}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Pending</span>
                      <Badge variant="secondary">{data.alertStats.pending_alerts}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Resolved</span>
                      <Badge variant="default">{data.alertStats.resolved_alerts}</Badge>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {Math.round((data.alertStats.resolved_alerts / data.alertStats.total_alerts) * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Resolution Rate</div>
                  </div>
                  <Progress 
                    value={(data.alertStats.resolved_alerts / data.alertStats.total_alerts) * 100} 
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}