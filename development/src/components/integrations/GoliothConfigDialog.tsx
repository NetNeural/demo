'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Switch } from '@/components/ui/switch'
import { Loader2, Check, X, AlertCircle } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { integrationSyncService } from '@/services/integration-sync.service'
import { toast } from 'sonner'
import { IntegrationActivityLog } from './IntegrationActivityLog'
import { IntegrationStatusToggle } from './IntegrationStatusToggle'
import { IntegrationSyncTab } from './IntegrationSyncTab'

interface GoliothConfig {
  id?: string
  name: string
  api_key: string
  project_id: string
  base_url: string
  status: 'active' | 'inactive' | 'not-configured'
  sync_enabled: boolean
  sync_interval_seconds: number
  sync_direction: 'import' | 'export' | 'bidirectional'
  conflict_resolution: 'manual' | 'local_wins' | 'remote_wins' | 'newest_wins'
  webhook_enabled: boolean
  webhook_secret: string
  webhook_url: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  integrationId?: string
  organizationId: string
  onSaved?: () => void
  mode?: 'dialog' | 'page' // 'dialog' for modal overlay, 'page' for inline rendering
}

export function GoliothConfigDialog({
  open,
  onOpenChange,
  integrationId,
  organizationId,
  onSaved,
  mode = 'dialog', // Default to dialog mode for backward compatibility
}: Props) {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [webhookTestResult, setWebhookTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const [config, setConfig] = useState<GoliothConfig>({
    name: 'Golioth Integration',
    api_key: '',
    project_id: '',
    base_url: 'https://api.golioth.io/v1',
    status: 'not-configured',
    sync_enabled: false,
    sync_interval_seconds: 300,
    sync_direction: 'bidirectional',
    conflict_resolution: 'manual',
    webhook_enabled: false,
    webhook_secret: '',
    webhook_url: '',
  })

  const loadConfig = useCallback(async () => {
    if (!integrationId) return

    setLoading(true)
    try {
      const response = await edgeFunctions.integrations.list(organizationId)

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load integration')
      }

      const responseData = response.data as any
      const data = responseData?.integrations?.find(
        (i: any) => i.id === integrationId
      )

      if (data) {
        setConfig({
          id: data.id,
          name: data.name,
          api_key: data.settings?.apiKey || '',
          project_id: data.settings?.projectId || data.projectId || '',
          base_url:
            data.settings?.baseUrl ||
            data.baseUrl ||
            'https://api.golioth.io/v1',
          status:
            (data.status as 'active' | 'inactive' | 'not-configured') ||
            'not-configured',
          sync_enabled: data.settings?.syncEnabled || false,
          sync_interval_seconds:
            data.settings?.syncIntervalSeconds ||
            data.sync_interval_seconds ||
            300,
          sync_direction:
            data.settings?.syncDirection ||
            (data.sync_direction as 'import' | 'export' | 'bidirectional') ||
            'bidirectional',
          conflict_resolution:
            data.settings?.conflictResolution ||
            (data.conflict_resolution as
              | 'manual'
              | 'local_wins'
              | 'remote_wins'
              | 'newest_wins') ||
            'manual',
          webhook_enabled:
            data.settings?.webhookEnabled || data.webhook_enabled || false,
          webhook_secret:
            data.settings?.webhookSecret || data.webhook_secret || '',
          webhook_url: data.webhook_url || data.settings?.webhookUrl || '', // Prioritize computed webhook_url over old settings value
        })
      }
    } catch (error) {
      toast.error('Failed to load configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [integrationId, organizationId])

  // Load existing config
  useEffect(() => {
    if (integrationId && open) {
      loadConfig()
    }
  }, [integrationId, open, loadConfig])

  const testConnection = async () => {
    // Validate required fields
    if (!config.api_key || !config.project_id) {
      toast.error('Please fill in API Key and Project ID before testing')
      return
    }

    // Must have saved integration first
    if (!integrationId) {
      toast.error(
        'Please save the configuration first before testing the connection'
      )
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const result = await integrationSyncService.testConnection(
        integrationId,
        organizationId
      )
      setTestResult(result)

      if (result) {
        toast.success('Connection test successful')
      } else {
        toast.error('Connection test failed')
      }
    } catch (error) {
      setTestResult(false)
      const errorMessage =
        error instanceof Error ? error.message : 'Connection test failed'
      toast.error(errorMessage)
    } finally {
      setTesting(false)
    }
  }

  const testWebhook = async () => {
    if (!integrationId) {
      toast.error('No integration ID - please save first')
      return
    }

    if (!config.webhook_url) {
      toast.error('No webhook URL found - try refreshing the page')
      return
    }

    setTestingWebhook(true)
    setWebhookTestResult(null)

    try {
      // Create a mock Golioth webhook payload (matches Golioth's actual format)
      const mockPayload = {
        event: 'device.updated',
        timestamp: new Date().toISOString(),
        device: {
          id: 'test-device-' + Date.now(),
          name: 'Test Device',
          status: 'online',
          metadata: {
            test: true,
            source: 'webhook_test_button',
          },
        },
      }

      // Generate HMAC signature
      const encoder = new TextEncoder()
      const payloadString = JSON.stringify(mockPayload)
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(config.webhook_secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )

      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(payloadString)
      )

      const signatureHex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      // Send test webhook
      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, // Required for Kong gateway
          'X-Integration-ID': integrationId,
          'X-Golioth-Signature': signatureHex,
        },
        body: payloadString,
      })

      if (response.ok) {
        const result = await response.json()
        setWebhookTestResult({
          success: true,
          message: 'Webhook test successful!',
        })
        toast.success('Webhook endpoint is working correctly')
      } else {
        const error = await response.text()
        setWebhookTestResult({
          success: false,
          message: `Failed: ${response.status} - ${error}`,
        })
        toast.error(`Webhook test failed: ${response.status}`)
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Webhook test failed'
      setWebhookTestResult({ success: false, message: errorMessage })
      toast.error(errorMessage)
    } finally {
      setTestingWebhook(false)
    }
  }

  const saveConfig = async () => {
    // Validate required fields
    if (!config.name.trim()) {
      toast.error('Please enter an integration name')
      return
    }

    if (!config.api_key.trim()) {
      toast.error('Please enter an API Key')
      return
    }

    if (!config.project_id.trim()) {
      toast.error('Please enter a Project ID')
      return
    }

    setLoading(true)

    try {
      if (integrationId) {
        // Update existing

        const response = await edgeFunctions.integrations.update(
          integrationId,
          {
            name: config.name,
            settings: {
              apiKey: config.api_key,
              projectId: config.project_id,
              baseUrl: config.base_url,
              syncEnabled: config.sync_enabled,
              syncIntervalSeconds: config.sync_interval_seconds,
              syncDirection: config.sync_direction,
              conflictResolution: config.conflict_resolution,
              webhookEnabled: config.webhook_enabled,
              webhookSecret: config.webhook_secret,
              webhookUrl: config.webhook_url,
            },
            status: config.status,
          }
        )

        if (!response.success) {
          throw new Error(
            response.error?.message || 'Failed to update integration'
          )
        }
      } else {
        // Create new
        const response = await edgeFunctions.integrations.create({
          organization_id: organizationId,
          integration_type: 'golioth',
          name: config.name,
          settings: {
            apiKey: config.api_key,
            projectId: config.project_id,
            baseUrl: config.base_url,
            syncEnabled: config.sync_enabled,
            syncIntervalSeconds: config.sync_interval_seconds,
            syncDirection: config.sync_direction,
            conflictResolution: config.conflict_resolution,
            webhookEnabled: config.webhook_enabled,
            webhookSecret: config.webhook_secret,
            webhookUrl: config.webhook_url,
          },
        } as any)

        if (!response.success) {
          // Provide user-friendly error messages for common issues
          let errorMsg =
            response.error?.message || 'Failed to create integration'

          if (
            errorMsg.includes('duplicate key') ||
            errorMsg.includes('unique constraint')
          ) {
            errorMsg = `An integration with the name "${config.name}" already exists. Please choose a different name.`
          }

          throw new Error(errorMsg)
        }

        // Update local state with the newly created integration data
        const newIntegration = response.data as any
        if (newIntegration) {
          setConfig({
            ...config,
            id: newIntegration.id,
            webhook_url: newIntegration.webhook_url || '',
            webhook_secret: newIntegration.webhook_secret || '',
          })

          // Update the URL to reflect the new integration ID
          const url = new URL(window.location.href)
          url.searchParams.set('id', newIntegration.id)
          window.history.replaceState({}, '', url.toString())
        }
      }

      toast.success('Configuration saved successfully')
      onSaved?.()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save configuration'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Extract content into reusable component for both dialog and page modes
  const renderContent = () => (
    <>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="sync-settings">Sync Settings</TabsTrigger>
          <TabsTrigger value="sync">Run Sync</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="integration-name">Integration Name *</Label>
            <Input
              id="integration-name"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="e.g., Golioth Production"
              className={!config.name.trim() ? 'border-red-300' : ''}
            />
            <p className="text-sm text-muted-foreground">
              A friendly name to identify this integration
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key *</Label>
            <Input
              id="api-key"
              type="password"
              value={config.api_key}
              onChange={(e) =>
                setConfig({ ...config, api_key: e.target.value })
              }
              placeholder="Enter your Golioth API key"
              className={!config.api_key.trim() ? 'border-red-300' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-id">Project ID *</Label>
            <Input
              id="project-id"
              value={config.project_id}
              onChange={(e) =>
                setConfig({ ...config, project_id: e.target.value })
              }
              placeholder="your-project-id"
              className={!config.project_id.trim() ? 'border-red-300' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base-url">Base URL</Label>
            <Input
              id="base-url"
              value={config.base_url}
              onChange={(e) =>
                setConfig({ ...config, base_url: e.target.value })
              }
              placeholder="https://api.golioth.io/v1"
            />
          </div>

          <IntegrationStatusToggle
            status={config.status}
            onStatusChange={(status) => setConfig({ ...config, status })}
            disabled={
              !config.name.trim() ||
              !config.api_key.trim() ||
              !config.project_id.trim()
            }
            disabledMessage="Fill in required fields (Name, API Key, Project ID) to enable"
          />

          <div className="flex items-center justify-between pt-4">
            <div className="flex flex-col gap-1">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={
                  testing ||
                  !integrationId ||
                  !config.api_key ||
                  !config.project_id
                }
              >
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test Connection
              </Button>
              {!integrationId && (
                <p className="text-xs text-muted-foreground">
                  Save configuration first to enable testing
                </p>
              )}
            </div>

            {testResult !== null && (
              <div className="flex items-center gap-2">
                {testResult ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">Connected</span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">Failed</span>
                  </>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Sync Settings Tab - Configuration Only */}
        <TabsContent value="sync-settings" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Automatic Sync</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sync devices at regular intervals
              </p>
            </div>
            <Switch
              checked={config.sync_enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, sync_enabled: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sync-interval">Sync Interval (seconds)</Label>
            <Input
              id="sync-interval"
              type="number"
              min={60}
              value={config.sync_interval_seconds}
              onChange={(e) =>
                setConfig({
                  ...config,
                  sync_interval_seconds: parseInt(e.target.value),
                })
              }
              disabled={!config.sync_enabled}
            />
            <p className="text-sm text-muted-foreground">Minimum: 60 seconds</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sync-direction">Sync Direction</Label>
            <Select
              value={config.sync_direction}
              onValueChange={(value: any) =>
                setConfig({ ...config, sync_direction: value })
              }
            >
              <SelectTrigger id="sync-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="import">
                  Import (Golioth → NetNeural)
                </SelectItem>
                <SelectItem value="export">
                  Export (NetNeural → Golioth)
                </SelectItem>
                <SelectItem value="bidirectional">
                  Bidirectional (Both ways)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Choose how devices should be synchronized
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conflict-resolution">Conflict Resolution</Label>
            <Select
              value={config.conflict_resolution}
              onValueChange={(value: any) =>
                setConfig({ ...config, conflict_resolution: value })
              }
            >
              <SelectTrigger id="conflict-resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  Manual (Require user resolution)
                </SelectItem>
                <SelectItem value="local_wins">
                  Local Wins (NetNeural takes priority)
                </SelectItem>
                <SelectItem value="remote_wins">
                  Remote Wins (Golioth takes priority)
                </SelectItem>
                <SelectItem value="newest_wins">
                  Newest Wins (Latest update wins)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              How to handle conflicts when a device is modified in both systems
            </p>
          </div>
        </TabsContent>

        {/* Conflicts Tab */}
        <TabsContent value="conflicts" className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Conflicts occur when a device is modified in both systems
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conflict-resolution">Automatic Resolution</Label>
            <Select
              value={config.conflict_resolution}
              onValueChange={(value: any) =>
                setConfig({ ...config, conflict_resolution: value })
              }
            >
              <SelectTrigger id="conflict-resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">
                  Manual (Require user resolution)
                </SelectItem>
                <SelectItem value="local_wins">
                  Local Wins (NetNeural takes priority)
                </SelectItem>
                <SelectItem value="remote_wins">
                  Remote Wins (Golioth takes priority)
                </SelectItem>
                <SelectItem value="newest_wins">
                  Newest Wins (Latest update wins)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-lg bg-muted p-4">
            <h4 className="text-sm font-medium">Resolution Strategies</h4>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                <strong>Manual:</strong> You review and resolve each conflict
              </li>
              <li>
                <strong>Local Wins:</strong> NetNeural version always takes
                priority
              </li>
              <li>
                <strong>Remote Wins:</strong> Golioth version always takes
                priority
              </li>
              <li>
                <strong>Newest Wins:</strong> Most recently updated version wins
              </li>
            </ul>
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          {/* Enable Webhooks Toggle */}
          <div className="flex items-center justify-between rounded-lg border-2 border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
            <div>
              <Label
                htmlFor="webhook-enabled"
                className="text-base font-semibold text-blue-900 dark:text-blue-100"
              >
                Enable Webhooks
              </Label>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Receive real-time events from Golioth when devices update
              </p>
            </div>
            <Switch
              id="webhook-enabled"
              checked={config.webhook_enabled}
              onCheckedChange={(checked) =>
                setConfig({ ...config, webhook_enabled: checked })
              }
            />
          </div>

          {/* Test Webhook Button */}
          {(integrationId || config.id) &&
            config.webhook_url &&
            config.webhook_secret && (
              <div className="flex items-center justify-between rounded-lg border-2 border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="text-sm font-medium">
                    Test Your Webhook Endpoint
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Send a mock Golioth event to verify your webhook is
                    configured correctly
                  </p>
                </div>
                <Button
                  onClick={testWebhook}
                  disabled={testingWebhook}
                  variant="outline"
                >
                  {testingWebhook && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  🧪 Test Webhook
                </Button>
              </div>
            )}

          {/* Webhook Test Result */}
          {webhookTestResult && (
            <div
              className={`rounded-lg border-2 p-4 ${
                webhookTestResult.success
                  ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                  : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950'
              }`}
            >
              <div className="flex items-start gap-2">
                {webhookTestResult.success ? (
                  <Check className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <X className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <div>
                  <p
                    className={`text-sm font-medium ${
                      webhookTestResult.success
                        ? 'text-green-900 dark:text-green-100'
                        : 'text-red-900 dark:text-red-100'
                    }`}
                  >
                    {webhookTestResult.success
                      ? 'Webhook Test Passed!'
                      : 'Webhook Test Failed'}
                  </p>
                  <p
                    className={`mt-1 text-xs ${
                      webhookTestResult.success
                        ? 'text-green-700 dark:text-green-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    {webhookTestResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Copy Values - Show actual URLs first */}
          {(integrationId || config.id) &&
            config.webhook_url &&
            config.webhook_secret && (
              <div className="space-y-3 rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                <Label className="text-base font-semibold text-green-900 dark:text-green-100">
                  ✅ Your Webhook Configuration Values
                </Label>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Copy these exact values to your Golioth Pipeline configuration
                </p>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-green-900 dark:text-green-100">
                        Webhook URL:
                      </Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(config.webhook_url)
                          toast.success('Webhook URL copied!')
                        }}
                        className="h-6 text-xs"
                      >
                        📋 Copy
                      </Button>
                    </div>
                    <div className="break-all rounded border border-green-300 bg-white p-2 font-mono text-xs dark:border-green-800 dark:bg-slate-900">
                      {config.webhook_url}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-green-900 dark:text-green-100">
                        Integration ID:
                      </Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(
                            integrationId || config.id || ''
                          )
                          toast.success('Integration ID copied!')
                        }}
                        className="h-6 text-xs"
                      >
                        📋 Copy
                      </Button>
                    </div>
                    <div className="break-all rounded border border-green-300 bg-white p-2 font-mono text-xs dark:border-green-800 dark:bg-slate-900">
                      {integrationId || config.id}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-green-900 dark:text-green-100">
                        Signing Secret:
                      </Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          navigator.clipboard.writeText(config.webhook_secret)
                          toast.success('Signing secret copied!')
                        }}
                        className="h-6 text-xs"
                      >
                        📋 Copy
                      </Button>
                    </div>
                    <div className="break-all rounded border border-green-300 bg-white p-2 font-mono text-xs dark:border-green-800 dark:bg-slate-900">
                      {config.webhook_secret}
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* What's Used vs Not Used */}
          <div className="space-y-3 rounded-lg border-2 border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
            <Label className="text-base font-semibold text-blue-900 dark:text-blue-100">
              📖 How Golioth Webhooks Work with NetNeural
            </Label>

            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm font-medium text-blue-900 dark:text-blue-100">
                  ✅ What You Configure in Golioth:
                </p>
                <ul className="ml-2 list-inside list-disc space-y-1 text-xs text-blue-700 dark:text-blue-300">
                  <li>
                    <strong>URL:</strong> The webhook endpoint URL (shown above)
                  </li>
                  <li>
                    <strong>Headers:</strong> Content-Type, X-Integration-ID,
                    X-Golioth-Signature
                  </li>
                  <li>
                    <strong>Signing Secret:</strong> Used to generate
                    HMAC-SHA256 signature
                  </li>
                  <li>
                    <strong>Events:</strong> device.created, device.updated,
                    device.deleted, device.status_changed, device.telemetry
                  </li>
                </ul>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-blue-900 dark:text-blue-100">
                  🔄 What NetNeural Does Automatically:
                </p>
                <ul className="ml-2 list-inside list-disc space-y-1 text-xs text-blue-700 dark:text-blue-300">
                  <li>
                    <strong>Verifies signature:</strong> Ensures webhook came
                    from Golioth
                  </li>
                  <li>
                    <strong>Logs activity:</strong> Records all webhook events
                    in activity log
                  </li>
                  <li>
                    <strong>Updates devices:</strong> Syncs device status,
                    metadata, and telemetry
                  </li>
                  <li>
                    <strong>Creates devices:</strong> Automatically adds new
                    devices when Golioth sends device.created
                  </li>
                </ul>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-blue-900 dark:text-blue-100">
                  ❌ What You Don&apos;t Need (Handled Automatically):
                </p>
                <ul className="ml-2 list-inside list-disc space-y-1 text-xs text-blue-700 dark:text-blue-300">
                  <li>
                    <strong>No API keys in webhook:</strong> Authentication uses
                    HMAC signature only
                  </li>
                  <li>
                    <strong>No custom payload transformation:</strong> NetNeural
                    normalizes different formats
                  </li>
                  <li>
                    <strong>No manual device sync:</strong> Webhooks keep
                    devices in sync automatically
                  </li>
                  <li>
                    <strong>No retry logic:</strong> Golioth handles webhook
                    delivery retries
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Example Payloads */}
          <div className="space-y-3 rounded-lg border-2 border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950">
            <Label className="text-base font-semibold text-purple-900 dark:text-purple-100">
              📝 Example Golioth Webhook Payloads
            </Label>

            <div className="space-y-2">
              <div>
                <p className="mb-1 text-xs font-medium text-purple-900 dark:text-purple-100">
                  Device Updated Event:
                </p>
                <pre className="overflow-x-auto rounded border border-purple-300 bg-purple-100 p-2 text-xs dark:border-purple-800 dark:bg-purple-900">
                  {`{
  "event": "device.updated",
  "device_id": "your-device-id",
  "device_name": "Sensor-01",
  "timestamp": "2025-11-24T12:00:00Z",
  "status": "online",
  "metadata": {
    "temperature": 25.5,
    "battery": 85
  }
}`}
                </pre>
              </div>

              <div>
                <p className="mb-1 text-xs font-medium text-purple-900 dark:text-purple-100">
                  Device Status Changed Event:
                </p>
                <pre className="overflow-x-auto rounded border border-purple-300 bg-purple-100 p-2 text-xs dark:border-purple-800 dark:bg-purple-900">
                  {`{
  "event": "device.status_changed",
  "device_id": "your-device-id",
  "device_name": "Sensor-01",
  "timestamp": "2025-11-24T12:05:00Z",
  "status": "offline",
  "previous_status": "online"
}`}
                </pre>
              </div>
            </div>
          </div>

          {/* Golioth Pipeline Configuration Template */}
          <div className="space-y-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-primary/10 p-1.5">
                  <AlertCircle className="h-4 w-4 text-primary" />
                </div>
                <Label className="text-base font-semibold">
                  📋 Complete Golioth Pipeline Template
                </Label>
              </div>
              {(integrationId || config.id) &&
                config.webhook_url &&
                config.webhook_secret && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const pipelineConfig = `# Golioth Pipeline Configuration for ${config.name}
# Copy the values from above into this template

name: netneural-integration
description: Send device events to NetNeural IoT Platform

# Webhook Configuration
webhook:
  url: ${config.webhook_url}
  method: POST
  headers:
    Content-Type: application/json
    X-Integration-ID: ${integrationId || config.id}
    X-Golioth-Signature: "{{hmac_sha256}}"
  
# Event Triggers (customize as needed)
triggers:
  - device.created
  - device.updated
  - device.deleted
  - device.status_changed
  - device.online
  - device.offline
  - device.telemetry

# Security - HMAC SHA-256 signature
signing_secret: ${config.webhook_secret}
signature_algorithm: HMAC-SHA256
signature_header: X-Golioth-Signature`

                      navigator.clipboard.writeText(pipelineConfig)
                      toast.success('Complete pipeline template copied!')
                    }}
                  >
                    📋 Copy Complete Template
                  </Button>
                )}
            </div>
            <p className="text-sm text-muted-foreground">
              {(integrationId || config.id) &&
              config.webhook_url &&
              config.webhook_secret
                ? 'This template includes all required headers and authentication. Copy this complete configuration into your Golioth Pipeline.'
                : 'Save this integration first to generate your webhook URL and secret.'}
            </p>

            {(integrationId || config.id) &&
            config.webhook_url &&
            config.webhook_secret ? (
              <div className="space-y-2">
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
                  <p className="mb-1 text-sm font-medium text-blue-900 dark:text-blue-100">
                    ✅ Required Headers (Already Configured)
                  </p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                    <li>
                      <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">
                        Content-Type: application/json
                      </code>{' '}
                      - Tells server to expect JSON
                    </li>
                    <li>
                      <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">
                        X-Integration-ID: {integrationId || config.id}
                      </code>{' '}
                      - Identifies your integration
                    </li>
                    <li>
                      <code className="rounded bg-blue-100 px-1 dark:bg-blue-900">
                        X-Golioth-Signature: &#123;&#123;hmac_sha256&#125;&#125;
                      </code>{' '}
                      - Verifies request authenticity
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="mb-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                    🔐 Security Details
                  </p>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                    <li>
                      Signature Algorithm:{' '}
                      <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">
                        HMAC-SHA256
                      </code>
                    </li>
                    <li>
                      Signature Header:{' '}
                      <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">
                        X-Golioth-Signature
                      </code>
                    </li>
                    <li>
                      Secret:{' '}
                      <code className="break-all rounded bg-slate-200 px-1 text-xs dark:bg-slate-800">
                        {config.webhook_secret}
                      </code>
                    </li>
                    <li className="mt-1 text-amber-700 dark:text-amber-400">
                      ⚠️ Keep your signing secret private - never share it
                      publicly
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  ⚠️ Save Configuration First
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Click &quot;Save Configuration&quot; at the bottom to generate
                  your webhook URL and secret. They will appear here
                  automatically for easy copying.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Run Sync Tab - Execute sync operations */}
        {integrationId && (
          <TabsContent value="sync" className="space-y-4">
            <IntegrationSyncTab
              integrationId={integrationId}
              organizationId={organizationId}
              integrationType="golioth"
              integrationName={config.name}
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

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          onClick={saveConfig}
          disabled={
            loading ||
            !config.name.trim() ||
            !config.api_key.trim() ||
            !config.project_id.trim()
          }
        >
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
              {integrationId ? 'Edit' : 'Add'} Golioth Integration
            </h2>
            <p className="text-muted-foreground">
              Configure your Golioth integration settings
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
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto bg-white dark:bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            {integrationId ? 'Edit' : 'Add'} Golioth Integration
          </DialogTitle>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
