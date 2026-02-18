'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, TrendingUp, ArrowRight, Shield, Activity, Clock, Calendar, BarChart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { format } from 'date-fns'

interface QuickStats {
  totalDevices: number
  activeAlerts: number
  recentExports: number
}

interface RecentActivity {
  action_type: string
  action_category: string
  created_at: string
  resource_name: string | null
}

export default function ReportsIndexPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const { user } = useUser()
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentOrganization) return

    const loadData = async () => {
      const supabase = createClient()

      try {
        // Get quick stats
        const [devicesResult, alertsResult, exportsResult] = await Promise.all([
          // Total devices
          supabase
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id),
          
          // Active alerts
          supabase
            .from('alerts')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id)
            .eq('status', 'active'),
          
          // Recent exports (last 7 days)
          supabase
            .from('user_audit_log')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id)
            .eq('action_category', 'export')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        ])

        setStats({
          totalDevices: devicesResult.count || 0,
          activeAlerts: alertsResult.count || 0,
          recentExports: exportsResult.count || 0,
        })

        // Get recent activity
        const { data: activityData } = await supabase
          .from('user_audit_log')
          .select('action_type, action_category, created_at, resource_name')
          .eq('organization_id', currentOrganization.id)
          .in('action_category', ['report', 'export', 'data_import_export'])
          .order('created_at', { ascending: false })
          .limit(5)

        setRecentActivity(activityData || [])
      } catch (error) {
        console.error('Error loading reports data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentOrganization])

  const reports = [
    {
      title: 'Alert History Report',
      description: 'View historical alert data with filtering, statistics, and response time analysis',
      icon: FileText,
      href: '/dashboard/reports/alerts',
      features: ['Date range filtering', 'Severity breakdown', 'Response time tracking', 'CSV export'],
    },
    {
      title: 'Telemetry Trends Report',
      description: 'Compare sensor data across multiple devices over time with threshold overlays',
      icon: TrendingUp,
      href: '/dashboard/reports/telemetry',
      features: ['Multi-device comparison', 'Threshold visualization', 'Statistics dashboard', 'Chart & table views'],
    },
    {
      title: 'User Activity Audit Log',
      description: 'Track all user actions in the system for compliance and troubleshooting (Admin only)',
      icon: Shield,
      href: '/dashboard/reports/audit-log',
      features: ['Complete activity tracking', 'Advanced filtering', 'Before/after changes', 'CSV export'],
      adminOnly: true,
    },
  ]

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{currentOrganization?.name ? `${currentOrganization.name} Reports` : 'Reports'}</h1>
        <p className="text-muted-foreground mt-2">
          Analyze your IoT data with comprehensive reporting tools
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {loading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalDevices || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all locations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activeAlerts || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Requiring attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recent Exports</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.recentExports || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Last 7 days
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Available Reports */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Reports</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon
          return (
            <Card key={report.href} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Icon className="w-10 h-10 text-primary mb-2" />
                  {report.adminOnly && (
                    <Badge variant="secondary" className="ml-auto">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin Only
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {report.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => router.push(report.href)}
                  className="w-full"
                  variant="default"
                >
                  Open Report
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No recent report activity</p>
                <p className="text-sm mt-1">Open a report to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => {
                  const actionIcon = activity.action_category === 'export' ? BarChart : FileText
                  const ActionIcon = actionIcon
                  
                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                    >
                      <ActionIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {activity.action_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(activity.created_at), 'PPp')}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {activity.action_category}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Reports (Placeholder) */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Scheduled Reports</h2>
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Scheduled Reports Coming Soon</p>
              <p className="text-sm mt-1">
                Configure automated report generation and delivery
              </p>
              <Button variant="outline" disabled className="mt-4">
                <Clock className="w-4 h-4 mr-2" />
                Set Up Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
