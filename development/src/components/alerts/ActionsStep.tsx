'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Mail, MessageSquare, Webhook } from 'lucide-react'
import type { AlertRuleAction } from '@/lib/edge-functions/api/alert-rules'

interface ActionsStepProps {
  state: any
  updateState: (updates: any) => void
}

export function ActionsStep({ state, updateState }: ActionsStepProps) {
  const [newAction, setNewAction] = useState<Partial<AlertRuleAction>>({
    type: 'email',
    recipients: [],
    message_template: 'Alert triggered: {{rule_name}} for device {{device_name}}',
  })

  const addAction = () => {
    if (newAction.type === 'email' || newAction.type === 'sms') {
      if (!newAction.recipients || newAction.recipients.length === 0) {
        return
      }
    } else if (newAction.type === 'webhook') {
      if (!newAction.webhook_url) {
        return
      }
    }

    updateState({
      actions: [...state.actions, newAction],
    })

    setNewAction({
      type: 'email',
      recipients: [],
      message_template: 'Alert triggered: {{rule_name}} for device {{device_name}}',
    })
  }

  const removeAction = (index: number) => {
    updateState({
      actions: state.actions.filter((_: any, i: number) => i !== index),
    })
  }

  const updateCooldown = (minutes: number) => {
    updateState({ cooldownMinutes: minutes })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Configured Actions</h3>
        {state.actions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No actions configured yet. Add at least one action below.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {state.actions.map((action: AlertRuleAction, index: number) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      {action.type === 'email' && <Mail className="h-5 w-5 mt-1 text-primary" />}
                      {action.type === 'sms' && <MessageSquare className="h-5 w-5 mt-1 text-primary" />}
                      {action.type === 'webhook' && <Webhook className="h-5 w-5 mt-1 text-primary" />}
                      <div>
                        <p className="font-medium capitalize">{action.type}</p>
                        {(action.type === 'email' || action.type === 'sms') && (
                          <p className="text-sm text-muted-foreground">
                            {action.recipients?.join(', ')}
                          </p>
                        )}
                        {action.type === 'webhook' && (
                          <p className="text-sm text-muted-foreground break-all">
                            {action.webhook_url}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAction(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Action</CardTitle>
          <CardDescription>Configure how you want to be notified</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="action-type">Action Type</Label>
            <Select
              value={newAction.type}
              onValueChange={(value) =>
                setNewAction({ ...newAction, type: value as 'email' | 'sms' | 'webhook' })
              }
            >
              <SelectTrigger id="action-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email Notification</SelectItem>
                <SelectItem value="sms">SMS Notification</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(newAction.type === 'email' || newAction.type === 'sms') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="recipients">
                  Recipients ({newAction.type === 'email' ? 'Email addresses' : 'Phone numbers'})
                </Label>
                <Input
                  id="recipients"
                  placeholder={
                    newAction.type === 'email'
                      ? 'user@example.com, admin@example.com'
                      : '+1234567890, +0987654321'
                  }
                  onChange={(e) => {
                    const recipients = e.target.value.split(',').map((r) => r.trim()).filter(Boolean)
                    setNewAction({ ...newAction, recipients })
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message Template</Label>
                <Textarea
                  id="message"
                  value={newAction.message_template}
                  onChange={(e) =>
                    setNewAction({ ...newAction, message_template: e.target.value })
                  }
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {'{{'} rule_name {'}}'},  {'{{'} device_name {'}}'}
                </p>
              </div>
            </>
          )}

          {newAction.type === 'webhook' && (
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://api.example.com/webhooks/alerts"
                value={newAction.webhook_url}
                onChange={(e) => setNewAction({ ...newAction, webhook_url: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                POST request with JSON payload will be sent to this URL
              </p>
            </div>
          )}

          <Button onClick={addAction} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add Action
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label htmlFor="cooldown">Cooldown Period (minutes)</Label>
        <Input
          id="cooldown"
          type="number"
          min="1"
          value={state.cooldownMinutes}
          onChange={(e) => updateCooldown(parseInt(e.target.value))}
        />
        <p className="text-sm text-muted-foreground">
          Minimum time between consecutive alerts for the same rule (prevents spam)
        </p>
      </div>
    </div>
  )
}
