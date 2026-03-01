'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts'
import type { WaterfallDataPoint } from '@/lib/admin/revenue-queries'

interface ChurnWaterfallChartProps {
  data: WaterfallDataPoint[]
  loading?: boolean
}

function formatCurrencyTick(value: number): string {
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

export function ChurnWaterfallChart({ data, loading }: ChurnWaterfallChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>New vs Churned MRR</CardTitle>
          <CardDescription>Monthly MRR gains and losses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    )
  }

  // Transform data: churned shown as negative
  const chartData = data.map((d) => ({
    ...d,
    churnedMrr: -d.churnedMrr,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>New vs Churned MRR</CardTitle>
        <CardDescription>
          Monthly revenue gains (green) and losses from churn (red) — last {data.length} months
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No waterfall data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={formatCurrencyTick}
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number, name: string) => {
                  const label = name === 'newMrr' ? 'New MRR' : 'Churned MRR'
                  return [`$${Math.abs(value).toFixed(2)}`, label]
                }) as any}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              />
              <Legend
                formatter={(value: string) =>
                  value === 'newMrr' ? 'New MRR' : 'Churned MRR'
                }
              />
              <ReferenceLine y={0} stroke="#9ca3af" />
              <Bar
                dataKey="newMrr"
                fill="#22c55e"
                radius={[4, 4, 0, 0]}
                name="newMrr"
              />
              <Bar
                dataKey="churnedMrr"
                fill="#ef4444"
                radius={[0, 0, 4, 4]}
                name="churnedMrr"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
