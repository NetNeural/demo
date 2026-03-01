'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Smartphone,
  CreditCard,
  Users,
  Bell,
  LogIn,
  ArrowRightLeft,
  Calendar,
} from 'lucide-react'
import type { TimelineEntry } from '@/types/billing'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface CustomerTimelineProps {
  entries: TimelineEntry[]
  loading: boolean
}

const typeConfig: Record<TimelineEntry['type'], { icon: typeof Smartphone; color: string; bgColor: string }> = {
  lifecycle: {
    icon: ArrowRightLeft,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  device: {
    icon: Smartphone,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  payment: {
    icon: CreditCard,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  subscription: {
    icon: Calendar,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  member: {
    icon: Users,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
  },
  alert: {
    icon: Bell,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  login: {
    icon: LogIn,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-800/30',
  },
}

const typeBadgeColors: Record<TimelineEntry['type'], string> = {
  lifecycle: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  device: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  payment: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  subscription: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  member: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  alert: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  login: 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400',
}

export function CustomerTimeline({ entries, loading }: CustomerTimelineProps) {
  const { fmt } = useDateFormatter()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity recorded yet
          </p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-0">
              {entries.map((entry, idx) => {
                const config = typeConfig[entry.type]
                const Icon = config.icon
                const isLast = idx === entries.length - 1

                return (
                  <div key={entry.id} className={`relative flex gap-3 ${isLast ? '' : 'pb-4'}`}>
                    {/* Icon */}
                    <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bgColor}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{entry.title}</p>
                          {entry.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
                              {entry.description}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`border-0 text-[10px] px-1.5 py-0 ${typeBadgeColors[entry.type]}`}
                          >
                            {entry.type}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            {fmt.timeAgo(entry.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
