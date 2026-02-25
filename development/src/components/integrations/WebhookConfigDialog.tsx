'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  CheckCircle,
  XCircle,
  Copy,
  ExternalLink,
  FileCode,
} from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'
import { integrationService } from '@/services/integration.service'

interface WebhookConfig {
  id?: string
  name: string
  url: string
  secret?: string
  custom_headers?: string
  trigger_events?: string[]
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
  mode?: 'dialog' | 'page'
}

export function WebhookConfigDialog({
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

  const [config, setConfig] = useState<WebhookConfig>({
    name: 'Custom Webhook Integration',
    url: '',
    secret: '',
    custom_headers: '',
    trigger_events: [
      'device.created',
      'device.updated',
      'device.deleted',
      'device.status_changed',
    ],
  })

  const [generatedApiKey, setGeneratedApiKey] = useState<string>('')

  // Generate API key on mount for new integrations
  useEffect(() => {
    if (!integrationId && !generatedApiKey) {
      // Generate a secure random API key
      const key =
        'ntrl_' +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      setGeneratedApiKey(key)
    }
  }, [integrationId, generatedApiKey])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const ourWebhookEndpoint = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/integration-webhook`
    : 'https://your-project.supabase.co/functions/v1/integration-webhook'

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: 'NetNeural Webhook Receiver API',
      version: '1.0.0',
      description:
        'Webhook endpoint on NetNeural platform to receive events from external IoT platforms like Golioth, AWS IoT, Azure IoT Hub, and custom MQTT brokers.',
      contact: {
        name: 'NetNeural Support',
        url: 'https://netneural.io/support',
      },
    },
    servers: [
      {
        url: ourWebhookEndpoint,
        description: 'NetNeural webhook receiver endpoint',
      },
    ],
    paths: {
      '/': {
        post: {
          summary: 'Receive webhook from external platform',
          description: `This endpoint receives webhook events from external IoT platforms and automatically manages device lifecycle.
          
**Device Management:**
- **Auto-create**: If device ID hasn't been seen before, a new device will be created automatically
- **Auto-update**: If device ID exists, the device will be updated with new data
- **Upsert behavior**: All event types support create-if-not-exists functionality

**Supported Event Types:**
- \`device.created\`: Explicitly create a new device
- \`device.updated\`: Update existing device or create if not found
- \`device.deleted\`: Mark device as offline
- \`device.status_changed\`: Update device status (creates if not found)
- \`device.telemetry\`: Update device with telemetry data (creates if not found)
- \`device.online\`: Set device status to online
- \`device.offline\`: Set device status to offline

**Headers:**
- **X-Integration-ID** (required): Your integration ID to route webhook to correct integration
- **X-Webhook-Signature** (optional): HMAC SHA-256 signature for verification if secret is configured`,
          operationId: 'receiveWebhook',
          tags: ['Webhooks'],
          parameters: [
            {
              name: 'X-Integration-ID',
              in: 'header',
              required: true,
              schema: {
                type: 'string',
                format: 'uuid',
                example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              },
              description:
                'Your integration ID from NetNeural (required to route webhook to correct integration)',
            },
            {
              name: 'X-Webhook-Signature',
              in: 'header',
              required: false,
              schema: {
                type: 'string',
                example:
                  'a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5',
              },
              description:
                'HMAC SHA-256 signature of request body (required only if webhook secret is configured)',
            },
          ],
          requestBody: {
            required: true,
            description: 'Webhook payload containing event data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/WebhookEvent',
                },
                examples: {
                  deviceCreated: {
                    summary: 'Device Created Event',
                    description: 'Creates a new device in the system',
                    value: {
                      event: 'device.created',
                      timestamp: '2025-11-16T10:30:00Z',
                      device: {
                        id: 'dev_abc123',
                        name: 'Temperature Sensor 001',
                        status: 'online',
                        metadata: {
                          location: 'Building A - Floor 2',
                          type: 'temperature',
                          firmwareVersion: '1.2.3',
                        },
                      },
                    },
                  },
                  deviceUpdated: {
                    summary: 'Device Updated Event',
                    description:
                      'Updates existing device or creates if not found',
                    value: {
                      event: 'device.updated',
                      timestamp: '2025-11-16T10:35:00Z',
                      device: {
                        id: 'dev_abc123',
                        name: 'Temperature Sensor 001',
                        status: 'online',
                        metadata: {
                          temperature: 22.5,
                          humidity: 65,
                          lastMaintenance: '2025-11-15',
                        },
                      },
                    },
                  },
                  deviceTelemetry: {
                    summary: 'Telemetry Data Event',
                    description:
                      'Updates device with telemetry data (creates if not found)',
                    value: {
                      event: 'device.telemetry',
                      timestamp: '2025-11-16T10:40:00Z',
                      device: {
                        id: 'dev_abc123',
                        name: 'Temperature Sensor 001',
                        status: 'online',
                        metadata: {
                          temperature: 23.1,
                          humidity: 63,
                          battery: 87,
                          rssi: -65,
                        },
                      },
                    },
                  },
                  deviceStatusChanged: {
                    summary: 'Device Status Changed',
                    description: 'Updates device status (creates if not found)',
                    value: {
                      event: 'device.status_changed',
                      timestamp: '2025-11-16T10:45:00Z',
                      device: {
                        id: 'dev_abc123',
                        name: 'Temperature Sensor 001',
                        status: 'offline',
                        metadata: {
                          reason: 'connection_lost',
                        },
                      },
                    },
                  },
                  minimalPayload: {
                    summary: 'Minimal Required Fields',
                    description:
                      'Minimum required fields - device will be created with defaults',
                    value: {
                      event: 'device.updated',
                      timestamp: '2025-11-16T10:50:00Z',
                      device: {
                        id: 'dev_xyz789',
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Webhook received and processed successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: true,
                      },
                      message: {
                        type: 'string',
                        example: 'Webhook processed successfully',
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description:
                'Bad Request - Missing integration ID or malformed request',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                  example: {
                    error: 'Missing integration ID',
                    message: 'X-Integration-ID header is required',
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized - Invalid webhook signature',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                  example: {
                    error: 'Invalid signature',
                    message: 'HMAC SHA-256 signature verification failed',
                  },
                },
              },
            },
            '404': {
              description:
                'Not Found - Integration not found or webhook not enabled',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                  example: {
                    error: 'Webhook not configured',
                    message: 'No active integration found with the provided ID',
                  },
                },
              },
            },
            '500': {
              description: 'Internal Server Error',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error',
                  },
                  example: {
                    error: 'Internal server error',
                    message:
                      'An unexpected error occurred while processing the webhook',
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        WebhookEvent: {
          type: 'object',
          required: ['event', 'timestamp', 'device'],
          properties: {
            event: {
              type: 'string',
              enum: [
                'device.created',
                'device.updated',
                'device.deleted',
                'device.status_changed',
                'device.telemetry',
                'device.online',
                'device.offline',
              ],
              description:
                'Type of event being reported. All events support auto-create if device not found.',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'ISO 8601 timestamp when the event occurred',
              example: '2025-11-16T10:30:00Z',
            },
            device: {
              $ref: '#/components/schemas/Device',
            },
          },
          description:
            "Webhook event payload. The webhook will automatically create devices if they don't exist, or update them if they do.",
        },
        Device: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description:
                'Unique device identifier (required). This is used to match devices in the system.',
              example: 'dev_abc123',
            },
            name: {
              type: 'string',
              description:
                'Human-readable device name (optional). If not provided, device ID will be used as the name.',
              example: 'Temperature Sensor 001',
            },
            status: {
              type: 'string',
              enum: ['online', 'offline', 'unknown'],
              description:
                'Current device status (optional). Defaults to "unknown" if not provided.',
              example: 'online',
            },
            metadata: {
              type: 'object',
              additionalProperties: true,
              description:
                'Custom key-value pairs with device-specific data (optional). Can include telemetry, configuration, or any custom fields. All values are preserved.',
              example: {
                temperature: 22.5,
                humidity: 65,
                battery: 87,
                location: 'Building A - Floor 2',
                firmwareVersion: '1.2.3',
                model: 'TS-1000',
              },
            },
          },
          description:
            'Device information. Only "id" is required - all other fields are optional.',
        },
        Error: {
          type: 'object',
          required: ['error', 'message'],
          properties: {
            error: {
              type: 'string',
              description: 'Error type identifier',
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
            },
          },
        },
      },
    },
  }

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

      if (integration) {
        const settings = integration.settings || {}
        setConfig({
          id: integration.id,
          name: integration.name,
          url: '', // Not used for receiving webhooks
          secret: settings.secret || '',
          custom_headers: '',
          trigger_events: [],
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
        'webhook'
      )
      setTestResult({
        success: result.success,
        message: result.message || 'Test webhook sent successfully',
      })

      if (result.success) {
        toast.success('Test webhook sent successfully!')
      } else {
        toast.error(result.message || 'Failed to send test webhook')
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send test webhook'
      setTestResult({ success: false, message })
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!config.name) {
      toast.error('Please enter an integration name')
      return
    }

    setLoading(true)
    try {
      const webhookConfig = {
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
        let errorMsg =
          typeof response.error === 'string'
            ? response.error
            : 'Failed to save integration'

        if (
          errorMsg.includes('duplicate key') ||
          errorMsg.includes('unique constraint')
        ) {
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

  // Extract content into reusable component for both dialog and page modes
  const renderContent = () => (
    <>
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="openapi">OpenAPI Spec</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., External Platform Webhook"
            />
          </div>

          <div className="space-y-2">
            <Label>
              NetNeural Webhook URL (Use this in your external platform)
            </Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={ourWebhookEndpoint}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(ourWebhookEndpoint)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure this URL in your external IoT platform (Golioth, AWS
              IoT, etc.) to send webhooks to NetNeural
            </p>
          </div>

          <div className="space-y-2">
            <Label>Integration ID (Add as X-Integration-ID header)</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={integrationId || generatedApiKey}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  copyToClipboard(integrationId || generatedApiKey)
                }
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Add this as X-Integration-ID header in your webhook configuration
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="secret">Webhook Secret (Optional)</Label>
            <Input
              id="secret"
              type="password"
              value={config.secret}
              onChange={(e) => setConfig({ ...config, secret: e.target.value })}
              placeholder="Secret from your external platform"
            />
            <p className="text-sm text-muted-foreground">
              If your external platform signs webhooks, enter the secret key
              here for verification
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
            <h4 className="mb-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
              How to Configure
            </h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>Copy the NetNeural Webhook URL above</li>
              <li>Go to your external IoT platform&apos;s webhook settings</li>
              <li>Add our webhook URL as the destination</li>
              <li>Add X-Integration-ID header with the value shown above</li>
              <li>
                If your platform requires signature verification, enter the
                secret key
              </li>
            </ol>
          </div>
        </TabsContent>

        <TabsContent value="openapi" className="space-y-4 py-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                OpenAPI 3.0 Specification
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(JSON.stringify(openApiSpec, null, 2))
                    }
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Spec
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const blob = new Blob(
                        [JSON.stringify(openApiSpec, null, 2)],
                        { type: 'application/json' }
                      )
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'netneural-webhook-openapi.json'
                      a.click()
                    }}
                  >
                    <FileCode className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                Import this specification into tools like Postman, Insomnia, or
                API documentation generators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-96 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs">
                {JSON.stringify(openApiSpec, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-md p-3 ${
            testResult.success
              ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
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
              {integrationId ? 'Edit' : 'Add'} Custom Webhook Integration
            </h2>
            <p className="text-muted-foreground">
              Configure your custom webhook settings
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">{renderContent()}</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {integrationId ? 'Edit' : 'Add'} Custom Webhook Integration
          </DialogTitle>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
