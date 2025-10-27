'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

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
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  
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
      const { data, error } = await supabase
        .from('device_integrations')
        .select('*')
        .eq('id', integrationId)
        .single()

      if (error) throw error

      if (data && data.webhook_url) {
        setConfig({
          id: data.id,
          name: data.name,
          webhook_url: data.webhook_url,
          channel: data.webhook_secret || '',
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

  const handleSave = async () => {
    if (!config.name || !config.webhook_url || !config.channel) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const payload = {
        organization_id: organizationId,
        integration_type: 'slack',
        name: config.name,
        webhook_url: config.webhook_url,
        webhook_secret: config.channel,
        status: 'active',
      }

      if (integrationId) {
        const { error } = await supabase
          .from('device_integrations')
          .update(payload)
          .eq('id', integrationId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('device_integrations')
          .insert(payload)

        if (error) throw error
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

        <DialogFooter>
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
