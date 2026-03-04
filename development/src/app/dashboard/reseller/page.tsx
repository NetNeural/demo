'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FleetProgressBar } from '@/components/reseller/FleetProgressBar'
import { DownlineTreeMap } from '@/components/reseller/DownlineTreeMap'
import { SupportSlider } from '@/components/reseller/SupportSlider'
import { TierManagement } from '@/components/reseller/TierManagement'
import { InvitesPanel } from '@/components/reseller/InvitesPanel'
import { useResellerTier } from '@/hooks/useResellerTier'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs'
import {
  DollarSign, Wifi, TrendingUp, Users, Link2, Copy, Check,
  Bell, ExternalLink, Layers, UserPlus,
} from 'lucide-react'
import type { ResellerPayout, SupportModel } from '@/types/reseller'
import { cn } from '@/lib/utils'

function ResellerSignupLinkCard({ orgSlug }: { orgSlug: string }) {
  const [copied, setCopied] = useState(false)
  const signupUrl = `${typeof window !== 'undefined' ? window.location.origin : 'https://sentinel.netneural.ai'}/auth/signup?org=${orgSlug}`

  const copy = () => {
    navigator.clipboard.writeText(signupUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 className="h-4 w-4 text-cyan-400" />
          Your Signup Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <span className="flex-1 truncate font-mono text-xs text-muted-foreground">{signupUrl}</span>
          <button onClick={copy} className="shrink-0 rounded p-1 hover:bg-muted transition-colors">
            {copied
              ? <Check className="h-3.5 w-3.5 text-emerald-400" />
              : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Share this link. New customers who sign up will automatically be placed under your account.
          Your branding (logo, colors) will appear on their signup page.
        </p>
        <Button asChild size="sm" variant="outline" className="w-full text-xs">
          <a href={signupUrl} target="_blank" rel="noreferrer">
            Preview Signup Page <ExternalLink className="ml-1.5 h-3 w-3" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

function PayoutStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    paid:    'bg-emerald-500/15 text-emerald-400',
    pending: 'bg-amber-500/15 text-amber-400',
    failed:  'bg-red-500/15 text-red-400',
  }
  return <Badge className={variants[status] ?? 'bg-gray-700 text-gray-300'}>{status}</Badge>
}

function ResellerDashboardContent() {
  const searchParams = useSearchParams()
  const [orgId, setOrgId]                     = useState<string | null>(null)
  const [orgSlug, setOrgSlug]                 = useState<string>('')
  const [payouts, setPayouts]                 = useState<ResellerPayout[]>([])
  const [supportModel, setSupportModel]       = useState<SupportModel>('hybrid')
  const [notifications, setNotifications]     = useState<{ id: string; notification_type: string; sent_at: string }[]>([])
  const { data: tierData, loading: tierLoading } = useResellerTier(orgId)

  useEffect(() => {
    const loadOrg = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: member } = await (supabase as any)
        .from('organization_members')
        .select('organization_id, organizations!inner(id, slug, is_reseller, support_model)')
        .eq('user_id', user.id)
        .eq('organizations.is_reseller', true)
        .limit(1)
        .single()

      if (!member) return
      const org = (member as { organization_id: string; organizations: { id: string; slug: string; support_model: string } }).organizations
      setOrgId(member.organization_id)
      setOrgSlug(org.slug)
      setSupportModel((org.support_model ?? 'hybrid') as SupportModel)

      // Load payouts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: payoutData } = await (supabase as any)
        .from('reseller_payouts')
        .select('*')
        .eq('organization_id', member.organization_id)
        .order('calculated_at', { ascending: false })
        .limit(50)
      setPayouts((payoutData as ResellerPayout[]) ?? [])

      // Load notifications
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: notifs } = await (supabase as any)
        .from('reseller_grace_notifications')
        .select('id, notification_type, sent_at')
        .eq('organization_id', member.organization_id)
        .order('sent_at', { ascending: false })
        .limit(10)
      setNotifications((notifs as { id: string; notification_type: string; sent_at: string }[]) ?? [])
    }
    loadOrg()
  }, [])

  // Platform admin = NetNeural org (can manage global tier config)
  const NETNEURAL_ORG_ID = '00000000-0000-0000-0000-000000000001'
  const isPlatformAdmin = orgId === NETNEURAL_ORG_ID

  if (!orgId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-sm">No reseller organization found for your account.</p>
        </div>
      </div>
    )
  }

  const totalPaid    = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.payout_amount, 0)
  const totalPending = payouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.payout_amount, 0)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reseller Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your reseller network, track sensor counts, and monitor payouts.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            icon: Wifi,
            label: 'Active Sensors',
            value: tierData ? tierData.effective_total.toLocaleString() : '—',
            sub:   tierData ? `${tierData.direct_sensors} direct · ${tierData.downstream_sensors} downstream` : '',
            color: 'text-cyan-400',
          },
          {
            icon: TrendingUp,
            label: 'Partner Discount',
            value: tierData ? `${(tierData.discount_pct * 100).toFixed(0)}%` : '—',
            sub:   tierData?.current_tier ?? '',
            color: 'text-emerald-400',
          },
          {
            icon: DollarSign,
            label: 'Total Paid Out',
            value: `$${totalPaid.toFixed(2)}`,
            sub:   `$${totalPending.toFixed(2)} pending`,
            color: 'text-amber-400',
          },
          {
            icon: Users,
            label: 'Sub-Resellers',
            value: '—',
            sub:   'See Downline tab',
            color: 'text-violet-400',
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <Card key={label} className="border-border bg-card">
            <CardContent className="p-4">
              <Icon className={cn('mb-2 h-4 w-4', color)} />
              <p className="text-xl font-bold text-foreground">{value}</p>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              {sub && <p className="mt-0.5 text-xs text-muted-foreground/60">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fleet progress bar */}
      {tierData && !tierLoading && (
        <FleetProgressBar tierData={tierData} />
      )}

      {/* Tabs */}
      <Tabs defaultValue={searchParams.get('tab') || 'payouts'}>
        <TabsList className="border-b border-border bg-transparent">
          {['payouts', 'downline', 'invites', 'support', 'notifications', ...(isPlatformAdmin ? ['tiers'] : [])].map(tab => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="capitalize data-[state=active]:border-b-2 data-[state=active]:border-cyan-500 data-[state=active]:text-foreground"
            >
              {tab === 'tiers' ? (
                <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" />Tiers</span>
              ) : tab === 'invites' ? (
                <span className="flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5" />Invites</span>
              ) : tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Payouts tab */}
        <TabsContent value="payouts" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-foreground">Payout History</CardTitle>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No payouts recorded yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Date</TableHead>
                      <TableHead className="text-muted-foreground">Amount</TableHead>
                      <TableHead className="text-muted-foreground">Spread %</TableHead>
                      <TableHead className="text-muted-foreground">Sensors</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map(p => (
                      <TableRow key={p.id} className="border-border/60 hover:bg-muted/30">
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(p.calculated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">
                          ${p.payout_amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {(p.spread_pct * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.sensor_count.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <PayoutStatusBadge status={p.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Downline tab */}
        <TabsContent value="downline" className="mt-4 space-y-4">
          <DownlineTreeMap rootOrgId={orgId} />
          <ResellerSignupLinkCard orgSlug={orgSlug} />
        </TabsContent>

        {/* Invites tab */}
        <TabsContent value="invites" className="mt-4">
          <InvitesPanel orgId={orgId} orgSlug={orgSlug} />
        </TabsContent>

        {/* Support tab */}
        <TabsContent value="support" className="mt-4">
          <SupportSlider
            orgId={orgId}
            currentModel={supportModel}
            currentMargin={tierData?.discount_pct ?? 0}
            activeSensors={tierData?.effective_total ?? 0}
            pricePerSensor={10}   // TODO: pull from billing config
            nextBillingDate={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()}
            onChanged={setSupportModel}
          />
        </TabsContent>

        {/* Notifications tab */}
        <TabsContent value="notifications" className="mt-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Bell className="h-4 w-4 text-cyan-400" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No notifications.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map(n => (
                    <div key={n.id} className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
                      <Bell className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
                      <div>
                        <p className="text-sm text-foreground capitalize">
                          {n.notification_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(n.sent_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Tiers tab (platform admin only) */}
        {isPlatformAdmin && (
          <TabsContent value="tiers" className="mt-4">
            <TierManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

export default function ResellerDashboardPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Suspense fallback={<div className="text-gray-500">Loading…</div>}>
        <ResellerDashboardContent />
      </Suspense>
    </div>
  )
}
