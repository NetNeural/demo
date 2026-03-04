'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Info } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'
import { integrationService } from '@/services/integration.service'

interface EmailConfig {
  id?: string
  name: string
  api_key: string
  from_email: string
  from_name: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
  mode?: 'dialog' | 'page'
}

export function EmailConfigDialog({
  open,
  onOpenChange,
  integrationId,
  organizationId,
  onSaved,
  mode = 'dialog',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const [config, setConfig] = useState<EmailConfig>({
    name: 'Email Notification Integration',
    api_key: '',
    from_email: '',
    from_name: 'NetNeural Alerts',
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
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to load integrations'
        )
      }

      const integrations = (response.data as any)?.integrations || []
      const integration = integrations.find((i: any) => i.id === integrationId)

      if (integration?.config) {
        const cfg = integration.config as any
        setConfig({
          id: integration.id,
          name: integration.name,
          api_key: cfg.apiKey || cfg.password || '',
          from_email: cfg.fromEmail || cfg.from_email || '',
          from_name: cfg.fromName || cfg.from_name || 'NetNeural Alerts',
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
      const result: any = await integrationService.testIntegration(
        integrationId,
        'email'
      )
      setTestResult({
        success: result.success,
        message: result.message || 'Test email sent successfully',
      })

      if (result.success) {
        toast.success('Test email sent successfully!')
      } else {
        toast.error(result.message || 'Failed to send test email')
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send test email'
      setTestResult({ success: false, message })
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!config.name || !config.api_key || !config.from_email) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const emailConfig = {
        apiKey: config.api_key,
        fromEmail: config.from_email,
        fromName: config.from_name,
        provider: 'resend',
      }

      let response
      if (integrationId) {
        response = await edgeFunctions.integrations.update(integrationId, {
          name: config.name,
          settings: emailConfig,
          status: 'active',
        })
      } else {
        response = await edgeFunctions.integrations.create({
          organization_id: organizationId,
          integration_type: 'email',
          name: config.name,
          settings: emailConfig,
        } as any)
      }

      if (!response.success) {
        let errorMsg =
          typeof response.error === 'string'
            ? response.error
            : 'Failed to save integration'

        if (
          errorMsg.includes('duplicate key') ||
          errorMsg.includes('unique constraint')
        ) {
          errorMsg = `An email integration with the name "${config.name}" already exists. Please choose a different name.`
        }

        throw new Error(errorMsg)
      }

      toast.success('Email configuration saved successfully')
      onSaved?.()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to save configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  // Extract content into reusable component for both dialog and page modes
  const renderContent = () => (
    <>
      <div className="space-y-4 py-4">
        {/* Provider info banner */}
        <div className="flex items-start gap-2 rounded-md bg-blue-50 p-3 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="text-sm">
            <strong>Provider: Resend</strong> — Email notifications are sent via
            the{' '}
            <a
              href="https://resend.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Resend
            </a>{' '}
            email API. Enter your Resend API key and verified sender address
            below.
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Integration Name *</Label>
          <Input
            id="name"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="e.g., Notification Email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key">Resend API Key *</Label>
          <Input
            id="api-key"
            type="password"
            value={config.api_key}
            onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
            placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxxx"
          />
          <p className="text-xs text-muted-foreground">
            Get your API key from{' '}
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              resend.com/api-keys
            </a>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="from-email">From Email *</Label>
            <Input
              id="from-email"
              type="email"
              value={config.from_email}
              onChange={(e) =>
                setConfig({ ...config, from_email: e.target.value })
              }
              placeholder="alerts@yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">
              Must be a verified domain in Resend
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="from-name">From Name</Label>
            <Input
              id="from-name"
              value={config.from_name}
              onChange={(e) =>
                setConfig({ ...config, from_name: e.target.value })
              }
              placeholder="NetNeural Alerts"
            />
          </div>
        </div>
      </div>

      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-md p-3 ${
            testResult.success
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {testResult.success ? (
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          )}
          <div className="text-sm">{testResult.message}</div>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t pt-4">
        {integrationId && (
          <Button
            variant="secondary"
            onClick={handleTest}
            disabled={testing || loading}
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Test Email
          </Button>
        )}
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Configuration
        </Button>
      </div>
    </>
  )

  // Render as page or dialog based on mode
  if (mode === 'page') {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {integrationId ? 'Edit' : 'Add'} Email Integration
            </h2>
            <p className="text-muted-foreground">
              Configure email notifications via Resend
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            Provider: Resend
          </Badge>
        </div>

        <Card>
          <CardContent className="pt-6">{renderContent()}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white dark:bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            {integrationId ? 'Edit' : 'Add'} Email Integration
          </DialogTitle>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
