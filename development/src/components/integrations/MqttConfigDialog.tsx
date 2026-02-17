'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, CheckCircle, XCircle, Server, AlertCircle } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { IntegrationActivityLog } from './IntegrationActivityLog'
import { IntegrationSyncTab } from './IntegrationSyncTab'
import { integrationService } from '@/services/integration.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface MqttConfig {
  id?: string
  name: string
  broker_type?: 'hosted' | 'external'
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
  onSaved?: (integrationId?: string) => void
  mode?: 'dialog' | 'page' // 'dialog' for modal overlay, 'page' for inline rendering
  initialBrokerType?: 'hosted' | 'external'
}

export function MqttConfigDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  organizationId,
  onSaved,
  mode = 'dialog', // Default to dialog mode for backward compatibility
  initialBrokerType,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [credentials, setCredentials] = useState<{
    username: string
    password?: string
    client_id: string
    broker_url: string
    topic_prefix: string
  } | null>(null)
  const [generatingCreds, setGeneratingCreds] = useState(false)
  const [savedIntegrationId, setSavedIntegrationId] = useState<string | undefined>(integrationId)
  
  const [config, setConfig] = useState<MqttConfig>({
    name: 'MQTT Broker Integration',
    broker_type: initialBrokerType || 'hosted',
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
        broker_type: initialBrokerType || 'hosted',
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
          settings?: {
            brokerType?: 'hosted' | 'external'
            brokerUrl?: string
            port?: number
            username?: string
            password?: string
            clientId?: string
            useTls?: boolean
            topics?: string
            payloadParser?: 'standard' | 'vmark' | 'custom'
            customParserConfig?: {
              device_id_path?: string
              telemetry_path?: string
              timestamp_path?: string
              timestamp_format?: string
            }
          }
        }>
      }

      const data = response.data as IntegrationResponse
      const integration = data.integrations?.find((i) => i.id === integrationId)
      
      if (integration?.settings) {
        const s = integration.settings
        setConfig({
          id: integration.id,
          name: integration.name,
          broker_type: s.brokerType || 'external',
          broker_url: s.brokerUrl || '',
          port: s.port || 1883,
          username: s.username || '',
          password: s.password || '',
          client_id: s.clientId || '',
          use_tls: s.useTls ?? false,
          topics: s.topics || '',
          payload_parser: s.payloadParser || 'standard',
          custom_parser_config: s.customParserConfig || {
            device_id_path: 'device',
            telemetry_path: 'data',
            timestamp_path: 'timestamp',
            timestamp_format: 'iso8601',
          },
        })
      }
    } catch (error) {
      toast.error('Failed to load configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadCredentials = async () => {
    if (!integrationId) return
    
    try {
      // Try to fetch existing credentials
      const { data, error } = await edgeFunctions.call('mqtt-hybrid/credentials', {
        method: 'POST',
        body: {
          integration_id: integrationId,
          organization_id: organizationId,
          action: 'get'
        }
      })
      
      if (!error && (data as any)?.credentials) {
        setCredentials((data as any).credentials)
      }
    } catch (error) {
      console.error('Failed to load credentials:', error)
    }
  }

  const handleGenerateCredentials = async () => {
    if (!savedIntegrationId) {
      toast.error('Please save the integration first')
      return
    }
    
    setGeneratingCreds(true)
    try {
      const { data, error } = await edgeFunctions.call('mqtt-hybrid/credentials', {
        method: 'POST',
        body: {
          integration_id: savedIntegrationId,
          organization_id: organizationId,
          action: 'generate'
        }
      })
      
      if (error) throw new Error(typeof error === 'string' ? error : error.message)
      
      const responseData = data as any
      setCredentials(responseData.credentials)
      toast.success('Credentials generated successfully')
      
      // Update integration settings with new credentials
      if (responseData.credentials.password) {
        try {
          await edgeFunctions.integrations.update(savedIntegrationId, {
            settings: {
              ...config,
              username: responseData.credentials.username,
              password: responseData.credentials.password,
              clientId: responseData.credentials.client_id,
              brokerUrl: responseData.credentials.broker_url,
              topicPrefix: responseData.credentials.topic_prefix,
            },
          })
        } catch (updateErr) {
          console.error('Failed to update settings with credentials:', updateErr)
        }
      }
      
      // Show warning about password
      if (responseData.warning) {
        toast.warning(responseData.warning, { duration: 8000 })
      }
    } catch (error: any) {
      toast.error(`Failed to generate credentials: ${error.message}`)
    } finally {
      setGeneratingCreds(false)
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
    if (!config.name) {
      toast.error('Please provide an integration name')
      return
    }
    
    // Validate external broker has required fields
    if (config.broker_type === 'external' && !config.broker_url) {
      toast.error('Please provide broker URL for external broker')
      return
    }

    setLoading(true)
    try {
      // For hosted broker, set placeholder values (will be replaced by generated credentials)
      const mqttConfig = {
        brokerType: config.broker_type || 'external',
        brokerUrl: config.broker_type === 'hosted' ? 'wss://mqtt.netneural.io:9001/mqtt' : config.broker_url,
        port: config.broker_type === 'hosted' ? 9001 : config.port,
        username: config.username,
        password: config.password,
        clientId: config.client_id,
        useTls: config.broker_type === 'hosted' ? true : config.use_tls,
        topics: config.topics,
        payloadParser: config.payload_parser,
        customParserConfig: config.custom_parser_config,
      }

      let response
      if (integrationId) {
        response = await edgeFunctions.integrations.update(integrationId, {
          name: config.name,
          settings: mqttConfig,
          status: 'active',
        })
        
        if (!response.success) {
          console.error('[MQTT Save] Update error:', response.error);
          throw new Error(typeof response.error === 'string' ? response.error : 'Failed to update integration')
        }
      } else {
        const integrationType = config.broker_type === 'hosted' ? 'mqtt_hosted' : 'mqtt_external';
        
        response = await edgeFunctions.integrations.create({
          organization_id: organizationId,
          integration_type: integrationType,
          name: config.name,
          settings: mqttConfig,
        } as any)
        
        if (!response.success) {
          console.error('[MQTT Save] Create error:', response.error);
          console.error('[MQTT Save] Full response:', JSON.stringify(response, null, 2));
          let errorMsg = typeof response.error === 'string' ? response.error : 'Failed to create integration'
          
          if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
            errorMsg = `An MQTT integration with the name "${config.name}" already exists. Please choose a different name.`
          } else if (errorMsg.includes('Internal Server Error')) {
            errorMsg = `Failed to create MQTT integration. Please restart the Edge Functions server and try again. (Code was updated but server not restarted)`
          }
          
          throw new Error(errorMsg)
        }
      }

      toast.success('MQTT configuration saved successfully')
      
      // Get the integration ID from response
      const responseData = response.data as { id?: string; integration?: { id?: string } }
      const newIntegrationId = integrationId || responseData?.id || responseData?.integration?.id
      
      // Update state with new integration ID
      if (newIntegrationId) {
        setSavedIntegrationId(newIntegrationId)
      }
      
      // For hosted broker, auto-generate credentials if this is a new integration
      if (config.broker_type === 'hosted' && !integrationId && newIntegrationId) {
        try {
          const { data: credData, error: credError } = await edgeFunctions.call('mqtt-hybrid/credentials', {
            method: 'POST',
            body: {
              integration_id: newIntegrationId,
              organization_id: organizationId,
              action: 'generate'
            }
          })
          
          const credResponse = credData as any
          if (!credError && credResponse?.credentials) {
            setCredentials(credResponse.credentials)
            toast.success('MQTT credentials generated!', { duration: 5000 })
            
            // Update integration settings with credentials for publishing
            if (credResponse.credentials.password) {
              try {
                await edgeFunctions.integrations.update(newIntegrationId, {
                  settings: {
                    ...mqttConfig,
                    username: credResponse.credentials.username,
                    password: credResponse.credentials.password,
                    clientId: credResponse.credentials.client_id,
                    brokerUrl: credResponse.credentials.broker_url,
                    topicPrefix: credResponse.credentials.topic_prefix,
                  },
                })
              } catch (updateErr) {
                console.error('Failed to update settings with credentials:', updateErr)
              }
            }
          }
        } catch (credErr) {
          console.error('Failed to auto-generate credentials:', credErr)
          toast.warning('Integration saved, but credential generation failed. Use "Generate Credentials" button.')
        }
      }
      
      // Call onSaved callback with integration ID
      if (onSaved) {
        onSaved(newIntegrationId)
      }
      
      // Don't close dialog if hosted broker so user can see credentials
      if (config.broker_type !== 'hosted' || integrationId) {
        onOpenChange(false)
      }
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

  // Extract content into a reusable component for both dialog and page modes
  const renderContent = () => (
    <>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start bg-gray-100 dark:bg-gray-800">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
            {/* Broker Type Selection */}
            <div className="grid md:grid-cols-2 gap-3 mb-6">
              {/* Hosted Broker Option */}
              <Card 
                className={`cursor-pointer transition-all ${
                  config.broker_type === 'hosted' ? 'ring-2 ring-primary shadow-md' : 'hover:border-primary/50'
                }`}
                onClick={() => setConfig({ ...config, broker_type: 'hosted' })}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">🚀 Hosted Broker</CardTitle>
                    <Badge variant="default" className="text-xs">Recommended</Badge>
                  </div>
                  <CardDescription className="text-sm">
                    NetNeural managed broker - quick setup
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Auto-generated credentials</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      <span>Secure WebSocket connection</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* External Broker Option */}
              <Card 
                className={`cursor-pointer transition-all ${
                  config.broker_type === 'external' ? 'ring-2 ring-primary shadow-md' : 'hover:border-primary/50'
                }`}
                onClick={() => setConfig({ ...config, broker_type: 'external' })}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">🔧 External Broker</CardTitle>
                    <Badge variant="outline" className="text-xs">Advanced</Badge>
                  </div>
                  <CardDescription className="text-sm">
                    Use your own MQTT infrastructure
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-3">
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-blue-600" />
                      <span>Your existing broker</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-blue-600" />
                      <span>Full configuration control</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {config.broker_type === 'hosted' && savedIntegrationId && (
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Hosted Broker Credentials
                  </CardTitle>
                  <CardDescription>
                    Use these credentials to connect your MQTT devices to NetNeural&apos;s hosted broker
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!credentials ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        No credentials generated yet. Click below to create your secure MQTT credentials.
                      </p>
                      <Button 
                        onClick={handleGenerateCredentials} 
                        disabled={generatingCreds}
                        variant="default"
                      >
                        {generatingCreds && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Generate Credentials
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* HTTP Publish Endpoint */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">🌐 HTTP Publish Endpoint</Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 font-mono">
                            {`${window.location.origin.replace('3000', '54321')}/functions/v1/mqtt-hybrid/publish`}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          POST messages to this URL (Supabase Edge Function)
                        </p>
                      </div>

                      {/* Broker Endpoint */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">📡 MQTT Broker Endpoint (Direct Connect)</Label>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm bg-white dark:bg-gray-800 p-2 rounded border">
                            {credentials.broker_url}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">WebSocket secure connection for MQTT clients</p>
                      </div>

                      {/* Username */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Username</Label>
                        <code className="block text-sm bg-white dark:bg-gray-800 p-2 rounded border">
                          {credentials.username}
                        </code>
                      </div>

                      {/* Password - only shown once */}
                      {credentials.password && (
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-orange-600">Password (shown once only!)</Label>
                          <code className="block text-sm bg-orange-50 dark:bg-orange-950/20 p-2 rounded border border-orange-200">
                            {credentials.password}
                          </code>
                          <Alert className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              Save this password securely. It cannot be retrieved again. If lost, regenerate credentials.
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}

                      {/* Client ID */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Client ID</Label>
                        <code className="block text-sm bg-white dark:bg-gray-800 p-2 rounded border">
                          {credentials.client_id}
                        </code>
                      </div>

                      {/* Topic Prefix */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Topic Prefix</Label>
                        <code className="block text-sm bg-white dark:bg-gray-800 p-2 rounded border">
                          {credentials.topic_prefix}
                        </code>
                        <p className="text-xs text-muted-foreground">
                          All your topics must start with this prefix
                        </p>
                      </div>

                      {/* Allowed Topics */}
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Allowed Topics</Label>
                        <div className="space-y-1">
                          <code className="block text-sm bg-green-50 dark:bg-green-950/20 p-2 rounded border border-green-200">
                            {credentials.topic_prefix}devices/#
                          </code>
                          <code className="block text-sm bg-green-50 dark:bg-green-950/20 p-2 rounded border border-green-200">
                            {credentials.topic_prefix}commands/#
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          # = wildcard for all subtopics
                        </p>
                      </div>

                      {/* Connection Examples */}
                      <div className="space-y-3 pt-2 border-t">
                        <Label className="text-xs font-semibold">📤 Option 1: HTTP POST (Easiest)</Label>
                        <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
{`// Send data via HTTP POST to Supabase Edge Function
const SUPABASE_URL = '${window.location.origin.replace('3000', '54321')}'
const SUPABASE_ANON_KEY = 'your-anon-key'

fetch(\`\${SUPABASE_URL}/functions/v1/mqtt-hybrid/publish\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${SUPABASE_ANON_KEY}\`
  },
  body: JSON.stringify({
    integration_id: '${savedIntegrationId}',
    organization_id: '${organizationId}',
    messages: [{
      topic: '${credentials.topic_prefix}devices/sensor-01/telemetry',
      payload: {
        temperature: 22.5,
        humidity: 45,
        timestamp: new Date().toISOString()
      },
      qos: 0,
      retain: false
    }]
  })
})`}
                        </pre>

                        <Label className="text-xs font-semibold">📡 Option 2: Native MQTT Client</Label>
                        <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
{`// JavaScript/Node.js
const mqtt = require('mqtt')
const client = mqtt.connect('${credentials.broker_url}', {
  username: '${credentials.username}',
  password: '${credentials.password || '***'}',
  clientId: '${credentials.client_id}'
})

client.on('connect', () => {
  // Publish telemetry
  client.publish(
    '${credentials.topic_prefix}devices/sensor-01/telemetry',
    JSON.stringify({
      temperature: 22.5,
      humidity: 45,
      timestamp: new Date().toISOString()
    })
  )
  
  // Subscribe to commands
  client.subscribe('${credentials.topic_prefix}commands/#')
})`}
                        </pre>
                      </div>

                      {/* Regenerate Button */}
                      <div className="pt-2">
                        <Button 
                          onClick={handleGenerateCredentials}
                          disabled={generatingCreds}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          {generatingCreds && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Regenerate Credentials
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1 text-center">
                          This will invalidate the old credentials
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {config.broker_type === 'hosted' && !integrationId && (
              <Alert>
                <Server className="h-4 w-4" />
                <AlertTitle>Hosted Broker Selected</AlertTitle>
                <AlertDescription>
                  Save the integration first, then we&apos;ll generate your secure MQTT credentials with connection details.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Integration Name *</Label>
              <Input
                id="name"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                placeholder="e.g., Production MQTT Broker"
              />
            </div>

            {/* Only show broker config for external type */}
            {config.broker_type === 'external' && (
              <>
                <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                  <Server className="h-4 w-4" />
                  <AlertTitle>External Broker Configuration</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>Connect to your own MQTT broker infrastructure. Ensure your broker is accessible from NetNeural&apos;s servers.</p>
                    <ul className="list-disc list-inside text-xs space-y-1 mt-2">
                      <li>Use <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded">mqtt://</code> for plain TCP (port 1883)</li>
                      <li>Use <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded">mqtts://</code> for TLS (port 8883)</li>
                      <li>Use <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded">ws://</code> for WebSocket (port 9001)</li>
                      <li>Use <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded">wss://</code> for secure WebSocket (port 9001)</li>
                    </ul>
                  </AlertDescription>
                </Alert>
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

                <div className="flex items-center space-x-2">
                  <Switch
                    id="use-tls"
                    checked={config.use_tls}
                    onCheckedChange={(checked) => setConfig({ ...config, use_tls: checked })}
                  />
                  <Label htmlFor="use-tls" className="cursor-pointer">Use TLS/SSL encryption</Label>
                </div>
              </>
            )}

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
      </>
  )

  // Render as dialog or inline based on mode
  if (mode === 'page') {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">MQTT Broker Integration</h2>
            <p className="text-muted-foreground">Configure your MQTT broker connection</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            MQTT Broker Integration
          </DialogTitle>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
