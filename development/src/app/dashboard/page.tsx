'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LocationsCard } from '@/components/dashboard/LocationsCard'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { MetricTooltip, METRIC_DEFINITIONS } from '@/components/ui/metric-tooltip'
import { DataFreshness } from '@/components/ui/data-freshness'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { 
  Smartphone, 
  Users, 
  AlertTriangle, 
  TrendingUp, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Settings
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const { fmt } = useDateFormatter()
  const [loading, setLoading] = useState(true)
  const { currentOrganization, stats, isLoading: isLoadingOrg } = useOrganization()

  useEffect(() => {
    // Simple timeout to simulate loading
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  if (loading || isLoadingOrg) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="text-center">
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to NetNeural IoT Platform</h1>
          <p className="text-muted-foreground">Select an organization to view your dashboard</p>
        </div>
        <div className="flex items-center justify-center p-12 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">Please select an organization from the sidebar to continue</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Page Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization.settings}
            name={currentOrganization.name}
            size="xl"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{currentOrganization.name}</h1>
            <p className="text-muted-foreground">Real-time overview of your IoT infrastructure</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Devices */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/dashboard/devices')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              Total Devices
              <MetricTooltip {...METRIC_DEFINITIONS.totalDevices} />
            </CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalDevices || currentOrganization.deviceCount || 0}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500 font-medium">+12%</span>
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Online Devices */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/dashboard/devices')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              Online Devices
              <MetricTooltip {...METRIC_DEFINITIONS.onlineDevices} />
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.onlineDevices || 0}
              <span className="text-sm text-muted-foreground ml-2">/ {stats?.totalDevices || 0}</span>
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <span className="font-medium">
                {stats?.totalDevices && stats?.onlineDevices 
                  ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) 
                  : 0}%
              </span>
              <span className="ml-1">uptime rate</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/dashboard/alerts')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              Active Alerts
              <MetricTooltip {...METRIC_DEFINITIONS.activeAlerts} />
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeAlerts || 0}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              {(stats?.activeAlerts || 0) > 0 ? (
                <>
                  <ArrowUpRight className="h-3 w-3 mr-1 text-orange-500" />
                  <span className="text-orange-500 font-medium">Needs attention</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="h-3 w-3 mr-1 text-green-500" />
                  <span className="text-green-500 font-medium">-8% from last week</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/dashboard/organizations?tab=members')}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalUsers || currentOrganization.userCount || 0}
            </div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500 font-medium">+5%</span>
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - 2 Column Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Locations Card */}
        <LocationsCard />

        {/* System Health Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
            </CardTitle>
            <CardDescription>Device connectivity status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Online</span>
                <span className="font-medium text-green-600">{stats?.onlineDevices || 0} devices</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${stats?.totalDevices && stats?.onlineDevices 
                      ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) 
                      : 0}%`
                  }}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Offline</span>
                <span className="font-medium text-red-600">
                  {stats?.totalDevices ? stats.totalDevices - (stats.onlineDevices || 0) : 0} devices
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${stats?.totalDevices && stats?.onlineDevices 
                      ? 100 - Math.round((stats.onlineDevices / stats.totalDevices) * 100) 
                      : 0}%`
                  }}
                />
              </div>
            </div>

            <Button variant="outline" className="w-full mt-4" onClick={() => router.push('/dashboard/devices')}>
              View All Devices
            </Button>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest system notifications</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/alerts')}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(stats?.activeAlerts || 0) > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium">System notifications active</p>
                      <p className="text-xs text-muted-foreground">
                        {stats?.activeAlerts || 0} alert{(stats?.activeAlerts || 0) !== 1 ? 's' : ''} require attention
                      </p>
                    </div>
                  </div>
                  <Badge variant="destructive">{stats?.activeAlerts || 0}</Badge>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => router.push('/dashboard/alerts')}
                >
                  View Alert Details
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="rounded-full bg-green-100 p-3 mb-3">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <p className="font-medium text-green-600">All Systems Operational</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No active alerts or issues detected
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization Info */}
        <Card>
          <CardHeader>
            <CardTitle>Organization Info</CardTitle>
            <CardDescription>Account details and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Organization</span>
                <span className="text-sm font-medium">{currentOrganization.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm font-medium">
                  {currentOrganization.created_at 
                    ? fmt.shortDate(currentOrganization.created_at)
                    : 'Unknown'
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Integrations</span>
                <span className="text-sm font-medium">{stats?.activeIntegrations || 0} active</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Locations</span>
                <span className="text-sm font-medium">{stats?.totalLocations || 0} configured</span>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => router.push('/dashboard/organizations')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Organization Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}