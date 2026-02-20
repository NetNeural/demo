'use client'

import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface DataFreshnessProps {
  lastUpdated: Date | string
  /** Threshold in minutes for considering data stale */
  staleThreshold?: number
  /** Threshold in minutes for warning */
  warningThreshold?: number
  showIcon?: boolean
  variant?: 'badge' | 'inline' | 'full'
  className?: string
}

export function DataFreshness({
  lastUpdated,
  staleThreshold = 60, // Default 1 hour
  warningThreshold = 15, // Default 15 minutes
  showIcon = true,
  variant = 'inline',
  className,
}: DataFreshnessProps) {
  const date =
    typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated
  const now = new Date()
  const minutesAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  const status =
    minutesAgo > staleThreshold
      ? 'stale'
      : minutesAgo > warningThreshold
        ? 'warning'
        : 'fresh'

  const timeAgo = formatDistanceToNow(date, { addSuffix: true })

  const getIcon = () => {
    switch (status) {
      case 'stale':
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      case 'warning':
        return <Clock className="h-3.5 w-3.5 text-yellow-500" />
      case 'fresh':
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'stale':
        return 'Stale data'
      case 'warning':
        return 'Data may be outdated'
      case 'fresh':
        return 'Up to date'
    }
  }

  if (variant === 'badge') {
    return (
      <Badge
        variant={
          status === 'stale'
            ? 'destructive'
            : status === 'warning'
              ? 'secondary'
              : 'outline'
        }
        className={cn('text-xs', className)}
      >
        {showIcon && getIcon()}
        <span className={showIcon ? 'ml-1' : ''}>{timeAgo}</span>
      </Badge>
    )
  }

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs text-muted-foreground',
          status === 'stale' && 'text-red-600 dark:text-red-400',
          status === 'warning' && 'text-yellow-600 dark:text-yellow-400',
          className
        )}
      >
        {showIcon && getIcon()}
        <span>Updated {timeAgo}</span>
      </span>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm',
        status === 'stale' && 'text-red-600 dark:text-red-400',
        status === 'warning' && 'text-yellow-600 dark:text-yellow-400',
        status === 'fresh' && 'text-green-600 dark:text-green-400',
        className
      )}
    >
      {showIcon && getIcon()}
      <div>
        <span className="font-medium">{getStatusText()}</span>
        <span className="ml-1 text-muted-foreground">· Updated {timeAgo}</span>
      </div>
    </div>
  )
}

/**
 * Hook for real-time freshness updates
 * Re-renders component every minute to update "X minutes ago" text
 */
export function useDataFreshness(lastUpdated: Date | string) {
  const [, setTick] = useState(0)

  useEffect(() => {
    // Update every minute
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  const date =
    typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated
  const minutesAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60))

  return {
    minutesAgo,
    formattedTime: formatDistanceToNow(date, { addSuffix: true }),
  }
}

// Import statement for useEffect and useState
import { useEffect, useState } from 'react'
