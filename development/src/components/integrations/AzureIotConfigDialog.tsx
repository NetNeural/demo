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

interface AzureIotConfig {
  id?: string
  name: string
  connection_string: string
  hub_name: string
  shared_access_key?: string
  status: 'active' | 'inactive' | 'not-configured'
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
}

export function AzureIotConfigDialog({ 
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
  
  const [config, setConfig] = useState<AzureIotConfig>({
    name: 'Azure IoT Hub Integration',
    connection_string: '',
    hub_name: '',
    shared_access_key: '',
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
          connection_string: cfg?.connection_string || '',
          hub_name: cfg?.hub_name || '',
          shared_access_key: cfg?.shared_access_key || '',
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
      const result: any = await integrationService.testIntegration(integrationId, 'azure_iot')
      setTestResult({
        success: result.success,
        message: result.message || 'Connection test completed'
      })
      
      if (result.success) {
        toast.success('Azure IoT Hub connection successful!')
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
    if (!config.name || !config.connection_string || !config.hub_name) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const payload = {
        organization_id: organizationId,
        integration_type: 'azure_iot',
        name: config.name,
        api_key_encrypted: JSON.stringify({
          connection_string: config.connection_string,
          hub_name: config.hub_name,
          shared_access_key: config.shared_access_key,
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

      toast.success('Azure IoT Hub configuration saved successfully')
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
            {integrationId ? 'Edit' : 'Add'} Azure IoT Hub Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., Azure IoT Production"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hub-name">IoT Hub Name *</Label>
            <Input
              id="hub-name"
              value={config.hub_name}
              onChange={(e) => setConfig({ ...config, hub_name: e.target.value })}
              placeholder="my-iot-hub"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="connection-string">Connection String *</Label>
            <Input
              id="connection-string"
              type="password"
              value={config.connection_string}
              onChange={(e) => setConfig({ ...config, connection_string: e.target.value })}
              placeholder="HostName=...;SharedAccessKeyName=...;SharedAccessKey=..."
            />
            <p className="text-sm text-muted-foreground">
              Get this from your Azure IoT Hub → Shared access policies
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shared-key">Shared Access Key (Optional)</Label>
            <Input
              id="shared-key"
              type="password"
              value={config.shared_access_key}
              onChange={(e) => setConfig({ ...config, shared_access_key: e.target.value })}
              placeholder="Additional access key if needed"
            />
          </div>
        </div>

        <IntegrationStatusToggle
          status={config.status}
          onStatusChange={(status) => setConfig({ ...config, status })}
          disabled={!config.connection_string || !config.hub_name}
          disabledMessage="Configure connection string and hub name to enable"
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
