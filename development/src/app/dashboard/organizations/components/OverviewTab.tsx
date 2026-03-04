'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrganization } from '@/contexts/OrganizationContext'
import {
  Smartphone,
  Users,
  AlertTriangle,
  Plug,
  TrendingUp,
  Activity,
  UserCircle,
  Settings,
  Bell,
  Cpu,
  LogIn,
  ShieldCheck,
} from 'lucide-react'
import { ResellerAgreementSection } from './ResellerAgreementSection'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { createClient } from '@/lib/supabase/client'

interface AuditEntry {
  id: string
  action_type: string
  action_category: string
  resource_type: string | null
  resource_name: string | null
  user_email: string | null
  status: string
  created_at: string
}

function activityIcon(category: string, resourceType: string | null) {
  if (resourceType === 'device' || resourceType === 'sensor')
    return <Cpu className="h-4 w-4" />
  if (resourceType === 'alert') return <Bell className="h-4 w-4" />
  if (category === 'auth') return <LogIn className="h-4 w-4" />
  if (category === 'security') return <ShieldCheck className="h-4 w-4" />
  if (category === 'user') return <UserCircle className="h-4 w-4" />
  return <Settings className="h-4 w-4" />
}

function activityColor(status: string) {
  if (status === 'failure' || status === 'error')
    return 'text-red-500 bg-red-50 dark:bg-red-950'
  if (status === 'warning')
    return 'text-amber-500 bg-amber-50 dark:bg-amber-950'
  return 'text-blue-500 bg-blue-50 dark:bg-blue-950'
}

function formatAction(entry: AuditEntry) {
  const a = entry.action_type.replace(/_/g, ' ')
  const r = entry.resource_name
    ? `"${entry.resource_name}"`
    : entry.resource_type || ''
  return r ? `${a}: ${r}` : a
}

interface OverviewTabProps {
  organizationId: string
}

export function OverviewTab({ organizationId }: OverviewTabProps) {
  const { fmt } = useDateFormatter()
  const { currentOrganization, stats, userRole } = useOrganization()
  const supabase = createClient()

  const [activities, setActivities] = useState<AuditEntry[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_audit_log')
        .select(
          'id, action_type, action_category, resource_type, resource_name, user_email, status, created_at'
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (!error) setActivities((data || []) as AuditEntry[])
    } catch (err) {
      console.error('Failed to load activity:', err)
    } finally {
      setActivityLoading(false)
    }
  }, [organizationId, supabase])

  useEffect(() => {
    loadActivity()
  }, [loadActivity])

  if (!currentOrganization) {
    return <div>No organization selected</div>
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalDevices || currentOrganization.deviceCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Registered devices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Members
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalUsers || currentOrganization.userCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Organization members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeAlerts || 0}</div>
            <p className="text-xs text-muted-foreground">Unresolved alerts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
            <Plug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeIntegrations || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Configured integrations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Information about {currentOrganization.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Organization Name
              </p>
              <p className="text-base font-semibold">
                {currentOrganization.name}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Your Role
              </p>
              <Badge variant="secondary" className="capitalize">
                {userRole}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Organization ID
              </p>
              <code className="rounded bg-muted px-2 py-1 text-sm">
                {organizationId}
              </code>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Created
              </p>
              <p className="text-base">
                {currentOrganization.created_at
                  ? fmt.longDate(currentOrganization.created_at)
                  : 'Unknown'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reseller Agreement Section — hidden for main (root) org */}
      {currentOrganization.parent_organization_id && (
        <ResellerAgreementSection organizationId={organizationId} />
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest events in your organization</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No activity recorded yet
            </div>
          ) : (
            <div className="space-y-2">
              {activities.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg p-2 hover:bg-muted/50"
                >
                  <div
                    className={`mt-0.5 rounded-full p-1.5 ${activityColor(entry.status)}`}
                  >
                    {activityIcon(entry.action_category, entry.resource_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium capitalize">
                      {formatAction(entry)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.user_email ?? 'System'} &middot;{' '}
                      {fmt.timeAgo(entry.created_at)}
                    </p>
                  </div>
                  {entry.status !== 'success' && (
                    <Badge
                      variant={
                        entry.status === 'failure' ? 'destructive' : 'outline'
                      }
                      className="shrink-0 text-[10px]"
                    >
                      {entry.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Device Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Online</span>
                <span className="text-sm font-medium">
                  {stats?.onlineDevices || 0} (
                  {stats?.totalDevices
                    ? Math.round(
                        (stats.onlineDevices / stats.totalDevices) * 100
                      )
                    : 0}
                  %)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-green-500 transition-all"
                  style={{
                    width: stats?.totalDevices
                      ? `${(stats.onlineDevices / stats.totalDevices) * 100}%`
                      : '0%',
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm">Offline</span>
                <span className="text-sm font-medium">
                  {stats?.totalDevices
                    ? stats.totalDevices - stats.onlineDevices
                    : 0}{' '}
                  (
                  {stats?.totalDevices
                    ? Math.round(
                        ((stats.totalDevices - stats.onlineDevices) /
                          stats.totalDevices) *
                          100
                      )
                    : 0}
                  %)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-red-500 transition-all"
                  style={{
                    width: stats?.totalDevices
                      ? `${((stats.totalDevices - stats.onlineDevices) / stats.totalDevices) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Alerts</span>
                <Badge
                  variant={stats?.activeAlerts ? 'destructive' : 'secondary'}
                >
                  {stats?.activeAlerts || 0}
                </Badge>
              </div>
              {stats?.activeAlerts === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active alerts - all systems operating normally
                </p>
              )}
              {(stats?.activeAlerts || 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  View alerts tab for details and to acknowledge
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
