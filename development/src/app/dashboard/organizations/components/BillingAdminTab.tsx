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
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Building2,
  CreditCard,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Users,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Crown,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'

// Lazy singleton
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

interface ChildOrgBilling {
  id: string
  name: string
  slug: string
  plan_name: string | null
  plan_slug: string | null
  plan_price_per_device: number
  subscription_status: string | null
  device_count: number
  user_count: number
  estimated_mrr: number
  current_period_end: string | null
  cancel_at_period_end: boolean
}

interface BillingAdminTabProps {
  organizationId: string
}

export function BillingAdminTab({ organizationId }: BillingAdminTabProps) {
  const { fmt } = useDateFormatter()
  const [childOrgs, setChildOrgs] = useState<ChildOrgBilling[]>([])
  const [parentPlan, setParentPlan] = useState<{
    name: string
    slug: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchBillingAdmin = useCallback(async () => {
    if (!organizationId) return
    try {
      setLoading(true)
      const supabase = getSupabase()

      // Fetch parent org's own subscription/plan
      const { data: parentSub } = await (supabase as any)
        .from('subscriptions')
        .select('plan:plan_id(name, slug)')
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing'])
        .limit(1)
        .single()

      if (parentSub?.plan) {
        setParentPlan(parentSub.plan as { name: string; slug: string })
      }

      // Fetch child organizations
      const { data: children, error: childErr } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('parent_organization_id', organizationId)
        .order('name')

      if (childErr || !children || children.length === 0) {
        setChildOrgs([])
        return
      }

      // For each child org, fetch subscription + device/user counts
      const enriched: ChildOrgBilling[] = await Promise.all(
        children.map(async (org: { id: string; name: string; slug: string }) => {
          // Subscription + plan
          const { data: sub } = await (supabase as any)
            .from('subscriptions')
            .select(
              'status, current_period_end, cancel_at_period_end, plan:plan_id(name, slug, price_per_device)'
            )
            .eq('organization_id', org.id)
            .in('status', ['active', 'trialing', 'past_due'])
            .limit(1)
            .single()

          // Device count
          const { count: deviceCount } = await supabase
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', org.id)

          // User count
          const { count: userCount } = await supabase
            .from('organization_members')
            .select('user_id', { count: 'exact', head: true })
            .eq('organization_id', org.id)

          const plan = sub?.plan as {
            name: string
            slug: string
            price_per_device: number
          } | null
          const devices = deviceCount ?? 0
          const pricePerDevice = plan?.price_per_device ?? 0
          const mrr = pricePerDevice * devices

          return {
            id: org.id,
            name: org.name,
            slug: org.slug,
            plan_name: plan?.name ?? null,
            plan_slug: plan?.slug ?? null,
            plan_price_per_device: pricePerDevice,
            subscription_status: sub?.status ?? null,
            device_count: devices,
            user_count: userCount ?? 0,
            estimated_mrr: mrr,
            current_period_end: sub?.current_period_end ?? null,
            cancel_at_period_end: sub?.cancel_at_period_end ?? false,
          }
        })
      )

      setChildOrgs(enriched)
    } catch (err) {
      console.error('Error fetching billing admin data:', err)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchBillingAdmin()
  }, [fetchBillingAdmin])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            Loading billing administration...
          </p>
        </div>
      </div>
    )
  }

  const totalMRR = childOrgs.reduce((sum, org) => sum + org.estimated_mrr, 0)
  const totalDevices = childOrgs.reduce(
    (sum, org) => sum + org.device_count,
    0
  )
  const totalUsers = childOrgs.reduce((sum, org) => sum + org.user_count, 0)
  const activeOrgs = childOrgs.filter(
    (org) => org.subscription_status === 'active'
  ).length
  const totalOrgs = childOrgs.length

  return (
    <div className="space-y-6">
      {/* Platform Owner Banner */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 dark:border-purple-800 dark:from-purple-950/30 dark:to-indigo-950/30">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Crown className="h-6 w-6 text-purple-600" />
          <div>
            <CardTitle className="text-lg">
              {parentPlan?.name ?? 'Unlimited'} Plan — Platform Owner
            </CardTitle>
            <CardDescription>
              No billing required. Full access to all features and unlimited
              resources.
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* Revenue Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Estimated MRR
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalMRR.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              From {activeOrgs} active customer{activeOrgs !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Customer Orgs
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalOrgs}</p>
            <p className="text-xs text-muted-foreground">
              {activeOrgs} active, {totalOrgs - activeOrgs} no subscription
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Sensors
            </CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalDevices}</p>
            <p className="text-xs text-muted-foreground">
              Across all customer orgs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalUsers}</p>
            <p className="text-xs text-muted-foreground">
              Across all customer orgs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Child Org Billing Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              Customer Organization Billing
            </CardTitle>
            <CardDescription>
              Subscriptions, sensors, and revenue from child organizations
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchBillingAdmin}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {childOrgs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Sensors</TableHead>
                  <TableHead className="text-center">Users</TableHead>
                  <TableHead className="text-right">Est. MRR</TableHead>
                  <TableHead>Renews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {childOrgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {org.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.plan_name ? (
                        <Badge variant="outline">{org.plan_name}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No plan
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <SubscriptionStatusBadge
                        status={org.subscription_status}
                        cancelAtEnd={org.cancel_at_period_end}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {org.device_count}
                    </TableCell>
                    <TableCell className="text-center">
                      {org.user_count}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {org.estimated_mrr > 0 ? (
                        <span className="text-green-600">
                          ${org.estimated_mrr.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">$0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {org.current_period_end
                        ? fmt.shortDate(org.current_period_end)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="border-t-2 font-bold">
                  <TableCell colSpan={3}>Totals</TableCell>
                  <TableCell className="text-center">{totalDevices}</TableCell>
                  <TableCell className="text-center">{totalUsers}</TableCell>
                  <TableCell className="text-right text-green-600">
                    ${totalMRR.toFixed(2)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center py-12 text-center">
              <div className="space-y-3">
                <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="text-lg font-semibold">
                  No customer organizations yet
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Create child organizations from the Customer Orgs tab. Their
                  billing and subscription status will appear here.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SubscriptionStatusBadge({
  status,
  cancelAtEnd,
}: {
  status: string | null
  cancelAtEnd: boolean
}) {
  if (!status) {
    return (
      <Badge
        variant="outline"
        className="text-gray-500 dark:text-gray-400"
      >
        <XCircle className="mr-1 h-3 w-3" />
        None
      </Badge>
    )
  }

  if (cancelAtEnd) {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Canceling
      </Badge>
    )
  }

  const map: Record<
    string,
    { color: string; icon: React.ReactNode; label: string }
  > = {
    active: {
      color:
        'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200',
      icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
      label: 'Active',
    },
    trialing: {
      color:
        'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200',
      icon: <CreditCard className="mr-1 h-3 w-3" />,
      label: 'Trial',
    },
    past_due: {
      color:
        'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200',
      icon: <AlertTriangle className="mr-1 h-3 w-3" />,
      label: 'Past Due',
    },
  }

  const entry = map[status] ?? {
    color: 'bg-gray-100 text-gray-600',
    icon: null,
    label: status,
  }

  return (
    <Badge className={entry.color}>
      {entry.icon}
      {entry.label}
    </Badge>
  )
}
