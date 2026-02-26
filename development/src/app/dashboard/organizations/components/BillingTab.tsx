'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  CreditCard,
  ExternalLink,
  FileText,
  AlertTriangle,
  ArrowUpRight,
  RefreshCw,
  Cpu,
  Users,
  Zap,
  HardDrive,
  Cloud,
  CheckCircle2,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import type {
  BillingPlan,
  SubscriptionStatus,
  InvoiceStatus,
  UsageMetricType,
} from '@/types/billing'
import {
  formatPlanPrice,
  formatSubscriptionStatus,
  formatInvoiceAmount,
  formatInvoiceStatus,
  isSubscriptionActive,
  formatStorageBytes,
  formatLimit,
} from '@/types/billing'

// Lazy singleton
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

interface BillingTabProps {
  organizationId: string
}

interface SubscriptionData {
  id: string
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  plan: BillingPlan
}

interface InvoiceData {
  id: string
  amount_cents: number
  currency: string
  status: InvoiceStatus
  invoice_url: string | null
  pdf_url: string | null
  period_start: string | null
  period_end: string | null
  created_at: string
}

interface UsageData {
  metric_type: UsageMetricType
  current_value: number
  plan_limit: number
  usage_percent: number
  is_warning: boolean
  is_exceeded: boolean
  is_unlimited: boolean
}

const METRIC_ICONS: Record<UsageMetricType, React.ReactNode> = {
  device_count: <Cpu className="h-4 w-4" />,
  user_count: <Users className="h-4 w-4" />,
  api_calls: <Zap className="h-4 w-4" />,
  storage_bytes: <HardDrive className="h-4 w-4" />,
  edge_function_invocations: <Cloud className="h-4 w-4" />,
}

const METRIC_LABELS: Record<UsageMetricType, string> = {
  device_count: 'Devices',
  user_count: 'Team Members',
  api_calls: 'API Calls',
  storage_bytes: 'Storage',
  edge_function_invocations: 'Edge Functions',
}

export function BillingTab({ organizationId }: BillingTabProps) {
  const router = useRouter()
  const { fmt } = useDateFormatter()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(
    null
  )
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [usage, setUsage] = useState<UsageData[]>([])
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  const fetchBillingData = useCallback(async () => {
    if (!organizationId) return
    try {
      setLoading(true)
      const supabase = getSupabase()

      // Fetch subscription + plan (cast: tables not in generated types yet)
      const { data: subData } = await (supabase as any)
        .from('subscriptions')
        .select(
          'id, status, current_period_start, current_period_end, cancel_at_period_end, plan:plan_id(*)'
        )
        .eq('organization_id', organizationId)
        .in('status', ['active', 'trialing', 'past_due'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (subData?.plan) {
        setSubscription({
          id: subData.id,
          status: subData.status,
          current_period_start: subData.current_period_start,
          current_period_end: subData.current_period_end,
          cancel_at_period_end: subData.cancel_at_period_end,
          plan: subData.plan as BillingPlan,
        })
      }

      // Fetch invoices
      const { data: invData } = await (supabase as any)
        .from('invoices')
        .select(
          'id, amount_cents, currency, status, invoice_url, pdf_url, period_start, period_end, created_at'
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(12)

      if (invData) {
        setInvoices(invData as InvoiceData[])
      }

      // Fetch usage via usage-check edge function
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.access_token) {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/functions/v1/usage-check`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          )
          if (res.ok) {
            const usageResponse = await res.json()
            if (usageResponse?.quotas) {
              const usageArr: UsageData[] = Object.entries(
                usageResponse.quotas
              ).map(([key, val]: [string, any]) => ({
                metric_type: key as UsageMetricType,
                current_value: val.current_usage ?? 0,
                plan_limit: val.plan_limit ?? 0,
                usage_percent: val.usage_percent ?? 0,
                is_warning: val.is_warning ?? false,
                is_exceeded: val.is_exceeded ?? false,
                is_unlimited: val.is_unlimited ?? false,
              }))
              setUsage(usageArr)
            }
          }
        }
      } catch {
        // Usage fetch is best-effort
      }
    } catch (err) {
      console.error('Error fetching billing data:', err)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchBillingData()
  }, [fetchBillingData])

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    try {
      const supabase = getSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.access_token) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/functions/v1/create-portal-session`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ organizationId }),
          }
        )
        if (res.ok) {
          const result = await res.json()
          const portalUrl = result?.data?.url || result?.url
          if (portalUrl) {
            window.open(portalUrl, '_blank')
            return
          }
        }
      }
      alert(
        'Stripe Customer Portal is not yet configured. Contact support for billing changes.'
      )
    } catch {
      alert('Unable to open billing portal. Please contact support.')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            Loading billing info...
          </p>
        </div>
      </div>
    )
  }

  const plan = subscription?.plan
  const isPastDue = subscription?.status === 'past_due'
  const isCanceled = !subscription || subscription.cancel_at_period_end

  return (
    <div className="space-y-6">
      {/* Past due warning */}
      {isPastDue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Payment Past Due</AlertTitle>
          <AlertDescription>
            Your last payment failed. Please update your payment method to avoid
            service interruption.
            <Button
              variant="outline"
              size="sm"
              className="ml-3"
              onClick={handleManageSubscription}
            >
              Update Payment
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Cancellation warning */}
      {subscription?.cancel_at_period_end &&
        subscription.current_period_end && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Subscription Canceling</AlertTitle>
            <AlertDescription>
              Your subscription will end on{' '}
              {fmt.longDate(subscription.current_period_end)}. You will retain
              access until then.
            </AlertDescription>
          </Alert>
        )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Plan Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg">Current Plan</CardTitle>
              <CardDescription>
                {plan ? plan.description : 'No active subscription'}
              </CardDescription>
            </div>
            {subscription && <StatusBadge status={subscription.status} />}
          </CardHeader>
          <CardContent className="space-y-4">
            {plan ? (
              <>
                <div>
                  <p className="text-3xl font-bold">{plan.name}</p>
                  <p className="text-lg text-muted-foreground">
                    {formatPlanPrice(plan)}
                  </p>
                </div>
                {subscription?.current_period_end && (
                  <p className="text-sm text-muted-foreground">
                    {subscription.cancel_at_period_end ? 'Ends' : 'Renews'}{' '}
                    {fmt.longDate(subscription.current_period_end)}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    {portalLoading ? 'Opening...' : 'Manage Subscription'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/pricing')}
                  >
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Compare Plans
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-2xl font-bold">Free Tier</p>
                <p className="text-sm text-muted-foreground">
                  You are on the free tier. Upgrade to unlock more sensors,
                  features, and support.
                </p>
                <Button size="sm" onClick={() => router.push('/pricing')}>
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Upgrade Plan
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Overview Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg">Usage</CardTitle>
              <CardDescription>Current billing period</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchBillingData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {usage.length > 0 ? (
              usage
                .filter((u) =>
                  ['device_count', 'user_count'].includes(u.metric_type)
                )
                .map((u) => <UsageMeter key={u.metric_type} usage={u} />)
            ) : (
              <p className="text-sm text-muted-foreground">
                No usage data available yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Usage Meters */}
      {usage.length > 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Usage Metrics</CardTitle>
            <CardDescription>Detailed resource consumption</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {usage.map((u) => (
                <UsageMeter key={u.metric_type} usage={u} showCard />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoice History</CardTitle>
          <CardDescription>Recent invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {fmt.shortDate(inv.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.period_start && inv.period_end
                        ? `${fmt.shortDate(inv.period_start)} – ${fmt.shortDate(inv.period_end)}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {formatInvoiceAmount(inv.amount_cents, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {inv.invoice_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={inv.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-1 h-3 w-3" />
                              View
                            </a>
                          </Button>
                        )}
                        {inv.pdf_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={inv.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <FileText className="mr-1 h-3 w-3" />
                              PDF
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center py-8 text-center">
              <div className="space-y-2">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No invoices yet</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Sub-components ──

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const isActive = isSubscriptionActive(status)
  return (
    <Badge
      className={
        isActive
          ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200'
          : status === 'past_due'
            ? 'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200'
            : 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200'
      }
    >
      {isActive && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {status === 'past_due' && <AlertTriangle className="mr-1 h-3 w-3" />}
      {formatSubscriptionStatus(status)}
    </Badge>
  )
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const colorMap: Record<InvoiceStatus, string> = {
    paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    open: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    void: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    uncollectible: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }
  return (
    <Badge className={`${colorMap[status]} hover:${colorMap[status]}`}>
      {formatInvoiceStatus(status)}
    </Badge>
  )
}

function UsageMeter({
  usage,
  showCard,
}: {
  usage: UsageData
  showCard?: boolean
}) {
  const percent = usage.is_unlimited ? 0 : Math.min(usage.usage_percent, 100)
  const color = usage.is_exceeded
    ? 'bg-red-500'
    : usage.is_warning
      ? 'bg-amber-500'
      : 'bg-green-500'

  const formatValue = (type: UsageMetricType, val: number) => {
    if (type === 'storage_bytes') return formatStorageBytes(val)
    return val.toLocaleString()
  }

  const content = (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {METRIC_ICONS[usage.metric_type]}
          <span className="font-medium">
            {METRIC_LABELS[usage.metric_type]}
          </span>
        </div>
        <span className="text-muted-foreground">
          {formatValue(usage.metric_type, usage.current_value)}
          {' / '}
          {usage.is_unlimited ? '∞' : formatLimit(usage.plan_limit)}
        </span>
      </div>
      {!usage.is_unlimited && (
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full transition-all ${color}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {usage.is_unlimited && (
        <p className="text-xs text-muted-foreground">Unlimited</p>
      )}
    </div>
  )

  if (showCard) {
    return <div className="rounded-lg border p-4">{content}</div>
  }

  return content
}
