'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'
import { integrationService } from '@/services/integration.service'

interface SlackConfig {
  id?: string
  name: string
  webhook_url: string
  channel: string
  username?: string
  icon_emoji?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
}

export function SlackConfigDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  organizationId,
  onSaved 
}: Props) {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  
  const [config, setConfig] = useState<SlackConfig>({
    name: 'Slack Integration',
    webhook_url: '',
    channel: '',
    username: 'NetNeural Bot',
    icon_emoji: ':robot_face:',
  })

  useEffect(() => {
    if (integrationId && open) {
      loadConfig()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrationId, open])

  const loadConfig = async () => {
    if (!integrationId) return

    setLoading(true)
    try {
      const response = await edgeFunctions.integrations.list(organizationId)
      
      if (!response.success) {
        throw new Error(typeof response.error === 'string' ? response.error : 'Failed to load integrations')
      }

      const integrations = (response.data as any)?.integrations || []
      const integration = integrations.find((i: any) => i.id === integrationId)

      if (integration?.webhookUrl) {
        setConfig({
          id: integration.id,
          name: integration.name,
          webhook_url: integration.webhookUrl,
          channel: integration.webhookSecret || '',
          username: 'NetNeural Bot',
          icon_emoji: ':robot_face:',
        })
      }
    } catch (error) {
      toast.error('Failed to load configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    if (!integrationId) {
      toast.error('Please save the configuration before testing')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const result: any = await integrationService.testIntegration(integrationId, 'slack')
      setTestResult({
        success: result.success,
        message: result.message || 'Test message sent successfully'
      })
      
      if (result.success) {
        toast.success('Test message sent successfully!')
      } else {
        toast.error(result.message || 'Failed to send test message')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send test message'
      setTestResult({ success: false, message })
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!config.name || !config.webhook_url || !config.channel) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const slackConfig = {
        webhookUrl: config.webhook_url,
        channel: config.channel,
        username: config.username,
        iconEmoji: config.icon_emoji,
      }

      let response
      if (integrationId) {
        response = await edgeFunctions.integrations.update(integrationId, {
          name: config.name,
          config: slackConfig,
          status: 'active',
        })
      } else {
        response = await edgeFunctions.integrations.create({
          organization_id: organizationId,
          integration_type: 'slack',
          name: config.name,
          settings: slackConfig,
        } as any)
      }

      if (!response.success) {
        let errorMsg = typeof response.error === 'string' ? response.error : 'Failed to save integration'
        
        if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
          errorMsg = `A Slack integration with the name "${config.name}" already exists. Please choose a different name.`
        }
        
        throw new Error(errorMsg)
      }

      toast.success('Slack configuration saved successfully')
      onSaved?.()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to save configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white dark:bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            {integrationId ? 'Edit' : 'Add'} Slack Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., Team Alerts"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL *</Label>
            <Input
              id="webhook-url"
              type="password"
              value={config.webhook_url}
              onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
              placeholder="https://hooks.slack.com/services/..."
            />
            <p className="text-sm text-muted-foreground">
              Create a webhook URL in your Slack workspace settings → Apps → Incoming Webhooks
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel">Channel *</Label>
            <Input
              id="channel"
              value={config.channel}
              onChange={(e) => setConfig({ ...config, channel: e.target.value })}
              placeholder="#alerts"
            />
            <p className="text-sm text-muted-foreground">
              The channel where notifications will be posted
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Bot Username (Optional)</Label>
              <Input
                id="username"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="NetNeural Bot"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icon Emoji (Optional)</Label>
              <Input
                id="icon"
                value={config.icon_emoji}
                onChange={(e) => setConfig({ ...config, icon_emoji: e.target.value })}
                placeholder=":robot_face:"
              />
            </div>
          </div>
        </div>

        {testResult && (
          <div className={`p-3 rounded-md flex items-start gap-2 ${
            testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {testResult.success ? (
              <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            )}
            <div className="text-sm">{testResult.message}</div>
          </div>
        )}

        <DialogFooter>
          {integrationId && (
            <Button 
              variant="secondary" 
              onClick={handleTest} 
              disabled={testing || loading}
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Test Message
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
