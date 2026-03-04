/**
 * Inventory Dashboard — Summary Cards
 *
 * Shows KPI cards: total items, inventory value, low stock alerts,
 * items issued, total revenue, and category breakdown.
 */
'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Package,
  DollarSign,
  AlertTriangle,
  TruckIcon,
  BarChart3,
  Layers,
} from 'lucide-react'
import type { InventoryStats, HardwareCategory } from './types'
import { CATEGORY_LABELS } from './types'

interface InventoryDashboardProps {
  stats: InventoryStats
  currency?: string
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function InventoryDashboard({
  stats,
  currency = 'USD',
}: InventoryDashboardProps) {
  const cards = [
    {
      title: 'Total Items',
      value: stats.totalItems.toLocaleString(),
      description: 'Unique SKUs in inventory',
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Inventory Value',
      value: formatCurrency(stats.totalValue, currency),
      description: 'At manufacturing cost',
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      title: 'Low Stock Alerts',
      value: stats.lowStockCount.toString(),
      description: 'Items below reorder threshold',
      icon: AlertTriangle,
      color: stats.lowStockCount > 0 ? 'text-red-600' : 'text-gray-400',
      bg: stats.lowStockCount > 0 ? 'bg-red-50' : 'bg-gray-50',
    },
    {
      title: 'Items Issued',
      value: stats.totalIssued.toLocaleString(),
      description: 'Units shipped to customers',
      icon: TruckIcon,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Revenue',
      value: formatCurrency(stats.totalRevenue, currency),
      description: 'From issued hardware',
      icon: BarChart3,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Margin',
      value:
        stats.totalRevenue > 0
          ? `${(((stats.totalRevenue - stats.totalValue) / stats.totalRevenue) * 100).toFixed(1)}%`
          : '—',
      description: 'Revenue vs manufacturing cost',
      icon: Layers,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
  ]

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`rounded-md p-2 ${card.bg}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">By Category</CardTitle>
          <CardDescription>
            Inventory distribution across product lines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(stats.categoryCounts) as [HardwareCategory, number][])
              .filter(([, count]) => count > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            {Object.values(stats.categoryCounts).every((c) => c === 0) && (
              <p className="text-sm text-muted-foreground">
                No inventory items yet
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
