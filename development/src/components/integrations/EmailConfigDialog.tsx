'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { integrationService } from '@/services/integration.service'

interface EmailConfig {
  id?: string
  name: string
  smtp_host: string
  smtp_port: number
  username: string
  password: string
  from_email: string
  from_name?: string
  use_tls: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
}

export function EmailConfigDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  organizationId,
  onSaved 
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  
  const [config, setConfig] = useState<EmailConfig>({
    name: 'Email Notification Integration',
    smtp_host: '',
    smtp_port: 587,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    use_tls: true,
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

      if (data && data.api_key_encrypted) {
        const cfg = JSON.parse(data.api_key_encrypted)
        setConfig({
          id: data.id,
          name: data.name,
          smtp_host: cfg?.smtp_host || '',
          smtp_port: cfg?.smtp_port || 587,
          username: cfg?.username || '',
          password: cfg?.password || '',
          from_email: cfg?.from_email || '',
          from_name: cfg?.from_name || '',
          use_tls: cfg?.use_tls ?? true,
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
      const result: any = await integrationService.testIntegration(integrationId, 'email')
      setTestResult({
        success: result.success,
        message: result.message || 'Test email sent'
      })
      
      if (result.success) {
        toast.success('Test email sent successfully!')
      } else {
        toast.error(result.message || 'Failed to send test email')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send test email'
      setTestResult({ success: false, message })
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!config.name || !config.smtp_host || !config.username || !config.password || !config.from_email) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const payload = {
        organization_id: organizationId,
        integration_type: 'email',
        name: config.name,
        api_key_encrypted: JSON.stringify({
          smtp_host: config.smtp_host,
          smtp_port: config.smtp_port,
          username: config.username,
          password: config.password,
          from_email: config.from_email,
          from_name: config.from_name,
          use_tls: config.use_tls,
        }),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white dark:bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            {integrationId ? 'Edit' : 'Add'} Email (SMTP) Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., Notification Email"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host *</Label>
              <Input
                id="smtp-host"
                value={config.smtp_host}
                onChange={(e) => setConfig({ ...config, smtp_host: e.target.value })}
                placeholder="smtp.gmail.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="smtp-port">SMTP Port *</Label>
              <Input
                id="smtp-port"
                type="number"
                value={config.smtp_port}
                onChange={(e) => setConfig({ ...config, smtp_port: parseInt(e.target.value) || 587 })}
                placeholder="587"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              placeholder="your-email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              placeholder="Enter SMTP password or app password"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from-email">From Email *</Label>
              <Input
                id="from-email"
                type="email"
                value={config.from_email}
                onChange={(e) => setConfig({ ...config, from_email: e.target.value })}
                placeholder="noreply@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="from-name">From Name (Optional)</Label>
              <Input
                id="from-name"
                value={config.from_name}
                onChange={(e) => setConfig({ ...config, from_name: e.target.value })}
                placeholder="NetNeural Alerts"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="use-tls"
              checked={config.use_tls}
              onChange={(e) => setConfig({ ...config, use_tls: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="use-tls" className="cursor-pointer">Use TLS/SSL encryption</Label>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
