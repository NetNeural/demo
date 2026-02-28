'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Copy,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Server,
} from 'lucide-react'
import { toast } from 'sonner'
import { edgeFunctions } from '@/lib/edge-functions/client'

interface MqttCredentials {
  broker_url: string
  client_id: string
  username: string
  password?: string
  topic_prefix: string
}

interface ExternalBrokerConfig {
  broker_url: string
  port: number
  protocol: string
  username: string
  password: string
  use_tls: boolean
}

interface BrokerConfig {
  broker_type?: string
  config?:
    | Record<string, unknown>
    | ExternalBrokerConfig
    | { use_hosted: boolean }
}

interface CredentialsResponse {
  credentials: MqttCredentials
  warning?: string
}

interface TestResponse {
  message: string
}

interface MqttBrokerConfigProps {
  integrationId: string
  organizationId: string
  currentConfig?: BrokerConfig
  onSave: (config: BrokerConfig) => Promise<void>
}

export function MqttBrokerConfig({
  integrationId,
  organizationId,
  currentConfig,
  onSave,
}: MqttBrokerConfigProps) {
  const [brokerType, setBrokerType] = useState<'hosted' | 'external'>(
    (currentConfig?.broker_type === 'external' ? 'external' : 'hosted') as
      | 'hosted'
      | 'external'
  )
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Hosted broker state
  const [credentials, setCredentials] = useState<MqttCredentials | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [generatingCreds, setGeneratingCreds] = useState(false)

  // External broker state
  const currentExternal = currentConfig?.config as
    | ExternalBrokerConfig
    | undefined
  const [externalConfig, setExternalConfig] = useState<ExternalBrokerConfig>({
    broker_url: currentExternal?.broker_url || '',
    port: currentExternal?.port || 1883,
    protocol: currentExternal?.protocol || 'mqtt',
    username: currentExternal?.username || '',
    password: currentExternal?.password || '',
    use_tls: currentExternal?.use_tls || false,
  })

  useEffect(() => {
    if (brokerType === 'hosted') {
      loadCredentials()
    }
  }, [brokerType, integrationId, organizationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const generateCredentials = useCallback(async () => {
    setGeneratingCreds(true)
    try {
      const result = await edgeFunctions.call<CredentialsResponse>(
        'mqtt-hybrid/credentials',
        {
          body: {
            integration_id: integrationId,
            organization_id: organizationId,
            action: 'generate',
          },
        }
      )

      if (result.success && result.data) {
        setCredentials(result.data.credentials)
        toast.success('Credentials generated successfully')
        if (result.data.warning) toast.warning(result.data.warning)
      } else {
        const errorMsg =
          typeof result.error === 'string'
            ? result.error
            : result.error?.message || 'Failed to generate credentials'
        throw new Error(errorMsg)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      toast.error('Failed to generate credentials: ' + message)
    } finally {
      setGeneratingCreds(false)
    }
  }, [integrationId, organizationId])

  const loadCredentials = useCallback(async () => {
    try {
      const result = await edgeFunctions.call<CredentialsResponse>(
        'mqtt-hybrid/credentials',
        {
          body: {
            integration_id: integrationId,
            organization_id: organizationId,
            action: 'get',
          },
        }
      )

      if (result.success && result.data?.credentials) {
        setCredentials(result.data.credentials)
      } else {
        // No credentials exist, auto-generate them
        await generateCredentials()
      }
    } catch (error) {
      console.error('Failed to load credentials:', error)
      // Try to generate on error too
      await generateCredentials()
    }
  }, [integrationId, organizationId, generateCredentials])

  async function testConnection() {
    setTesting(true)
    setTestResult(null)

    try {
      const result = await edgeFunctions.call<TestResponse>(
        'mqtt-hybrid/test',
        {
          body: {
            integration_id: integrationId,
            organization_id: organizationId,
          },
        }
      )

      const errorMsg =
        typeof result.error === 'string'
          ? result.error
          : result.error?.message || 'Connection failed'

      setTestResult({
        success: result.success,
        message: result.data?.message || errorMsg,
      })

      if (result.success) {
        toast.success('Connection test successful!')
      } else {
        toast.error('Connection test failed')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setTestResult({
        success: false,
        message,
      })
      toast.error('Connection test failed: ' + message)
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    const config = {
      broker_type: brokerType,
      config: brokerType === 'external' ? externalConfig : { use_hosted: true },
    }

    await onSave(config)
    toast.success('MQTT configuration saved')
  }

  function copyToClipboard(text: string, label?: string) {
    navigator.clipboard.writeText(text)
    toast.success(`${label || 'Value'} copied to clipboard`)
  }

  return (
    <div className="space-y-6">
      {/* Broker Type Selection - Clear Visual Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Hosted Broker Option */}
        <Card
          className={`cursor-pointer transition-all ${
            brokerType === 'hosted'
              ? 'shadow-md ring-2 ring-primary'
              : 'hover:border-primary/50'
          }`}
          onClick={() => setBrokerType('hosted')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">🚀 Hosted Message Queue</CardTitle>
              <Badge>Recommended</Badge>
            </div>
            <CardDescription className="text-base">
              POST directly to our message queue - no broker needed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Simple HTTP POST requests</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Auto-generated secure credentials</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Reliable message queueing (PGMQ)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Async processing & automatic retries</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* External Broker Option */}
        <Card
          className={`cursor-pointer transition-all ${
            brokerType === 'external'
              ? 'shadow-md ring-2 ring-primary'
              : 'hover:border-primary/50'
          }`}
          onClick={() => setBrokerType('external')}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">🔧 Advanced Setup</CardTitle>
              <Badge variant="outline">Enterprise</Badge>
            </div>
            <CardDescription className="text-base">
              Connect to your own MQTT broker infrastructure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span>Use your existing broker</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span>Full configuration control</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span>Support TCP, TLS, WebSocket</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span>On-premise or cloud</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                <span>Persistent MQTT subscriptions available</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* MQTT Subscriber Service Info - Only for External Brokers */}
      {brokerType === 'external' && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
          <Server className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            Optional: Persistent MQTT Subscriber Service
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            For advanced use cases requiring persistent MQTT subscriptions
            (e.g., devices publishing to broker topics), we offer a Docker-based
            subscriber service.
            <div className="mt-2 space-y-1 text-sm">
              <div>✓ Multi-broker support</div>
              <div>✓ Auto-reconnection & structured logging</div>
              <div>✓ Real-time telemetry storage</div>
            </div>
            <div className="mt-3">
              <a
                href="https://github.com/NetNeural/MonoRepo-Staging/tree/main/development/services/mqtt-subscriber"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                View Setup Documentation →
              </a>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {brokerType === 'hosted'
                  ? '🚀 Hosted Message Queue Setup'
                  : '🔧 External Broker Configuration'}
              </CardTitle>
              <CardDescription>
                {brokerType === 'hosted'
                  ? 'Get your credentials - devices POST messages via HTTP to our queue endpoint'
                  : 'Configure connection to your own MQTT broker infrastructure'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setBrokerType(brokerType === 'hosted' ? 'external' : 'hosted')
              }
            >
              Switch to {brokerType === 'hosted' ? 'External' : 'Hosted'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hosted Broker Content */}
          {brokerType === 'hosted' && (
            <div className="space-y-4">
              <Alert>
                <Server className="h-4 w-4" />
                <AlertTitle>How It Works: Hosted Message Queue</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      Your devices send data via simple HTTP POST requests to
                      our queue endpoint.
                    </p>
                    <p className="text-xs">
                      <strong>Behind the scenes:</strong> Messages go to a
                      Postgres Message Queue (PGMQ) for reliable, asynchronous
                      processing. This ensures no data loss, automatic retries,
                      and scalable handling of message bursts.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              {!credentials ? (
                <div className="py-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {generatingCreds
                        ? 'Generating credentials...'
                        : 'Loading credentials...'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>
                      ✅ Credentials Generated Successfully
                    </AlertTitle>
                    <AlertDescription>
                      <div className="space-y-1">
                        <p>
                          Use these credentials to authenticate your devices.
                          Messages will be queued and processed automatically.
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          ⚠️ Save the password now - it cannot be retrieved
                          later (only regenerated).
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Broker URL</Label>
                      <div className="flex gap-2">
                        <Input value={credentials.broker_url} readOnly />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(
                              credentials.broker_url,
                              'Broker URL'
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Client ID</Label>
                      <div className="flex gap-2">
                        <Input value={credentials.client_id} readOnly />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(credentials.client_id, 'Client ID')
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Username</Label>
                      <div className="flex gap-2">
                        <Input value={credentials.username} readOnly />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(credentials.username, 'Username')
                          }
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Password</Label>
                      <div className="flex gap-2">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={credentials.password || '••••••••••••••••'}
                          readOnly
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        {credentials.password && (
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() =>
                              credentials.password &&
                              copyToClipboard(credentials.password, 'Password')
                            }
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Topic Prefix</Label>
                    <Input value={credentials.topic_prefix} readOnly />
                    <p className="mt-1 text-sm text-muted-foreground">
                      Example: {credentials.topic_prefix}
                      devices/sensor01/telemetry
                    </p>
                  </div>

                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Save these credentials now. You can regenerate them, but
                      the current password will be lost.
                    </AlertDescription>
                  </Alert>

                  <Button
                    variant="outline"
                    onClick={generateCredentials}
                    disabled={generatingCreds}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate Credentials
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* External Broker Content */}
          {brokerType === 'external' && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Configure connection to your own MQTT broker. Supports TCP,
                  TLS, and WebSocket protocols.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="broker_url">Broker Hostname</Label>
                  <Input
                    id="broker_url"
                    placeholder="mqtt.example.com"
                    value={externalConfig.broker_url}
                    onChange={(e) =>
                      setExternalConfig({
                        ...externalConfig,
                        broker_url: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder="1883"
                    value={externalConfig.port}
                    onChange={(e) =>
                      setExternalConfig({
                        ...externalConfig,
                        port: parseInt(e.target.value) || 1883,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="protocol">Protocol</Label>
                <select
                  id="protocol"
                  title="MQTT Protocol"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                  value={externalConfig.protocol}
                  onChange={(e) =>
                    setExternalConfig({
                      ...externalConfig,
                      protocol: e.target.value,
                    })
                  }
                >
                  <option value="mqtt">MQTT (TCP)</option>
                  <option value="mqtts">MQTTS (TLS)</option>
                  <option value="ws">WebSocket</option>
                  <option value="wss">WebSocket Secure</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="mqtt_user"
                    value={externalConfig.username}
                    onChange={(e) =>
                      setExternalConfig({
                        ...externalConfig,
                        username: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={externalConfig.password}
                    onChange={(e) =>
                      setExternalConfig({
                        ...externalConfig,
                        password: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="use_tls"
                  checked={externalConfig.use_tls}
                  onCheckedChange={(checked) =>
                    setExternalConfig({ ...externalConfig, use_tls: checked })
                  }
                />
                <Label htmlFor="use_tls">Use TLS/SSL Encryption</Label>
              </div>

              <Alert>
                <AlertDescription>
                  <strong>Connection String:</strong> {externalConfig.protocol}
                  ://{externalConfig.broker_url || 'broker.example.com'}:
                  {externalConfig.port}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Test Connection - Same for Both */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Test Connection</h3>
                <p className="text-sm text-muted-foreground">
                  Verify your broker connection before saving
                </p>
              </div>
              <Button
                onClick={testConnection}
                disabled={testing}
                variant="outline"
              >
                {testing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
            </div>

            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex-1">
              {brokerType === 'hosted' ? (
                credentials ? (
                  <div className="text-sm">
                    <p className="font-medium text-green-600">
                      ✓ Ready to save
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Credentials generated. Saving will activate this
                      integration.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Loading credentials...
                  </p>
                )
              ) : (
                <div className="text-sm">
                  <p className="font-medium">Test connection first</p>
                  <p className="text-xs text-muted-foreground">
                    Verify your broker is reachable before saving
                  </p>
                </div>
              )}
            </div>
            <Button
              onClick={handleSave}
              size="lg"
              disabled={brokerType === 'hosted' && !credentials}
            >
              {brokerType === 'hosted' && !credentials
                ? 'Loading...'
                : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connection Examples */}
      <Card>
        <CardHeader>
          <CardTitle>📝 Integration Code Examples</CardTitle>
          <CardDescription>
            {brokerType === 'hosted'
              ? 'Copy these examples to send telemetry data. Works with any HTTP client - no MQTT library required!'
              : 'Sample code for connecting your devices to your MQTT broker'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={brokerType === 'hosted' ? 'curl' : 'arduino'}>
            <TabsList>
              {brokerType === 'hosted' ? (
                <>
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="nodejs">Node.js</TabsTrigger>
                  <TabsTrigger value="arduino">Arduino/ESP32</TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="arduino">Arduino/ESP32</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="nodejs">Node.js</TabsTrigger>
                </>
              )}
            </TabsList>

            {brokerType === 'hosted' ? (
              <>
                <TabsContent value="curl" className="mt-4">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`# Send telemetry data via HTTP POST
curl -X POST ${credentials?.broker_url || 'https://your-project.supabase.co/functions/v1/mqtt-ingest'} \\
  -H "Authorization: Bearer ${credentials?.password ? '********' : 'your_password'}" \\
  -H "X-Client-ID: ${credentials?.client_id || 'your_client_id'}" \\
  -H "X-Username: ${credentials?.username || 'your_username'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "topic": "${credentials?.topic_prefix || 'org_xxx/'}devices/sensor01/telemetry",
    "payload": {"temperature": 25.5, "humidity": 60},
    "qos": 0
  }'`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="python" className="mt-4">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`import requests

url = "${credentials?.broker_url || 'https://your-project.supabase.co/functions/v1/mqtt-ingest'}"
headers = {
    "Authorization": "Bearer ${credentials?.password ? '********' : 'your_password'}",
    "X-Client-ID": "${credentials?.client_id || 'your_client_id'}",
    "X-Username": "${credentials?.username || 'your_username'}",
    "Content-Type": "application/json"
}
data = {
    "topic": "${credentials?.topic_prefix || 'org_xxx/'}devices/sensor01/telemetry",
    "payload": {"temperature": 25.5, "humidity": 60},
    "qos": 0
}

response = requests.post(url, headers=headers, json=data)
print(response.json())`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="nodejs" className="mt-4">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`const fetch = require('node-fetch');

const url = '${credentials?.broker_url || 'https://your-project.supabase.co/functions/v1/mqtt-ingest'}';
const data = {
  topic: '${credentials?.topic_prefix || 'org_xxx/'}devices/sensor01/telemetry',
  payload: { temperature: 25.5, humidity: 60 },
  qos: 0
};

fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${credentials?.password ? '********' : 'your_password'}',
    'X-Client-ID': '${credentials?.client_id || 'your_client_id'}',
    'X-Username': '${credentials?.username || 'your_username'}',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
}).then(res => res.json()).then(console.log);`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="arduino" className="mt-4">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`#include <WiFi.h>
#include <HTTPClient.h>

const char* endpoint = "${credentials?.broker_url || 'https://your-project.supabase.co/functions/v1/mqtt-ingest'}";
const char* client_id = "${credentials?.client_id || 'your_client_id'}";
const char* username = "${credentials?.username || 'your_username'}";
const char* password = "${credentials?.password ? '********' : 'your_password'}";

void sendTelemetry() {
  HTTPClient http;
  http.begin(endpoint);
  http.addHeader("Authorization", "Bearer " + String(password));
  http.addHeader("X-Client-ID", client_id);
  http.addHeader("X-Username", username);
  http.addHeader("Content-Type", "application/json");
  
  String payload = "{\\"topic\\":\\"${credentials?.topic_prefix || 'org_xxx/'}devices/esp32/telemetry\\",\\"payload\\":{\\"temp\\":25.5}}";
  int httpCode = http.POST(payload);
  
  if (httpCode == 200) {
    Serial.println("Data sent successfully");
  }
  http.end();
}`}</code>
                  </pre>
                </TabsContent>
              </>
            ) : (
              <>
                <TabsContent value="arduino" className="mt-4">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`#include <WiFi.h>
#include <PubSubClient.h>

const char* mqtt_server = "${externalConfig.broker_url || 'mqtt.example.com'}";
const char* mqtt_user = "${externalConfig.username || 'your_username'}";
const char* mqtt_password = "********";
const char* client_id = "esp32_client";

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  client.setServer(mqtt_server, ${externalConfig.port || 1883});
  if (client.connect(client_id, mqtt_user, mqtt_password)) {
    client.publish("devices/esp32/telemetry", "{\\"temp\\": 25.5}");
  }
}`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="python" className="mt-4">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`import paho.mqtt.client as mqtt

client = mqtt.Client(client_id="python_client")
client.username_pw_set("${externalConfig.username || 'your_username'}", "********")
client.connect("${externalConfig.broker_url || 'mqtt.example.com'}", ${externalConfig.port || 1883})

client.publish("devices/sensor01/telemetry", '{"temp": 25.5}')
client.loop()`}</code>
                  </pre>
                </TabsContent>

                <TabsContent value="nodejs" className="mt-4">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
                    <code>{`const mqtt = require('mqtt');

const client = mqtt.connect('${externalConfig.protocol}://${externalConfig.broker_url || 'mqtt.example.com'}:${externalConfig.port || 1883}', {
  clientId: 'node_client',
  username: '${externalConfig.username || 'your_username'}',
  password: '********'
});

client.on('connect', () => {
  client.publish('devices/node01/telemetry', JSON.stringify({ temp: 25.5 }));
});`}</code>
                  </pre>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
