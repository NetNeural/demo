'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Activity, WifiOff, Target, Bell, Clock } from 'lucide-react'

interface ReviewStepProps {
  state: any
}

export function ReviewStep({ state }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {state.ruleType === 'telemetry' ? (
              <Activity className="h-5 w-5" />
            ) : (
              <WifiOff className="h-5 w-5" />
            )}
            <span>Rule Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{state.name}</p>
          </div>
          {state.description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p>{state.description}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">Type</p>
            <Badge variant="outline" className="mt-1">
              {state.ruleType === 'telemetry'
                ? 'Telemetry Rule'
                : 'Offline Detection'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Condition</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {state.ruleType === 'telemetry' ? (
            <div className="space-y-2">
              <p>
                <strong>Metric:</strong> {state.condition.metric}
              </p>
              <p>
                <strong>Condition:</strong> {state.condition.operator}{' '}
                {state.condition.value}
              </p>
              <p>
                <strong>Time Window:</strong>{' '}
                {state.condition.duration_minutes || 5} minutes
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p>
                <strong>Offline Duration:</strong>{' '}
                {state.condition.offline_minutes} minutes
              </p>
              {state.condition.grace_period_hours > 0 && (
                <p>
                  <strong>Grace Period:</strong>{' '}
                  {state.condition.grace_period_hours} hours
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Device Scope</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="capitalize">
            <strong>{state.deviceScope.type}</strong>
            {state.deviceScope.type !== 'all' && state.deviceScope.values && (
              <span> ({state.deviceScope.values.length} selected)</span>
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Actions ({state.actions.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {state.actions.map((action: any, index: number) => (
              <div key={index} className="flex items-center space-x-2">
                <Badge variant="secondary">{action.type}</Badge>
                {(action.type === 'email' || action.type === 'sms') && (
                  <span className="text-sm text-muted-foreground">
                    {action.recipients?.join(', ')}
                  </span>
                )}
                {action.type === 'webhook' && (
                  <span className="max-w-xs truncate text-sm text-muted-foreground">
                    {action.webhook_url}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Cooldown Period</p>
            <p className="font-medium">{state.cooldownMinutes} minutes</p>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enable rule immediately</Label>
            <Switch id="enabled" checked={state.enabled} disabled />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
        <h4 className="mb-2 font-medium">Ready to Create</h4>
        <p className="text-sm text-muted-foreground">
          Review the configuration above. Click &quot;Create Rule&quot; to
          activate monitoring for your devices.
        </p>
      </div>
    </div>
  )
}
