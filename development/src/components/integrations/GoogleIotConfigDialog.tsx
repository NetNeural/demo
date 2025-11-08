'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { IntegrationStatusToggle } from './IntegrationStatusToggle'
import { integrationService } from '@/services/integration.service'

interface GoogleIotConfig {
  id?: string
  name: string
  project_id: string
  region: string
  registry_id: string
  service_account_key: string
  status: 'active' | 'inactive' | 'not-configured'
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
}

export function GoogleIotConfigDialog({ 
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
  
  const [config, setConfig] = useState<GoogleIotConfig>({
    name: 'Google Cloud IoT Integration',
    project_id: '',
    region: 'us-central1',
    registry_id: '',
    service_account_key: '',
    status: 'not-configured',
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
          project_id: cfg?.project_id || '',
          region: cfg?.region || 'us-central1',
          registry_id: cfg?.registry_id || '',
          service_account_key: cfg?.service_account_key || '',
          status: (data.status as 'active' | 'inactive' | 'not-configured') || 'not-configured',
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
      const result: any = await integrationService.testIntegration(integrationId, 'google_iot')
      setTestResult({
        success: result.success,
        message: result.message || 'Connection test completed'
      })
      
      if (result.success) {
        toast.success('Google Cloud IoT connection successful!')
      } else {
        toast.error(result.message || 'Connection test failed')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed'
      setTestResult({ success: false, message })
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!config.name || !config.project_id || !config.region || !config.registry_id || !config.service_account_key) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const payload = {
        organization_id: organizationId,
        integration_type: 'google_iot',
        name: config.name,
        api_key_encrypted: JSON.stringify({
          project_id: config.project_id,
          region: config.region,
          registry_id: config.registry_id,
          service_account_key: config.service_account_key,
        }),
        status: config.status,
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

      toast.success('Google Cloud IoT configuration saved successfully')
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
            {integrationId ? 'Edit' : 'Add'} Google Cloud IoT Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., Google IoT Production"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-id">Project ID *</Label>
            <Input
              id="project-id"
              value={config.project_id}
              onChange={(e) => setConfig({ ...config, project_id: e.target.value })}
              placeholder="my-gcp-project"
            />
            <p className="text-sm text-muted-foreground">
              Your Google Cloud Platform project ID
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="region">Region *</Label>
              <Input
                id="region"
                value={config.region}
                onChange={(e) => setConfig({ ...config, region: e.target.value })}
                placeholder="us-central1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="registry-id">Registry ID *</Label>
              <Input
                id="registry-id"
                value={config.registry_id}
                onChange={(e) => setConfig({ ...config, registry_id: e.target.value })}
                placeholder="my-device-registry"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-account">Service Account Key (JSON) *</Label>
            <textarea
              id="service-account"
              value={config.service_account_key}
              onChange={(e) => setConfig({ ...config, service_account_key: e.target.value })}
              placeholder='{"type": "service_account", "project_id": "...", ...}'
              className="w-full min-h-[120px] p-3 border rounded-md font-mono text-sm"
            />
            <p className="text-sm text-muted-foreground">
              Paste the entire JSON key file content from your Google Cloud service account
            </p>
          </div>
        </div>

        <IntegrationStatusToggle
          status={config.status}
          onStatusChange={(status) => setConfig({ ...config, status })}
          disabled={!config.project_id || !config.registry_id || !config.service_account_key}
          disabledMessage="Configure project ID, registry ID, and service account key to enable"
        />

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
              Test Connection
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
