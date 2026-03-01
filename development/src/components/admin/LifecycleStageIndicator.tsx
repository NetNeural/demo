'use client'

import type { LifecycleStage } from '@/types/billing'
import { formatLifecycleStage } from '@/types/billing'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CheckCircle2 } from 'lucide-react'

interface LifecycleStageIndicatorProps {
  currentStage: LifecycleStage
  changedAt?: string | null
}

const STAGE_ORDER: LifecycleStage[] = [
  'trial',
  'onboarding',
  'active',
  'at_risk',
  'churned',
  'reactivated',
]

const stageColors: Record<LifecycleStage, { bg: string; ring: string; text: string; dot: string }> = {
  trial: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    ring: 'ring-blue-400',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  onboarding: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    ring: 'ring-purple-400',
    text: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
  active: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    ring: 'ring-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  at_risk: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    ring: 'ring-amber-400',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  churned: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    ring: 'ring-red-400',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
  reactivated: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    ring: 'ring-cyan-400',
    text: 'text-cyan-700 dark:text-cyan-400',
    dot: 'bg-cyan-500',
  },
}

/** Stepper-style lifecycle stage indicator */
export function LifecycleStageIndicator({ currentStage, changedAt }: LifecycleStageIndicatorProps) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage)

  // For the happy path (trial → onboarding → active), show sequential progression.
  // For negative stages (at_risk, churned), highlight them distinctly.
  const isNegativeStage = currentStage === 'at_risk' || currentStage === 'churned'
  const isReactivated = currentStage === 'reactivated'

  // Happy-path stages to show in the stepper
  const happyPath: LifecycleStage[] = ['trial', 'onboarding', 'active']

  return (
    <div className="space-y-3">
      {/* Stepper */}
      <div className="flex items-center gap-1">
        {happyPath.map((stage, idx) => {
          const isPast = !isNegativeStage && !isReactivated && currentIndex > idx
          const isCurrent = currentStage === stage
          const colors = stageColors[stage]

          return (
            <div key={stage} className="flex items-center">
              {/* Step circle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-center justify-center rounded-full transition-all ${
                        isCurrent
                          ? `h-9 w-9 ${colors.bg} ring-2 ${colors.ring}`
                          : isPast
                            ? 'h-7 w-7 bg-emerald-100 dark:bg-emerald-900/30'
                            : 'h-7 w-7 bg-muted'
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : isCurrent ? (
                        <span className={`h-3 w-3 rounded-full ${colors.dot}`} />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{formatLifecycleStage(stage)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Connector line */}
              {idx < happyPath.length - 1 && (
                <div
                  className={`h-0.5 w-6 ${
                    isPast || (isCurrent && idx < happyPath.length - 1)
                      ? 'bg-emerald-300 dark:bg-emerald-700'
                      : 'bg-muted-foreground/20'
                  }`}
                />
              )}
            </div>
          )
        })}

        {/* Show negative/special stages separately */}
        {(isNegativeStage || isReactivated) && (
          <>
            <div className="mx-2 h-0.5 w-4 bg-muted-foreground/20" />
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${stageColors[currentStage].bg} ${stageColors[currentStage].text}`}
            >
              <span className={`h-2 w-2 rounded-full ${stageColors[currentStage].dot}`} />
              {formatLifecycleStage(currentStage)}
            </div>
          </>
        )}
      </div>

      {/* Current stage label */}
      <div className="flex items-center gap-2">
        <span className={`text-sm font-semibold ${stageColors[currentStage].text}`}>
          {formatLifecycleStage(currentStage)}
        </span>
        {changedAt && (
          <span className="text-xs text-muted-foreground">
            since {new Date(changedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}
