'use client'

import { useMemo } from 'react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Trophy, AlertTriangle, TrendingUp } from 'lucide-react'
import {
  TIER_BG_COLORS,
  TIER_COLORS,
  type ResellerTierEngineResult,
} from '@/types/reseller'
import { cn } from '@/lib/utils'

interface FleetProgressBarProps {
  tierData: ResellerTierEngineResult
  className?: string
  compact?: boolean // compact mode for dashboard cards
}

function GracePeriodBadge({ lockedUntil }: { lockedUntil: string }) {
  const daysLeft = Math.ceil(
    (new Date(lockedUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400">
      <AlertTriangle className="h-3.5 w-3.5" />
      Grace Period: {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
    </div>
  )
}

export function FleetProgressBar({
  tierData,
  className,
  compact = false,
}: FleetProgressBarProps) {
  const {
    current_tier,
    discount_pct,
    effective_total,
    direct_sensors,
    downstream_sensors,
    sensors_to_next_tier,
    next_tier_name,
    grace_active,
    tier_locked_until,
  } = tierData

  const isMaxTier = !next_tier_name

  // Progress percentage toward next tier
  const progressPct = useMemo(() => {
    if (isMaxTier) return 100
    if (!next_tier_name || sensors_to_next_tier === 0) return 100
    // Approximate: (effective / next_threshold) * 100
    const nextThreshold = effective_total + sensors_to_next_tier
    return Math.min(100, Math.round((effective_total / nextThreshold) * 100))
  }, [effective_total, sensors_to_next_tier, isMaxTier, next_tier_name])

  const tierColor = TIER_COLORS[current_tier] ?? '#6b7280'
  const tierBadgeClass =
    TIER_BG_COLORS[current_tier] ?? 'bg-gray-100 text-gray-700'

  if (compact) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-300">{current_tier}</span>
          {!isMaxTier && (
            <span className="text-gray-500">
              {sensors_to_next_tier.toLocaleString()} to {next_tier_name}
            </span>
          )}
        </div>
        <Progress
          value={progressPct}
          className="h-1.5 bg-gray-800"
          style={{ '--progress-color': tierColor } as React.CSSProperties}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-white/[0.08] bg-gray-900/60 p-5',
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-400">Partner Tier</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge className={cn('text-sm font-semibold', tierBadgeClass)}>
              {current_tier}
            </Badge>
            <span
              className="text-sm font-semibold"
              style={{ color: tierColor }}
            >
              {(discount_pct * 100).toFixed(0)}% Discount
            </span>
          </div>
        </div>
        {isMaxTier && (
          <div className="flex items-center gap-1.5 rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-300">
            <Trophy className="h-3.5 w-3.5" />
            Maximum Tier
          </div>
        )}
        {grace_active && tier_locked_until && (
          <GracePeriodBadge lockedUntil={tier_locked_until} />
        )}
      </div>

      {/* Animated sensor counter */}
      <div className="mb-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="cursor-default text-3xl font-bold tabular-nums text-white">
                {effective_total.toLocaleString()}
                <span className="ml-1 text-sm font-normal text-gray-500">
                  active sensors
                </span>
              </p>
            </TooltipTrigger>
            <TooltipContent className="border-gray-700 bg-gray-900 text-gray-200">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between gap-6">
                  <span>Direct sensors:</span>
                  <span className="font-semibold">
                    {direct_sensors.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-6">
                  <span>Downstream sensors:</span>
                  <span className="font-semibold">
                    {downstream_sensors.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between gap-6 border-t border-gray-700 pt-1">
                  <span>Effective total:</span>
                  <span className="font-semibold">
                    {effective_total.toLocaleString()}
                  </span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <Progress
          value={progressPct}
          className="h-2.5 bg-gray-800"
          style={{ '--progress-color': tierColor } as React.CSSProperties}
        />
        {!isMaxTier ? (
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{effective_total.toLocaleString()} sensors</span>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>
                <strong className="text-gray-200">
                  {sensors_to_next_tier.toLocaleString()}
                </strong>{' '}
                more to{' '}
                <span
                  className="font-semibold"
                  style={{ color: TIER_COLORS[next_tier_name ?? ''] ?? '#fff' }}
                >
                  {next_tier_name}
                </span>
              </span>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-violet-300">
            🏆 You&apos;ve reached the highest tier — Platinum 40% discount
          </p>
        )}
      </div>
    </div>
  )
}
