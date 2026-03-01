'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ExternalLink,
  RefreshCw,
  Archive,
  ArchiveRestore,
  BarChart3,
  Brain,
  Building2,
  DollarSign,
  Users,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import type { BillingPlan } from '@/types/billing'
import { formatPlanPrice } from '@/types/billing'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

function getPlanIcon(slug: string) {
  switch (slug) {
    case 'starter':
      return BarChart3
    case 'professional':
      return Brain
    case 'enterprise':
      return Building2
    default:
      return DollarSign
  }
}

interface PlanWithStats extends BillingPlan {
  subscriber_count: number
}

export function PlanManagementTab() {
  const [plans, setPlans] = useState<PlanWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadPlans = useCallback(async () => {
    try {
      const supabase = getSupabase() as any

      // Fetch all plans (including inactive/archived)
      const { data: planRows, error } = await supabase
        .from('billing_plans')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error

      // Count subscribers per plan
      const plansWithStats: PlanWithStats[] = await Promise.all(
        (planRows || []).map(async (plan: BillingPlan) => {
          const { count } = await supabase
            .from('subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('plan_id', plan.id)
            .in('status', ['active', 'trialing', 'past_due'])

          return { ...plan, subscriber_count: count ?? 0 }
        })
      )

      setPlans(plansWithStats)
    } catch (err) {
      console.error('Failed to load plans:', err)
      toast.error('Failed to load billing plans')
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadPlans()
      setLoading(false)
    }
    init()
  }, [loadPlans])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadPlans()
    setRefreshing(false)
  }

  const handleToggleArchive = async (plan: PlanWithStats) => {
    const action = plan.is_active ? 'archive' : 'restore'
    if (
      plan.is_active &&
      plan.subscriber_count > 0 &&
      !window.confirm(
        `This plan has ${plan.subscriber_count} active subscriber(s). Archiving will prevent new sign-ups but existing subscribers keep their plan. Continue?`
      )
    ) {
      return
    }

    try {
      const supabase = getSupabase() as any
      const { error } = await supabase
        .from('billing_plans')
        .update({ is_active: !plan.is_active, updated_at: new Date().toISOString() })
        .eq('id', plan.id)

      if (error) throw error

      toast.success(`Plan ${action}d successfully`)
      await loadPlans()
    } catch (err) {
      console.error(`Failed to ${action} plan:`, err)
      toast.error(`Failed to ${action} plan`)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const activePlans = plans.filter((p) => p.is_active)
  const archivedPlans = plans.filter((p) => !p.is_active)
  const totalSubscribers = plans.reduce((s, p) => s + p.subscriber_count, 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Plans</CardDescription>
            <CardTitle className="text-2xl">{activePlans.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Archived Plans</CardDescription>
            <CardTitle className="text-2xl">{archivedPlans.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Subscribers</CardDescription>
            <CardTitle className="text-2xl">{totalSubscribers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Full Plan Editor</CardDescription>
            <CardTitle className="text-sm">
              <Button variant="outline" size="sm" asChild>
                <a href="/dashboard/plans-pricing" className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Open Plans &amp; Pricing
                </a>
              </Button>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Plans table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Billing Plans
            </CardTitle>
            <CardDescription>
              Create, edit, archive, and restore billing plans. Use the full editor for
              resource limits and feature flags.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Limits</TableHead>
                  <TableHead className="text-center">Subscribers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No billing plans found. Create your first plan in the Plans &amp; Pricing editor.
                    </TableCell>
                  </TableRow>
                ) : (
                  plans.map((plan) => {
                    const Icon = getPlanIcon(plan.slug)
                    return (
                      <TableRow key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{plan.name}</p>
                              <p className="text-xs text-muted-foreground">{plan.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {plan.pricing_model === 'per_device' ? (
                              <>
                                <p>${plan.price_per_device}/sensor/mo</p>
                                {plan.price_monthly > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    + ${plan.price_monthly}/mo base
                                  </p>
                                )}
                              </>
                            ) : plan.pricing_model === 'custom' ? (
                              <p className="text-muted-foreground">Custom</p>
                            ) : (
                              <p>${plan.price_monthly}/mo</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>{plan.max_devices === -1 ? '∞' : plan.max_devices} devices</p>
                            <p>{plan.max_users === -1 ? '∞' : plan.max_users} users</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{plan.subscriber_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {plan.is_active ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Archived</Badge>
                          )}
                          {!plan.is_public && plan.is_active && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              Hidden
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" asChild>
                              <a href="/dashboard/plans-pricing" title="Edit plan">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Edit
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleArchive(plan)}
                              title={plan.is_active ? 'Archive plan' : 'Restore plan'}
                            >
                              {plan.is_active ? (
                                <>
                                  <Archive className="h-3 w-3 mr-1" />
                                  Archive
                                </>
                              ) : (
                                <>
                                  <ArchiveRestore className="h-3 w-3 mr-1" />
                                  Restore
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
