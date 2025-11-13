'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'
import { integrationService } from '@/services/integration.service'

interface WebhookConfig {
  id?: string
  name: string
  url: string
  secret?: string
  method: 'POST' | 'PUT'
  content_type: 'application/json' | 'application/x-www-form-urlencoded'
  custom_headers?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
}

export function WebhookConfigDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  organizationId,
  onSaved 
}: Props) {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  
  const [config, setConfig] = useState<WebhookConfig>({
    name: 'Custom Webhook Integration',
    url: '',
    secret: '',
    method: 'POST',
    content_type: 'application/json',
    custom_headers: '',
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

      if (integration) {
        setConfig({
          id: integration.id,
          name: integration.name,
          url: integration.webhookUrl || '',
          secret: integration.webhookSecret || '',
          method: 'POST',
          content_type: 'application/json',
          custom_headers: '',
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
      const result: any = await integrationService.testIntegration(integrationId, 'webhook')
      setTestResult({
        success: result.success,
        message: result.message || 'Test webhook sent successfully'
      })
      
      if (result.success) {
        toast.success('Test webhook sent successfully!')
      } else {
        toast.error(result.message || 'Failed to send test webhook')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send test webhook'
      setTestResult({ success: false, message })
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!config.name || !config.url) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const webhookConfig = {
        url: config.url,
        secret: config.secret,
        webhookEnabled: true,
      }

      let response
      if (integrationId) {
        response = await edgeFunctions.integrations.update(integrationId, {
          name: config.name,
          settings: webhookConfig,
          status: 'active',
        })
      } else {
        response = await edgeFunctions.integrations.create({
          organization_id: organizationId,
          integration_type: 'webhook',
          name: config.name,
          settings: webhookConfig,
        } as any)
      }

      if (!response.success) {
        let errorMsg = typeof response.error === 'string' ? response.error : 'Failed to save integration'
        
        if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
          errorMsg = `A webhook integration with the name "${config.name}" already exists. Please choose a different name.`
        }
        
        throw new Error(errorMsg)
      }

      toast.success('Webhook configuration saved successfully')
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
            {integrationId ? 'Edit' : 'Add'} Custom Webhook Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., Data Pipeline Webhook"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">Webhook URL *</Label>
            <Input
              id="url"
              value={config.url}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="https://example.com/webhook"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secret">Secret Key (Optional)</Label>
            <Input
              id="secret"
              type="password"
              value={config.secret}
              onChange={(e) => setConfig({ ...config, secret: e.target.value })}
              placeholder="Used to sign webhook payloads"
            />
            <p className="text-sm text-muted-foreground">
              We&apos;ll include this in the X-Webhook-Signature header
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="method">HTTP Method</Label>
              <Select value={config.method} onValueChange={(value: 'POST' | 'PUT') => setConfig({ ...config, method: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content-type">Content Type</Label>
              <Select 
                value={config.content_type} 
                onValueChange={(value: 'application/json' | 'application/x-www-form-urlencoded') => 
                  setConfig({ ...config, content_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="application/json">application/json</SelectItem>
                  <SelectItem value="application/x-www-form-urlencoded">form-urlencoded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headers">Custom Headers (Optional)</Label>
            <Input
              id="headers"
              value={config.custom_headers}
              onChange={(e) => setConfig({ ...config, custom_headers: e.target.value })}
              placeholder='{"Authorization": "Bearer token", "X-Custom": "value"}'
            />
            <p className="text-sm text-muted-foreground">
              JSON object with additional headers to send
            </p>
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
              Send Test Webhook
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
