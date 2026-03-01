'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { HealthScoreBadge } from '@/components/admin/HealthScoreBadge'
import { LifecycleStageIndicator } from '@/components/admin/LifecycleStageIndicator'
import { CustomerTimeline } from '@/components/admin/CustomerTimeline'
import { StageOverrideDialog } from '@/components/admin/StageOverrideDialog'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import {
  fetchCustomerDetail,
  fetchLifecycleEvents,
  fetchActivityTimeline,
  insertStageOverride,
} from '@/lib/admin/lifecycle-queries'
import type {
  CustomerOverviewRow,
  LifecycleEvent,
  LifecycleStage,
  TimelineEntry,
} from '@/types/billing'
import { getLifecycleStage, formatLifecycleStage } from '@/types/billing'
import {
  ArrowLeft,
  ShieldAlert,
  Building2,
  Smartphone,
  Users,
  DollarSign,
  Calendar,
  Activity,
  Clock,
} from 'lucide-react'

// Lazy singleton
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

export default function CustomerDetailClient() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CustomerDetailContent />
    </Suspense>
  )
}

function CustomerDetailContent() {
  const router = useRouter()
  const params = useParams()
  const orgId = params.orgId as string
  const { user, loading: userLoading } = useUser()
  const { userRole } = useOrganization()
  const { fmt } = useDateFormatter()
  const isSuperAdmin = user?.isSuperAdmin || false
  const hasAccess = isSuperAdmin || userRole === 'owner'
  const supabase = getSupabase()

  // Data
  const [customer, setCustomer] = useState<CustomerOverviewRow | null>(null)
  const [lifecycleEvents, setLifecycleEvents] = useState<LifecycleEvent[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])

  // UI
  const [loading, setLoading] = useState(true)
  const [timelineLoading, setTimelineLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await fetchCustomerDetail(supabase, orgId)
    if (fetchError) {
      setError(fetchError)
      setLoading(false)
      return
    }
    setCustomer(data)
    setLoading(false)

    // Load lifecycle events and timeline in parallel
    setTimelineLoading(true)
    const [events, timelineEntries] = await Promise.all([
      fetchLifecycleEvents(supabase, orgId),
      fetchActivityTimeline(supabase, orgId),
    ])
    setLifecycleEvents(events)
    setTimeline(timelineEntries)
    setTimelineLoading(false)
  }, [supabase, orgId])

  useEffect(() => {
    if (hasAccess && orgId) {
      loadData()
    }
  }, [hasAccess, orgId, loadData])

  // Loading
  if (userLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center p-12">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Not owner or super admin
  if (!hasAccess) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Access Restricted</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Super admin access required.
            </p>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <p className="text-lg font-semibold">Error loading customer</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => router.push('/dashboard/admin/customers')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Customers
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const currentStage: LifecycleStage = customer ? getLifecycleStage(customer) : 'trial'

  async function handleStageOverride(toStage: LifecycleStage, reason: string) {
    if (!customer || !user) return
    const { success, error: overrideError } = await insertStageOverride(
      supabase,
      customer.id,
      currentStage,
      toStage,
      reason,
      user.id
    )
    if (!success) throw new Error(overrideError || 'Failed to update')
    // Reload data
    await loadData()
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/admin/customers')}
            title="Back to Customers"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            {loading ? (
              <>
                <Skeleton className="h-8 w-48 mb-1" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : customer ? (
              <>
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Building2 className="h-6 w-6" />
                  {customer.name}
                </h2>
                <p className="text-sm text-muted-foreground">{customer.slug}</p>
              </>
            ) : null}
          </div>
        </div>

        {customer && (
          <StageOverrideDialog
            currentStage={currentStage}
            orgName={customer.name}
            onOverride={handleStageOverride}
          />
        )}
      </div>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : customer ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column: Details + Lifecycle */}
          <div className="lg:col-span-2 space-y-6">
            {/* Lifecycle stage card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Lifecycle Stage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LifecycleStageIndicator
                  currentStage={currentStage}
                  changedAt={customer.last_updated}
                />

                {/* Stage history */}
                {lifecycleEvents.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Stage History</p>
                    <div className="space-y-1">
                      {lifecycleEvents.slice(0, 5).map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {event.from_stage ? formatLifecycleStage(event.from_stage) : 'Initial'}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">
                              {formatLifecycleStage(event.to_stage)}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {event.trigger_type}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {fmt.dateTime(event.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key metrics grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Devices</p>
                      <p className="text-2xl font-bold">{customer.device_count}</p>
                      <p className="text-xs text-emerald-600">
                        {customer.active_device_count} active
                      </p>
                    </div>
                    <Smartphone className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Members</p>
                      <p className="text-2xl font-bold">{customer.member_count}</p>
                    </div>
                    <Users className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">MRR</p>
                      <p className="text-2xl font-bold">
                        {customer.mrr !== null
                          ? `$${Number(customer.mrr).toLocaleString()}`
                          : '—'}
                      </p>
                    </div>
                    <DollarSign className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Health Score</p>
                      <HealthScoreBadge
                        score={customer.health_score}
                        breakdown={{
                          login: customer.login_frequency_score,
                          device: customer.device_activity_score,
                          feature: customer.feature_adoption_score,
                          support: customer.support_ticket_score,
                          payment: customer.payment_health_score,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Subscription info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <p className="text-sm font-semibold">
                      {customer.plan_name || customer.subscription_tier || 'No plan'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className="capitalize">
                      {customer.subscription_status || 'none'}
                    </Badge>
                    {customer.cancel_at_period_end && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        Canceling
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Period End</p>
                    <p className="text-sm">
                      {customer.current_period_end
                        ? fmt.dateOnly(customer.current_period_end)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Active</p>
                    <p className="text-sm flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {customer.last_active ? fmt.timeAgo(customer.last_active) : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Customer Since</p>
                    <p className="text-sm">{fmt.dateOnly(customer.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Timeline */}
          <div>
            <CustomerTimeline entries={timeline} loading={timelineLoading} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
