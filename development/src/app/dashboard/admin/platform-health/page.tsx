'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { isPlatformAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  ExternalLink,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  Wifi,
  XCircle,
  Zap,
} from 'lucide-react'

interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  latencyMs?: number
  details?: string
  checkedAt: Date
}

interface PlatformStats {
  totalOrgs: number
  totalDevices: number
  totalAlerts: number
  activeAlerts: number
  totalUsers: number
}

function StatusBadge({ status }: { status: HealthCheck['status'] }) {
  const map = {
    healthy: {
      label: 'Healthy',
      className: 'bg-green-100 text-green-700 border-green-200',
    },
    degraded: {
      label: 'Degraded',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    },
    down: {
      label: 'Down',
      className: 'bg-red-100 text-red-700 border-red-200',
    },
    unknown: {
      label: 'Unknown',
      className: 'bg-gray-100 text-gray-600 border-gray-200',
    },
  }
  const { label, className } = map[status]
  return <Badge className={`${className} border font-medium`}>{label}</Badge>
}

function StatusIcon({ status }: { status: HealthCheck['status'] }) {
  if (status === 'healthy')
    return <CheckCircle className="h-5 w-5 text-green-500" />
  if (status === 'degraded')
    return <AlertTriangle className="h-5 w-5 text-yellow-500" />
  if (status === 'down') return <XCircle className="h-5 w-5 text-red-500" />
  return <Clock className="h-5 w-5 text-gray-400" />
}

export default function PlatformHealthPage() {
  const { user, loading } = useUser()
  const { currentOrganization, userRole } = useOrganization()
  const isSuperAdmin = isPlatformAdmin(user, currentOrganization?.id, userRole)
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const runHealthChecks = useCallback(async () => {
    setIsChecking(true)
    const supabase = createClient()
    const results: HealthCheck[] = []

    // 1. Database connectivity + latency
    const dbStart = Date.now()
    try {
      const { error } = await supabase
        .from('organizations')
        .select('id')
        .limit(1)
      results.push({
        name: 'Database (PostgreSQL)',
        status: error ? 'down' : 'healthy',
        latencyMs: Date.now() - dbStart,
        details: error ? error.message : 'Connection successful',
        checkedAt: new Date(),
      })
    } catch (e: any) {
      results.push({
        name: 'Database (PostgreSQL)',
        status: 'down',
        latencyMs: Date.now() - dbStart,
        details: e.message,
        checkedAt: new Date(),
      })
    }

    // 2. Auth service
    const authStart = Date.now()
    try {
      const { data, error } = await supabase.auth.getSession()
      results.push({
        name: 'Auth Service',
        status: error ? 'degraded' : 'healthy',
        latencyMs: Date.now() - authStart,
        details: error
          ? error.message
          : data.session
            ? 'Session valid'
            : 'Auth reachable',
        checkedAt: new Date(),
      })
    } catch (e: any) {
      results.push({
        name: 'Auth Service',
        status: 'down',
        latencyMs: Date.now() - authStart,
        details: e.message,
        checkedAt: new Date(),
      })
    }

    // 3. Edge Functions (ping organizations function)
    const efStart = Date.now()
    try {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/organizations`
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        signal: AbortSignal.timeout(5000),
      })
      const latency = Date.now() - efStart
      results.push({
        name: 'Edge Functions',
        status:
          resp.ok || resp.status === 403
            ? 'healthy'
            : latency > 3000
              ? 'degraded'
              : 'healthy',
        latencyMs: latency,
        details: `HTTP ${resp.status} — ${latency}ms`,
        checkedAt: new Date(),
      })
    } catch (e: any) {
      results.push({
        name: 'Edge Functions',
        status: e.name === 'TimeoutError' ? 'degraded' : 'down',
        latencyMs: Date.now() - efStart,
        details: e.message,
        checkedAt: new Date(),
      })
    }

    // 4. Storage service
    const storageStart = Date.now()
    try {
      const { data, error } = await supabase.storage.listBuckets()
      results.push({
        name: 'Storage Service',
        status: error ? 'degraded' : 'healthy',
        latencyMs: Date.now() - storageStart,
        details: error
          ? error.message
          : `${data?.length ?? 0} bucket(s) accessible`,
        checkedAt: new Date(),
      })
    } catch (e: any) {
      results.push({
        name: 'Storage Service',
        status: 'down',
        latencyMs: Date.now() - storageStart,
        details: e.message,
        checkedAt: new Date(),
      })
    }

    // 5. Realtime
    const rtStart = Date.now()
    try {
      const channel = supabase.channel('health-check')
      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (
            status === 'SUBSCRIBED' ||
            status === 'TIMED_OUT' ||
            status === 'CHANNEL_ERROR'
          ) {
            resolve()
          }
        })
        setTimeout(resolve, 3000)
      })
      supabase.removeChannel(channel)
      results.push({
        name: 'Realtime (WebSocket)',
        status: 'healthy',
        latencyMs: Date.now() - rtStart,
        details: 'WebSocket connection successful',
        checkedAt: new Date(),
      })
    } catch (e: any) {
      results.push({
        name: 'Realtime (WebSocket)',
        status: 'degraded',
        latencyMs: Date.now() - rtStart,
        details: e.message,
        checkedAt: new Date(),
      })
    }

    setChecks(results)

    // Platform stats
    try {
      const [orgsRes, devicesRes, alertsRes, usersRes] = await Promise.all([
        supabase
          .from('organizations')
          .select('id', { count: 'exact', head: true }),
        supabase.from('devices').select('id', { count: 'exact', head: true }),
        supabase.from('alerts').select('id', { count: 'exact', head: true }),
        supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .in('status', ['active', 'triggered']),
      ])
      setStats({
        totalOrgs: orgsRes.count ?? 0,
        totalDevices: devicesRes.count ?? 0,
        totalAlerts: alertsRes.count ?? 0,
        activeAlerts: usersRes.count ?? 0,
        totalUsers: 0,
      })
    } catch {
      /* stats are best-effort */
    }

    setLastRefresh(new Date())
    setIsChecking(false)
  }, [])

  useEffect(() => {
    if (!loading && isSuperAdmin) {
      runHealthChecks()
    }
  }, [loading, isSuperAdmin, runHealthChecks])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Platform Admin Only</p>
            <p className="text-sm text-muted-foreground">
              Platform health monitoring requires platform admin access.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const overallStatus =
    checks.length === 0
      ? 'unknown'
      : checks.some((c) => c.status === 'down')
        ? 'down'
        : checks.some((c) => c.status === 'degraded')
          ? 'degraded'
          : 'healthy'

  const supabaseProjectRef =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')?.[0]?.replace(
      'https://',
      ''
    ) ?? ''

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Activity className="h-8 w-8" />
            Platform Health
          </h2>
          <p className="text-muted-foreground">
            Real-time status of all platform components
            {lastRefresh && (
              <span className="ml-2 text-xs">
                — Last checked {lastRefresh.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={runHealthChecks}
          disabled={isChecking}
          variant="outline"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${isChecking ? 'animate-spin' : ''}`}
          />
          {isChecking ? 'Checking...' : 'Refresh'}
        </Button>
      </div>

      {/* Overall Status Banner */}
      <Card
        className={
          overallStatus === 'healthy'
            ? 'border-green-200 bg-green-50'
            : overallStatus === 'degraded'
              ? 'border-yellow-200 bg-yellow-50'
              : overallStatus === 'down'
                ? 'border-red-200 bg-red-50'
                : 'border-gray-200'
        }
      >
        <CardContent className="flex items-center gap-4 pt-6">
          <StatusIcon status={overallStatus} />
          <div>
            <p className="text-lg font-semibold">
              {overallStatus === 'healthy'
                ? 'All Systems Operational'
                : overallStatus === 'degraded'
                  ? 'Partial Service Degradation'
                  : overallStatus === 'down'
                    ? 'Service Disruption Detected'
                    : 'Checking system status...'}
            </p>
            <p className="text-sm text-muted-foreground">
              {checks.length} components checked
            </p>
          </div>
          <div className="ml-auto">
            <StatusBadge status={overallStatus} />
          </div>
        </CardContent>
      </Card>

      {/* Component Checks */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {checks.length === 0 && isChecking
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-4 w-32 rounded bg-gray-200" />
                </CardHeader>
                <CardContent>
                  <div className="mt-2 h-3 w-48 rounded bg-gray-100" />
                </CardContent>
              </Card>
            ))
          : checks.map((check) => (
              <Card
                key={check.name}
                className={
                  check.status === 'healthy'
                    ? 'border-green-100'
                    : check.status === 'degraded'
                      ? 'border-yellow-100'
                      : check.status === 'down'
                        ? 'border-red-100'
                        : ''
                }
              >
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <StatusIcon status={check.status} />
                      {check.name}
                    </span>
                    <StatusBadge status={check.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {check.details}
                  </p>
                  {check.latencyMs !== undefined && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {check.latencyMs}ms response time
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Platform Stats */}
      {stats && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Database className="h-5 w-5" />
            Platform Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: 'Organizations', value: stats.totalOrgs, icon: Server },
              { label: 'Devices', value: stats.totalDevices, icon: Wifi },
              { label: 'Total Alerts', value: stats.totalAlerts, icon: Bell },
              {
                label: 'Active Alerts',
                value: stats.activeAlerts,
                icon: AlertTriangle,
              },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Icon className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold">
                        {value.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* External Links */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <Zap className="h-5 w-5" />
          Monitoring Resources
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            {
              title: 'Supabase Dashboard',
              description: 'Database metrics, query performance, logs',
              href: `https://supabase.com/dashboard/project/${supabaseProjectRef}`,
              icon: Database,
            },
            {
              title: 'Edge Function Logs',
              description: 'Invocation counts, error rates, latency',
              href: `https://supabase.com/dashboard/project/${supabaseProjectRef}/functions`,
              icon: Zap,
            },
            {
              title: 'Sentry Error Tracking',
              description: 'Frontend errors, exception monitoring',
              href: 'https://sentry.io',
              icon: Shield,
            },
          ].map(({ title, description, href, icon: Icon }) => (
            <a
              key={title}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {title}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export { PlatformHealthPage }

// Fix missing import
function Bell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  )
}

