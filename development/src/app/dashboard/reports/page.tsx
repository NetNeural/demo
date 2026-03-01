'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FileText,
  TrendingUp,
  ArrowRight,
  Shield,
  Activity,
  Clock,
  Calendar,
  BarChart,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { FeatureGate } from '@/components/FeatureGate'
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

    let cancelled = false

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

          // Active alerts (unresolved)
          supabase
            .from('alerts')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id)
            .eq('is_resolved', false),

          // Recent exports (last 7 days)
          supabase
            .from('user_audit_log')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', currentOrganization.id)
            .eq('action_category', 'export')
            .gte(
              'created_at',
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            ),
        ])

        if (cancelled) return

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

        if (cancelled) return

        setRecentActivity(activityData || [])
      } catch (error) {
        console.error('Error loading reports data:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id])

  const reports = [
    {
      title: 'Alert History Report',
      description:
        'View historical alert data with filtering, statistics, and response time analysis',
      icon: FileText,
      href: '/dashboard/reports/alerts',
      features: [
        'Date range filtering',
        'Severity breakdown',
        'Response time tracking',
        'CSV export',
      ],
    },
    {
      title: 'Telemetry Trends Report',
      description:
        'Compare sensor data across multiple devices over time with threshold overlays',
      icon: TrendingUp,
      href: '/dashboard/reports/telemetry',
      features: [
        'Multi-device comparison',
        'Threshold visualization',
        'Statistics dashboard',
        'Chart & table views',
      ],
    },
    {
      title: 'User Activity Audit Log',
      description:
        'Track all user actions in the system for compliance and troubleshooting (Admin only)',
      icon: Shield,
      href: '/dashboard/reports/audit-log',
      features: [
        'Complete activity tracking',
        'Advanced filtering',
        'Before/after changes',
        'CSV export',
      ],
      adminOnly: true,
      gateFeature: 'audit_logs',
    },
  ]

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
            {currentOrganization?.name
              ? `${currentOrganization.name} Reports`
              : 'Reports'}
          </h2>
          <p className="text-muted-foreground">
            Analyze your IoT data with comprehensive reporting tools
          </p>
        </div>
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
                <CardTitle className="text-sm font-medium">
                  Total Devices
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.totalDevices || 0}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Across all locations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Alerts
                </CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.activeAlerts || 0}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Requiring attention
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Recent Exports
                </CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats?.recentExports || 0}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Last 7 days
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Available Reports */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Available Reports</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => {
            const Icon = report.icon
            const card = (
              <Card
                key={report.href}
                className="transition-shadow hover:shadow-lg"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Icon className="mb-2 h-10 w-10 text-primary" />
                    {report.adminOnly && (
                      <Badge variant="secondary" className="ml-auto">
                        <Shield className="mr-1 h-3 w-3" />
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
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
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
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            )

            if (report.gateFeature) {
              return (
                <FeatureGate
                  key={report.href}
                  feature={report.gateFeature}
                  showUpgradePrompt
                >
                  {card}
                </FeatureGate>
              )
            }

            return card
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p>No recent report activity</p>
                <p className="mt-1 text-sm">Open a report to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => {
                  const actionIcon =
                    activity.action_category === 'export' ? BarChart : FileText
                  const ActionIcon = actionIcon

                  return (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-accent"
                    >
                      <ActionIcon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
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
        <h2 className="mb-4 text-xl font-semibold">Scheduled Reports</h2>
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="py-8 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="font-medium">Scheduled Reports Coming Soon</p>
              <p className="mt-1 text-sm">
                Configure automated report generation and delivery
              </p>
              <Button variant="outline" disabled className="mt-4">
                <Clock className="mr-2 h-4 w-4" />
                Set Up Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
