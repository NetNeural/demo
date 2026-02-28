'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface OfflineRuleStepProps {
  state: any
  updateState: (updates: any) => void
}

export function OfflineRuleStep({ state, updateState }: OfflineRuleStepProps) {
  const updateCondition = (field: string, value: any) => {
    updateState({
      condition: {
        ...state.condition,
        [field]: value,
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="offline_minutes">Offline Duration (minutes) *</Label>
        <Input
          id="offline_minutes"
          type="number"
          min="1"
          value={state.condition.offline_minutes || 15}
          onChange={(e) =>
            updateCondition('offline_minutes', parseInt(e.target.value))
          }
        />
        <p className="text-sm text-muted-foreground">
          Trigger alert if device hasn&apos;t been seen for this many minutes
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="grace_period">Grace Period (hours)</Label>
        <Input
          id="grace_period"
          type="number"
          min="0"
          value={state.condition.grace_period_hours || 0}
          onChange={(e) =>
            updateCondition('grace_period_hours', parseInt(e.target.value))
          }
        />
        <p className="text-sm text-muted-foreground">
          Skip newly added devices within this time window (useful for
          onboarding)
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <h4 className="mb-2 font-medium">How it Works:</h4>
        <p className="text-sm text-muted-foreground">
          Devices that haven&apos;t reported for{' '}
          <strong>{state.condition.offline_minutes || 15} minutes</strong> will
          trigger this rule
          {state.condition.grace_period_hours > 0 && (
            <>
              , except devices added within the last{' '}
              <strong>{state.condition.grace_period_hours} hours</strong>
            </>
          )}
          .
        </p>
      </div>
    </div>
  )
}
