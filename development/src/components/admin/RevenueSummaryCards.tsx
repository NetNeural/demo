'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import type { RevenueSummary } from '@/lib/admin/revenue-queries'

interface RevenueSummaryCardsProps {
  summary: RevenueSummary
  loading?: boolean
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function RevenueSummaryCards({ summary, loading }: RevenueSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-1 h-3 w-28 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const isPositiveChange = summary.netRevenueChange >= 0
  const cards = [
    {
      title: 'Total MRR',
      value: formatCurrency(summary.totalMrr),
      subtitle: `${summary.activeCount} active subscriptions`,
      icon: DollarSign,
      iconColor: 'text-emerald-600',
    },
    {
      title: 'Total ARR',
      value: formatCurrency(summary.totalArr),
      subtitle: 'MRR × 12 annualized',
      icon: BarChart3,
      iconColor: 'text-blue-600',
    },
    {
      title: 'Net Revenue Change',
      value: `${isPositiveChange ? '+' : ''}${formatCurrency(summary.netRevenueChange)}`,
      subtitle: `${isPositiveChange ? '+' : ''}${summary.netRevenueChangePct.toFixed(1)}% vs last month`,
      icon: isPositiveChange ? TrendingUp : TrendingDown,
      iconColor: isPositiveChange ? 'text-emerald-600' : 'text-red-600',
      badge: isPositiveChange ? (
        <span className="flex items-center text-xs text-emerald-600">
          <ArrowUpRight className="mr-0.5 h-3 w-3" />
          {summary.netRevenueChangePct.toFixed(1)}%
        </span>
      ) : (
        <span className="flex items-center text-xs text-red-600">
          <ArrowDownRight className="mr-0.5 h-3 w-3" />
          {Math.abs(summary.netRevenueChangePct).toFixed(1)}%
        </span>
      ),
    },
    {
      title: 'Churn Rate',
      value: `${summary.churnRate.toFixed(1)}%`,
      subtitle: `${summary.churnedCount} of ${summary.totalCustomers} orgs`,
      icon: Users,
      iconColor: summary.churnRate > 5 ? 'text-red-600' : 'text-amber-600',
    },
    {
      title: 'Trial → Paid',
      value: `${summary.trialToPaidRate.toFixed(1)}%`,
      subtitle: 'Conversion rate',
      icon: ArrowUpRight,
      iconColor: summary.trialToPaidRate > 50 ? 'text-emerald-600' : 'text-amber-600',
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.iconColor}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{card.value}</div>
              {card.badge}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
