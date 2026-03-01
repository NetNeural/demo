'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Inbox,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Smartphone,
  Users,
  ExternalLink,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { HealthScoreBadge } from '@/components/admin/HealthScoreBadge'
import { CustomerSummaryCards } from '@/components/admin/CustomerSummaryCards'
import type { CustomerOverviewRow, CustomerSummaryStats, HealthStatus, LifecycleStage } from '@/types/billing'
import { getLifecycleStage, formatLifecycleStage } from '@/types/billing'
import {
  fetchCustomers,
  fetchCustomerSummary,
  fetchHealthStatusCounts,
  fetchPlanOptions,
  type CustomerFilters,
} from '@/lib/admin/customer-queries'

// Lazy singleton
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

const PAGE_SIZE = 25

const lifecycleColors: Record<LifecycleStage, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  onboarding: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  at_risk: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  churning: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  churned: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

type SortColumn = 'name' | 'health_score' | 'mrr' | 'device_count' | 'member_count' | 'last_active' | 'created_at'

export function CustomerTable() {
  const router = useRouter()
  const { fmt } = useDateFormatter()
  const supabase = getSupabase()

  // Data state
  const [customers, setCustomers] = useState<CustomerOverviewRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [summary, setSummary] = useState<CustomerSummaryStats | null>(null)
  const [healthCounts, setHealthCounts] = useState<Record<HealthStatus | 'all', number>>({ all: 0, healthy: 0, at_risk: 0, critical: 0 })
  const [planOptions, setPlanOptions] = useState<{ slug: string; name: string }[]>([])

  // UI state
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [healthFilter, setHealthFilter] = useState<HealthStatus | undefined>()
  const [planFilter, setPlanFilter] = useState<string | undefined>()
  const [lifecycleFilter, setLifecycleFilter] = useState<LifecycleStage | undefined>()
  const [sortBy, setSortBy] = useState<SortColumn>('name')
  const [sortDesc, setSortDesc] = useState(false)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, healthFilter, planFilter, lifecycleFilter, sortBy, sortDesc])

  // Load summary + plan options (once)
  useEffect(() => {
    let cancelled = false
    async function loadMeta() {
      setSummaryLoading(true)
      const [summaryResult, plans] = await Promise.all([
        fetchCustomerSummary(supabase),
        fetchPlanOptions(supabase),
      ])
      if (!cancelled) {
        setSummary(summaryResult)
        setPlanOptions(plans)
        setSummaryLoading(false)
      }
    }
    loadMeta()
    return () => { cancelled = true }
  }, [supabase])

  // Load customers
  const loadCustomers = useCallback(async () => {
    setLoading(true)
    const filters: CustomerFilters = {
      search: debouncedSearch || undefined,
      planSlug: planFilter,
      healthStatus: healthFilter,
      lifecycleStage: lifecycleFilter,
      sortBy,
      sortDesc,
    }

    const [result, counts] = await Promise.all([
      fetchCustomers(supabase, page, PAGE_SIZE, filters),
      fetchHealthStatusCounts(supabase),
    ])

    setCustomers(result.data)
    setTotalCount(result.count)
    setHealthCounts(counts)
    setLoading(false)
  }, [supabase, page, debouncedSearch, healthFilter, planFilter, lifecycleFilter, sortBy, sortDesc])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  function handleSort(col: SortColumn) {
    if (sortBy === col) {
      setSortDesc(!sortDesc)
    } else {
      setSortBy(col)
      setSortDesc(false)
    }
  }

  function SortIcon({ column }: { column: SortColumn }) {
    if (sortBy !== column) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
    return sortDesc
      ? <ArrowDown className="ml-1 h-3 w-3" />
      : <ArrowUp className="ml-1 h-3 w-3" />
  }

  function formatMrr(mrr: number | null): string {
    if (mrr === null || mrr === undefined) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(mrr))
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <CustomerSummaryCards stats={summary} loading={summaryLoading} />

      {/* Filters bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Health status filter */}
              <Select
                value={healthFilter || 'all'}
                onValueChange={(v) => setHealthFilter(v === 'all' ? undefined : v as HealthStatus)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Health" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Health ({healthCounts.all})</SelectItem>
                  <SelectItem value="healthy">Healthy ({healthCounts.healthy})</SelectItem>
                  <SelectItem value="at_risk">At Risk ({healthCounts.at_risk})</SelectItem>
                  <SelectItem value="critical">Critical ({healthCounts.critical})</SelectItem>
                </SelectContent>
              </Select>

              {/* Plan filter */}
              <Select
                value={planFilter || 'all'}
                onValueChange={(v) => setPlanFilter(v === 'all' ? undefined : v)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  {planOptions.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Lifecycle filter */}
              <Select
                value={lifecycleFilter || 'all'}
                onValueChange={(v) => setLifecycleFilter(v === 'all' ? undefined : v as LifecycleStage)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="churning">Churning</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh */}
              <Button variant="outline" size="icon" onClick={loadCustomers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-semibold">No customers found</p>
              <p className="text-sm text-muted-foreground">
                {debouncedSearch || healthFilter || planFilter || lifecycleFilter
                  ? 'Try adjusting your filters'
                  : 'No organizations exist yet'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button className="flex items-center font-medium" onClick={() => handleSort('name')}>
                          Organization <SortIcon column="name" />
                        </button>
                      </TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium" onClick={() => handleSort('device_count')}>
                          Devices <SortIcon column="device_count" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium" onClick={() => handleSort('member_count')}>
                          Members <SortIcon column="member_count" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium" onClick={() => handleSort('health_score')}>
                          Health <SortIcon column="health_score" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium" onClick={() => handleSort('mrr')}>
                          MRR <SortIcon column="mrr" />
                        </button>
                      </TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>
                        <button className="flex items-center font-medium" onClick={() => handleSort('last_active')}>
                          Last Active <SortIcon column="last_active" />
                        </button>
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((c) => {
                      const stage = getLifecycleStage(c)
                      return (
                        <TableRow
                          key={c.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/dashboard/admin/customers/${c.id}`)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.slug}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {c.plan_name || c.subscription_tier || 'None'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                              {c.device_count}
                              {c.active_device_count > 0 && (
                                <span className="text-xs text-emerald-600">
                                  ({c.active_device_count} active)
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              {c.member_count}
                            </span>
                          </TableCell>
                          <TableCell>
                            <HealthScoreBadge
                              score={c.health_score}
                              size="sm"
                              breakdown={{
                                login: c.login_frequency_score,
                                device: c.device_activity_score,
                                feature: c.feature_adoption_score,
                                support: c.support_ticket_score,
                                payment: c.payment_health_score,
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatMrr(c.mrr)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`border-0 ${lifecycleColors[stage]}`}
                            >
                              {formatLifecycleStage(stage)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {c.last_active ? fmt.timeAgo(c.last_active) : '—'}
                          </TableCell>
                          <TableCell>
                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="lg:hidden divide-y">
                {customers.map((c) => {
                  const stage = getLifecycleStage(c)
                  return (
                    <div
                      key={c.id}
                      className="p-4 cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/admin/customers/${c.id}`)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.slug}</p>
                        </div>
                        <HealthScoreBadge score={c.health_score} size="sm" />
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline" className="capitalize">
                          {c.plan_name || c.subscription_tier || 'None'}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`border-0 ${lifecycleColors[stage]}`}
                        >
                          {formatLifecycleStage(stage)}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <span>{c.device_count} devices</span>
                        <span>{c.member_count} members</span>
                        <span>{formatMrr(c.mrr)}</span>
                      </div>
                      {c.last_active && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last active: {fmt.timeAgo(c.last_active)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page + 1 >= totalPages}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
