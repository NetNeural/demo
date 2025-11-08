'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { integrationService } from '@/services/integration.service'

interface MqttConfig {
  id?: string
  name: string
  broker_url: string
  port: number
  username?: string
  password?: string
  client_id?: string
  use_tls: boolean
  topics?: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
}

export function MqttConfigDialog({ 
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
  
  const [config, setConfig] = useState<MqttConfig>({
    name: 'MQTT Broker Integration',
    broker_url: '',
    port: 1883,
    username: '',
    password: '',
    client_id: '',
    use_tls: false,
    topics: '',
  })

  useEffect(() => {
    if (integrationId && open) {
      loadConfig()
    } else if (!integrationId && open) {
      // Reset to default config when opening dialog for new integration
      setConfig({
        name: 'MQTT Broker Integration',
        broker_url: '',
        port: 1883,
        username: '',
        password: '',
        client_id: '',
        use_tls: false,
        topics: '',
      })
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
          broker_url: cfg?.broker_url || '',
          port: cfg?.port || 1883,
          username: cfg?.username || '',
          password: cfg?.password || '',
          client_id: cfg?.client_id || '',
          use_tls: cfg?.use_tls ?? false,
          topics: cfg?.topics || '',
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
      const result: any = await integrationService.testIntegration(integrationId, 'mqtt')
      setTestResult({
        success: result.success,
        message: result.message || 'Connection test completed'
      })
      
      if (result.success) {
        toast.success('MQTT broker connection successful!')
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
    if (!config.name || !config.broker_url) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const payload = {
        organization_id: organizationId,
        integration_type: 'mqtt',
        name: config.name,
        api_key_encrypted: JSON.stringify({
          broker_url: config.broker_url,
          port: config.port,
          username: config.username,
          password: config.password,
          client_id: config.client_id,
          use_tls: config.use_tls,
          topics: config.topics,
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

      toast.success('MQTT configuration saved successfully')
      
      // Call onSaved callback first (triggers refresh in parent)
      if (onSaved) {
        onSaved()
      }
      
      // Close dialog - parent component handles this via onSaved
      // but we also call it here as a fallback
      onOpenChange(false)
    } catch (error: unknown) {
      const err = error as { message?: string; details?: string; hint?: string }
      const errorMessage = err?.message || 'Unknown error occurred';
      const errorDetails = err?.details || err?.hint || '';
      
      console.error('MQTT Config Save Error:', {
        error,
        message: errorMessage,
        details: errorDetails,
        config: {
          name: config.name,
          broker_url: config.broker_url,
          port: config.port,
          organizationId,
          integrationId
        }
      });
      
      toast.error(`Failed to save configuration: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`);
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white dark:bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            {integrationId ? 'Edit' : 'Add'} MQTT Broker Integration
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., Production MQTT Broker"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="broker-url">Broker URL *</Label>
              <Input
                id="broker-url"
                value={config.broker_url}
                onChange={(e) => setConfig({ ...config, broker_url: e.target.value })}
                placeholder="mqtt://broker.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="port">Port *</Label>
              <Input
                id="port"
                type="number"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 1883 })}
                placeholder="1883"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username (Optional)</Label>
              <Input
                id="username"
                value={config.username}
                onChange={(e) => setConfig({ ...config, username: e.target.value })}
                placeholder="mqtt_user"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password (Optional)</Label>
              <Input
                id="password"
                type="password"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID (Optional)</Label>
            <Input
              id="client-id"
              value={config.client_id}
              onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
              placeholder="netneural-client-1"
            />
            <p className="text-sm text-muted-foreground">
              Leave empty to auto-generate
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="topics">Topics (Optional)</Label>
            <Input
              id="topics"
              value={config.topics}
              onChange={(e) => setConfig({ ...config, topics: e.target.value })}
              placeholder="devices/+/telemetry,alerts/#"
            />
            <p className="text-sm text-muted-foreground">
              Comma-separated list of topics to subscribe to
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="use-tls"
              checked={config.use_tls}
              onCheckedChange={(checked) => setConfig({ ...config, use_tls: checked })}
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
