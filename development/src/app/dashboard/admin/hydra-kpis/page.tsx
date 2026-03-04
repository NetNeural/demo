'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Wifi, TrendingUp, Users, Activity, DollarSign,
  BarChart3, RefreshCw, ChevronDown,
} from 'lucide-react'
import { TIER_BG_COLORS, TIER_COLORS } from '@/types/reseller'
import { cn } from '@/lib/utils'

interface KPISummary {
  total_resellers:       number
  total_sensors:         number
  avg_sensors_per_org:   number
  tier_distribution:     Record<string, number>
  top_resellers:         { name: string; slug: string; tier: string; sensor_count: number }[]
  recent_tier_changes:   number
  pending_grace_periods: number
  total_payouts_pending: number
  total_payouts_paid:    number
  total_invites_pending: number
  total_invites_accepted: number
  sync_log_last:         { status: string; orgs_processed: number; tier_changes: number; duration_ms: number; created_at: string } | null
}

export default function HydraKPIDashboardPage() {
  const [kpis, setKpis]       = useState<KPISummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const loadKPIs = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any

      const results = await Promise.all([
        db.from('reseller_sensor_counts').select('organization_id, effective_total, current_tier_id'),
        db.from('reseller_tiers').select('id, name'),
        db.from('reseller_tier_history').select('id').gte('effective_at', new Date(Date.now() - 30 * 86400000).toISOString()),
        db.from('organizations').select('id').eq('is_reseller', true).not('tier_locked_until', 'is', null),
        db.from('reseller_payouts').select('payout_amount').eq('status', 'pending'),
        db.from('reseller_payouts').select('payout_amount').eq('status', 'paid'),
        db.from('reseller_invitations').select('id, status'),
        db.from('sensor_sync_log').select('*').order('created_at', { ascending: false }).limit(1).single(),
        db.from('organizations').select('id, name, slug').eq('is_reseller', true).eq('is_active', true),
      ])
      const sensorCounts   = results[0].data as { organization_id: string; effective_total: number; current_tier_id: string | null }[] | null
      const tiers          = results[1].data as { id: string; name: string }[] | null
      const tierHistory    = results[2].data as { id: string }[] | null
      const graceActive    = results[3].data as { id: string }[] | null
      const payoutsPending = results[4].data as { payout_amount: number }[] | null
      const payoutsPaid    = results[5].data as { payout_amount: number }[] | null
      const invites        = results[6].data as { id: string; status: string }[] | null
      const syncLog        = results[7].data as { status: string; orgs_processed: number; tier_changes: number; duration_ms: number; created_at: string } | null
      const resellers      = results[8].data as { id: string; name: string; slug: string }[] | null

      const tierMap: Record<string, string> = {}
      for (const t of (tiers ?? [])) tierMap[t.id] = t.name

      const tierDistribution: Record<string, number> = {}
      const orgTierMap: Record<string, string> = {}
      for (const sc of (sensorCounts ?? [])) {
        const tierName = sc.current_tier_id ? (tierMap[sc.current_tier_id] ?? 'Unknown') : 'Unassigned'
        tierDistribution[tierName] = (tierDistribution[tierName] ?? 0) + 1
        orgTierMap[sc.organization_id] = tierName
      }

      const effectiveTotals = (sensorCounts ?? []).map(s => s.effective_total)
      const totalSensors = effectiveTotals.reduce((a, b) => a + b, 0)

      // Top resellers by sensor count
      const resellerDetails = (resellers ?? []).map(r => {
        const sc = (sensorCounts ?? []).find(s => s.organization_id === r.id)
        return {
          name:         r.name,
          slug:         r.slug,
          tier:         orgTierMap[r.id] ?? 'Unassigned',
          sensor_count: sc?.effective_total ?? 0,
        }
      }).sort((a, b) => b.sensor_count - a.sensor_count).slice(0, 10)

      setKpis({
        total_resellers:        (resellers ?? []).length,
        total_sensors:          totalSensors,
        avg_sensors_per_org:    (resellers ?? []).length > 0
          ? Math.round(totalSensors / (resellers ?? []).length)
          : 0,
        tier_distribution:      tierDistribution,
        top_resellers:          resellerDetails,
        recent_tier_changes:    (tierHistory ?? []).length,
        pending_grace_periods:  (graceActive ?? []).length,
        total_payouts_pending:  (payoutsPending ?? []).reduce((s, p) => s + p.payout_amount, 0),
        total_payouts_paid:     (payoutsPaid ?? []).reduce((s, p) => s + p.payout_amount, 0),
        total_invites_pending:  (invites ?? []).filter(i => i.status === 'pending').length,
        total_invites_accepted: (invites ?? []).filter(i => i.status === 'accepted').length,
        sync_log_last:          syncLog ?? null,
      })
    } finally {
      setLoading(false)
    }
  }

  const triggerSync = async () => {
    setSyncing(true)
    try {
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reseller-sensor-sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'manual' }),
      })
      await loadKPIs()
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => { loadKPIs() }, [])

  if (loading || !kpis) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading Hydra KPIs…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Project Hydra KPIs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reseller network health, sensor velocity, and revenue metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadKPIs}
            className="text-xs"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={triggerSync}
            disabled={syncing}
            className="bg-cyan-600 hover:bg-cyan-500 text-xs"
          >
            <Activity className="mr-1.5 h-3.5 w-3.5" />
            {syncing ? 'Syncing…' : 'Run Sensor Sync'}
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { icon: Users,     label: 'Active Resellers',  value: kpis.total_resellers,                      color: 'text-cyan-400' },
          { icon: Wifi,      label: 'Total Sensors',     value: kpis.total_sensors.toLocaleString(),        color: 'text-emerald-400' },
          { icon: BarChart3, label: 'Avg per Org',       value: kpis.avg_sensors_per_org.toLocaleString(),  color: 'text-violet-400' },
          { icon: TrendingUp,label: 'Tier Changes (30d)', value: kpis.recent_tier_changes,                  color: 'text-amber-400' },
          { icon: DollarSign,label: 'Payouts Pending',   value: `$${kpis.total_payouts_pending.toFixed(2)}`, color: 'text-cyan-400' },
          { icon: Activity,  label: 'Grace Periods',     value: kpis.pending_grace_periods,                 color: 'text-red-400' },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <Icon className={cn('mb-2 h-4 w-4', color)} />
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tier distribution + Top resellers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tier distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(kpis.tier_distribution)
                .sort(([, a], [, b]) => b - a)
                .map(([tier, count]) => {
                  const total = Object.values(kpis.tier_distribution).reduce((a, b) => a + b, 0)
                  const pct   = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={tier}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: TIER_COLORS[tier] ?? '#6b7280' }}
                          />
                          <span className="text-foreground">{tier}</span>
                        </span>
                        <span className="text-muted-foreground">{count} orgs ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: TIER_COLORS[tier] ?? '#6b7280',
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>

        {/* Top resellers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Top 10 Resellers by Sensors</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground">#</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Organization</TableHead>
                  <TableHead className="text-xs text-muted-foreground">Tier</TableHead>
                  <TableHead className="text-xs text-muted-foreground text-right">Sensors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.top_resellers.map((r, i) => (
                  <TableRow key={r.slug} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-sm text-foreground">{r.name}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-xs', TIER_BG_COLORS[r.tier] ?? 'bg-gray-700 text-gray-300')}>
                        {r.tier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground text-sm">
                      {r.sensor_count.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Invitation stats + Last sync */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Partner Recruitment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Invitations Sent (Pending)', value: kpis.total_invites_pending, color: 'text-amber-400' },
              { label: 'Invitations Accepted', value: kpis.total_invites_accepted, color: 'text-emerald-400' },
              {
                label: 'Acceptance Rate',
                value: kpis.total_invites_pending + kpis.total_invites_accepted > 0
                  ? `${Math.round(kpis.total_invites_accepted / (kpis.total_invites_pending + kpis.total_invites_accepted) * 100)}%`
                  : '—',
                color: 'text-cyan-400',
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={cn('text-lg font-bold', color)}>{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Last Sensor Sync</CardTitle>
          </CardHeader>
          <CardContent>
            {kpis.sync_log_last ? (
              <div className="space-y-3">
                {[
                  { label: 'Status',         value: kpis.sync_log_last.status, badge: true },
                  { label: 'Orgs Processed', value: kpis.sync_log_last.orgs_processed },
                  { label: 'Tier Changes',   value: kpis.sync_log_last.tier_changes },
                  { label: 'Duration',       value: `${kpis.sync_log_last.duration_ms}ms` },
                  { label: 'Run At',         value: new Date(kpis.sync_log_last.created_at).toLocaleString() },
                ].map(({ label, value, badge }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    {badge ? (
                      <Badge className={
                        value === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                        value === 'running'   ? 'bg-cyan-500/15 text-cyan-400' :
                        'bg-red-500/15 text-red-400'
                      }>{String(value)}</Badge>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{value}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">No syncs run yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export { HydraKPIDashboardPage }
