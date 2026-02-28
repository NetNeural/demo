'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Activity, WifiOff } from 'lucide-react'

interface RuleTypeStepProps {
  state: any
  updateState: (updates: any) => void
}

export function RuleTypeStep({ state, updateState }: RuleTypeStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Rule Name *</Label>
        <Input
          id="name"
          value={state.name}
          onChange={(e) => updateState({ name: e.target.value })}
          placeholder="e.g., High Temperature Alert"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={state.description}
          onChange={(e) => updateState({ description: e.target.value })}
          placeholder="Describe what this rule monitors and when it triggers"
          rows={3}
        />
      </div>

      <div className="space-y-4">
        <Label>Rule Type *</Label>
        <RadioGroup
          value={state.ruleType || ''}
          onValueChange={(value) =>
            updateState({ ruleType: value as 'telemetry' | 'offline' })
          }
        >
          <Card
            className={state.ruleType === 'telemetry' ? 'border-primary' : ''}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start space-x-3">
                <RadioGroupItem
                  value="telemetry"
                  id="telemetry"
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <CardTitle>Telemetry Rule</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    Monitor sensor data and trigger alerts based on threshold
                    conditions (temperature, battery, custom metrics)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Card
            className={state.ruleType === 'offline' ? 'border-primary' : ''}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="offline" id="offline" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <WifiOff className="h-5 w-5 text-primary" />
                    <CardTitle>Offline Detection</CardTitle>
                  </div>
                  <CardDescription className="mt-2">
                    Get notified when devices go offline or stop reporting for a
                    specified period
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </RadioGroup>
      </div>
    </div>
  )
}
