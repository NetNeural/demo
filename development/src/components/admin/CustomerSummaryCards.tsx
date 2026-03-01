'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  DollarSign,
  HeartPulse,
  TrendingDown,
  AlertTriangle,
  Building2,
} from 'lucide-react'
import type { CustomerSummaryStats } from '@/types/billing'

interface CustomerSummaryCardsProps {
  stats: CustomerSummaryStats | null
  loading: boolean
}

export function CustomerSummaryCards({ stats, loading }: CustomerSummaryCardsProps) {
  const cards = [
    {
      title: 'Total Customers',
      value: stats?.totalCustomers ?? 0,
      format: (v: number) => v.toLocaleString(),
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      subtitle: stats ? `${stats.activeCustomers} active` : undefined,
    },
    {
      title: 'Total MRR',
      value: stats?.totalMrr ?? 0,
      format: (v: number) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(v),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      subtitle: undefined,
    },
    {
      title: 'Avg Health Score',
      value: stats?.avgHealth ?? 0,
      format: (v: number) => `${v}/100`,
      icon: HeartPulse,
      color: stats && stats.avgHealth >= 80
        ? 'text-emerald-600'
        : stats && stats.avgHealth >= 50
          ? 'text-amber-600'
          : 'text-red-600',
      bgColor: stats && stats.avgHealth >= 80
        ? 'bg-emerald-50 dark:bg-emerald-900/20'
        : stats && stats.avgHealth >= 50
          ? 'bg-amber-50 dark:bg-amber-900/20'
          : 'bg-red-50 dark:bg-red-900/20',
      subtitle: undefined,
    },
    {
      title: 'At Risk',
      value: stats?.atRiskCount ?? 0,
      format: (v: number) => v.toLocaleString(),
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      subtitle: stats ? `${stats.churnRate}% churn rate` : undefined,
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold">{card.format(card.value)}</p>
                  {card.subtitle && (
                    <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                  )}
                </div>
                <div className={`rounded-lg p-2 ${card.bgColor}`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
