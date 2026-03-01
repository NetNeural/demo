'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { HealthStatus } from '@/types/billing'
import { getHealthStatus, formatHealthStatus } from '@/types/billing'

interface HealthScoreBadgeProps {
  score: number
  showScore?: boolean
  size?: 'sm' | 'md'
  /** Optional breakdown for tooltip */
  breakdown?: {
    login: number | null
    device: number | null
    feature: number | null
    support: number | null
    payment: number | null
  }
}

const statusConfig: Record<HealthStatus, { className: string; dotColor: string }> = {
  healthy: {
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
  },
  at_risk: {
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  critical: {
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
}

export function HealthScoreBadge({ score, showScore = true, size = 'md', breakdown }: HealthScoreBadgeProps) {
  const status = getHealthStatus(score)
  const config = statusConfig[status]
  const label = formatHealthStatus(status)

  const badge = (
    <Badge
      variant="outline"
      className={`${config.className} border-0 font-medium ${size === 'sm' ? 'text-xs px-1.5 py-0' : 'text-sm px-2 py-0.5'}`}
    >
      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${config.dotColor}`} />
      {showScore ? `${score} — ${label}` : label}
    </Badge>
  )

  if (!breakdown) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <p className="font-semibold">Health Score Breakdown</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span className="text-muted-foreground">Login frequency</span>
              <span className="text-right">{breakdown.login ?? '—'}/100 (25%)</span>
              <span className="text-muted-foreground">Device activity</span>
              <span className="text-right">{breakdown.device ?? '—'}/100 (25%)</span>
              <span className="text-muted-foreground">Feature adoption</span>
              <span className="text-right">{breakdown.feature ?? '—'}/100 (20%)</span>
              <span className="text-muted-foreground">Support (inverse)</span>
              <span className="text-right">{breakdown.support ?? '—'}/100 (15%)</span>
              <span className="text-muted-foreground">Payment health</span>
              <span className="text-right">{breakdown.payment ?? '—'}/100 (15%)</span>
            </div>
            <div className="mt-1 border-t pt-1">
              <span className="font-medium">Composite: {score}/100</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
