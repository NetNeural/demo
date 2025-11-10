'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { IntegrationActivityLog } from './IntegrationActivityLog'
import { IntegrationSyncTab } from './IntegrationSyncTab'
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
  payload_parser?: 'standard' | 'vmark' | 'custom'
  custom_parser_config?: {
    device_id_path?: string
    telemetry_path?: string
    timestamp_path?: string
    timestamp_format?: string
  }
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
    payload_parser: 'standard',
    custom_parser_config: {
      device_id_path: 'device',
      telemetry_path: 'data',
      timestamp_path: 'timestamp',
      timestamp_format: 'iso8601',
    },
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
      const response = await edgeFunctions.integrations.list(organizationId)
      
      if (!response.success) {
        throw new Error(typeof response.error === 'string' ? response.error : 'Failed to load integrations')
      }

      interface IntegrationResponse {
        integrations: Array<{
          id: string
          name: string
          type: string
          settings?: Record<string, unknown>
          config?: {
            brokerUrl?: string
            port?: number
            username?: string
            password?: string
            clientId?: string
            useTls?: boolean
            topics?: string
          }
        }>
      }

      const data = response.data as IntegrationResponse
      const integration = data.integrations?.find((i) => i.id === integrationId)
      
      if (integration?.config) {
        const cfg = integration.config
        setConfig({
          id: integration.id,
          name: integration.name,
          broker_url: cfg.brokerUrl || '',
          port: cfg.port || 1883,
          username: cfg.username || '',
          password: cfg.password || '',
          client_id: cfg.clientId || '',
          use_tls: cfg.useTls ?? false,
          topics: cfg.topics || '',
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
      interface TestResult {
        success: boolean
        message?: string
      }
      
      const result = await integrationService.testIntegration(integrationId, 'mqtt') as TestResult
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
      const mqttConfig = {
        brokerUrl: config.broker_url,
        port: config.port,
        username: config.username,
        password: config.password,
        clientId: config.client_id,
        useTls: config.use_tls,
        topics: config.topics,
      }

      console.log('[MQTT Save] Config:', { ...mqttConfig, password: '[REDACTED]' });

      let response
      if (integrationId) {
        console.log('[MQTT Save] Updating integration:', integrationId);
        response = await edgeFunctions.integrations.update(integrationId, {
          name: config.name,
          config: mqttConfig,
          status: 'active',
        })
        
        if (!response.success) {
          console.error('[MQTT Save] Update error:', response.error);
          throw new Error(typeof response.error === 'string' ? response.error : 'Failed to update integration')
        }
        console.log('[MQTT Save] Update successful');
      } else {
        console.log('[MQTT Save] Creating new integration');
        response = await edgeFunctions.integrations.create({
          organization_id: organizationId,
          integration_type: 'mqtt',
          name: config.name,
          settings: mqttConfig,
        } as any)
        
        if (!response.success) {
          console.error('[MQTT Save] Create error:', response.error);
          let errorMsg = typeof response.error === 'string' ? response.error : 'Failed to create integration'
          
          if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
            errorMsg = `An MQTT integration with the name "${config.name}" already exists. Please choose a different name.`
          }
          
          throw new Error(errorMsg)
        }
        console.log('[MQTT Save] Create successful');
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            MQTT Broker Integration
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100 dark:bg-gray-100">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="run-sync">Run Sync</TabsTrigger>
            <TabsTrigger value="activity">Activity Log</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4">
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

            {/* Payload Parser Configuration */}
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="payload-parser">Payload Parser</Label>
                <Select
                  value={config.payload_parser || 'standard'}
                  onValueChange={(value) => setConfig({ ...config, payload_parser: value as 'standard' | 'vmark' | 'custom' })}
                >
                  <SelectTrigger id="payload-parser">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (JSON with id, data, timestamp)</SelectItem>
                    <SelectItem value="vmark">VMark (device, paras, time)</SelectItem>
                    <SelectItem value="custom">Custom (Configure paths)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose how to parse incoming MQTT payloads
                </p>
              </div>

              {config.payload_parser === 'vmark' && (
                <div className="pl-4 py-2 border-l-2 border-blue-500 bg-blue-50 dark:bg-blue-950/20 rounded-r">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>VMark Protocol Detected</strong>
                    <br />
                    Expecting payloads like:
                    <code className="block mt-1 text-xs bg-white dark:bg-gray-800 p-2 rounded">
                      {`{ "device": "2400390030314701", "handle": "properties_report", "paras": { "temperature": 22.77, "RSSI": -20 }, "time": "2025-04-23_07:35:22.214" }`}
                    </code>
                  </p>
                </div>
              )}

              {config.payload_parser === 'custom' && (
                <div className="space-y-3 pl-4 border-l-2 border-gray-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="device-id-path">Device ID Path</Label>
                      <Input
                        id="device-id-path"
                        value={config.custom_parser_config?.device_id_path || 'device'}
                        onChange={(e) => setConfig({
                          ...config,
                          custom_parser_config: {
                            ...config.custom_parser_config,
                            device_id_path: e.target.value
                          }
                        })}
                        placeholder="device"
                      />
                      <p className="text-xs text-muted-foreground">JSON path to device identifier</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="telemetry-path">Telemetry Path</Label>
                      <Input
                        id="telemetry-path"
                        value={config.custom_parser_config?.telemetry_path || 'data'}
                        onChange={(e) => setConfig({
                          ...config,
                          custom_parser_config: {
                            ...config.custom_parser_config,
                            telemetry_path: e.target.value
                          }
                        })}
                        placeholder="data"
                      />
                      <p className="text-xs text-muted-foreground">JSON path to telemetry object</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="timestamp-path">Timestamp Path</Label>
                      <Input
                        id="timestamp-path"
                        value={config.custom_parser_config?.timestamp_path || 'timestamp'}
                        onChange={(e) => setConfig({
                          ...config,
                          custom_parser_config: {
                            ...config.custom_parser_config,
                            timestamp_path: e.target.value
                          }
                        })}
                        placeholder="timestamp"
                      />
                      <p className="text-xs text-muted-foreground">JSON path to timestamp</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timestamp-format">Timestamp Format</Label>
                      <Select
                        value={config.custom_parser_config?.timestamp_format || 'iso8601'}
                        onValueChange={(value) => setConfig({
                          ...config,
                          custom_parser_config: {
                            ...config.custom_parser_config,
                            timestamp_format: value
                          }
                        })}
                      >
                        <SelectTrigger id="timestamp-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iso8601">ISO 8601 (2025-04-23T07:35:22Z)</SelectItem>
                          <SelectItem value="unix">Unix Timestamp (1745647522)</SelectItem>
                          <SelectItem value="vmark">VMark (2025-04-23_07:35:22.214)</SelectItem>
                          <SelectItem value="custom">Custom Format</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="use-tls"
                checked={config.use_tls}
                onCheckedChange={(checked) => setConfig({ ...config, use_tls: checked })}
              />
              <Label htmlFor="use-tls" className="cursor-pointer">Use TLS/SSL encryption</Label>
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
          </TabsContent>

          {/* Run Sync Tab - Import only (MQTT reads from topics) */}
          {integrationId && (
            <TabsContent value="run-sync" className="space-y-4">
              <IntegrationSyncTab
                integrationId={integrationId}
                organizationId={organizationId}
                integrationType="mqtt"
                integrationName={config.name}
                availableDirections={['import']}
                defaultOptions={{ direction: 'import' }}
                showCreateMissing={true}
                showUpdateExisting={true}
                helpText="MQTT sync imports device status from subscribed topics. Export is not supported as MQTT is typically read-only."
              />
            </TabsContent>
          )}

          {/* Activity Log Tab */}
          {integrationId && (
            <TabsContent value="activity" className="space-y-4">
              <IntegrationActivityLog
                integrationId={integrationId}
                organizationId={organizationId}
                limit={50}
                autoRefresh={true}
              />
            </TabsContent>
          )}
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
