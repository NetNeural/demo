'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TelemetryRuleStepProps {
  state: any
  updateState: (updates: any) => void
}

export function TelemetryRuleStep({
  state,
  updateState,
}: TelemetryRuleStepProps) {
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
        <Label htmlFor="metric">Metric Name *</Label>
        <Input
          id="metric"
          value={state.condition.metric || ''}
          onChange={(e) => updateCondition('metric', e.target.value)}
          placeholder="e.g., temperature, battery_level, humidity"
        />
        <p className="text-sm text-muted-foreground">
          The name of the telemetry metric to monitor (case-sensitive)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="operator">Operator *</Label>
          <Select
            value={state.condition.operator || ''}
            onValueChange={(value) => updateCondition('operator', value)}
          >
            <SelectTrigger id="operator">
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value=">">{`Greater than (>)`}</SelectItem>
              <SelectItem value=">=">{`Greater than or equal (>=)`}</SelectItem>
              <SelectItem value="<">{`Less than (<)`}</SelectItem>
              <SelectItem value="<=">{`Less than or equal (<=)`}</SelectItem>
              <SelectItem value="==">{`Equal to (==)`}</SelectItem>
              <SelectItem value="!=">{`Not equal to (!=)`}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="value">Threshold Value *</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            value={state.condition.value ?? ''}
            onChange={(e) =>
              updateCondition('value', parseFloat(e.target.value))
            }
            placeholder="e.g., 80"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input
          id="duration"
          type="number"
          min="1"
          value={state.condition.duration_minutes || 5}
          onChange={(e) =>
            updateCondition('duration_minutes', parseInt(e.target.value))
          }
        />
        <p className="text-sm text-muted-foreground">
          Check if condition is met within this time window (default: 5 minutes)
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
        <h4 className="mb-2 font-medium">Example Rule:</h4>
        <p className="text-sm text-muted-foreground">
          If <strong>temperature</strong> is{' '}
          <strong>{state.condition.operator || '>'}</strong>{' '}
          <strong>{state.condition.value || 'X'}</strong> within the last{' '}
          <strong>{state.condition.duration_minutes || 5} minutes</strong>,
          trigger alert
        </p>
      </div>
    </div>
  )
}
