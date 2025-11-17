'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { edgeFunctions } from '@/lib/edge-functions'
import { integrationSyncService } from '@/services/integration-sync.service'
import { toast } from 'sonner'
import { IntegrationActivityLog } from '@/components/integrations/IntegrationActivityLog'
import { IntegrationStatusToggle } from '@/components/integrations/IntegrationStatusToggle'
import { IntegrationSyncTab } from '@/components/integrations/IntegrationSyncTab'
import { ConflictsTab } from '@/components/integrations/ConflictsTab'

interface GoliothConfig {
  id?: string
  name: string
  api_key: string
  project_id: string
  base_url: string
  status: 'active' | 'inactive' | 'not-configured'
  sync_enabled: boolean
  sync_interval_minutes: number
  sync_direction: 'import' | 'export' | 'bidirectional'
  conflict_resolution: 'manual' | 'local_wins' | 'remote_wins' | 'newest_wins'
  webhook_enabled: boolean
  webhook_secret: string
  webhook_url: string
}

export default function IntegrationViewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const integrationId = searchParams.get('id')
  const organizationId = searchParams.get('organizationId')
  const integrationType = searchParams.get('type')

  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  
  const [config, setConfig] = useState<GoliothConfig>({
    name: 'Golioth Integration',
    api_key: '',
    project_id: '',
    base_url: 'https://api.golioth.io/v1',
    status: 'not-configured',
    sync_enabled: false,
    sync_interval_minutes: 5,
    sync_direction: 'bidirectional',
    conflict_resolution: 'manual',
    webhook_enabled: true, // Always enabled
    webhook_secret: '',
    webhook_url: '',
  })

  const loadConfig = useCallback(async () => {
    if (!integrationId || !organizationId) return

    setLoading(true)
    try {
      const response = await edgeFunctions.integrations.list(organizationId)

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load integration')
      }

      const responseData = response.data as { integrations?: Array<{
        id: string
        name: string
        status: string
        settings?: {
          apiKey?: string
          syncEnabled?: boolean
          syncIntervalSeconds?: number
          syncDirection?: string
          conflictResolution?: string
          webhookEnabled?: boolean
          webhookSecret?: string
          webhookUrl?: string
        }
        projectId?: string
        baseUrl?: string
        webhook_enabled?: boolean
        webhook_secret?: string
        webhook_url?: string
      }> }
      const data = responseData?.integrations?.find((i) => i.id === integrationId)

      if (data) {
        // Auto-generate webhook URL if not present
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
        const webhookUrl = data.webhook_url || `${supabaseUrl}/functions/v1/integration-webhook`
        
        // Auto-generate webhook secret if not present (32 random hex chars)
        const webhookSecret = data.webhook_secret || 
          Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        
        setConfig({
          id: data.id,
          name: data.name,
          api_key: data.settings?.apiKey || '',
          project_id: data.projectId || '',
          base_url: data.baseUrl || 'https://api.golioth.io/v1',
          status: (data.status as 'active' | 'inactive' | 'not-configured') || 'not-configured',
          sync_enabled: data.settings?.syncEnabled || false,
          sync_interval_minutes: data.settings?.syncIntervalSeconds ? Math.floor(data.settings.syncIntervalSeconds / 60) : 5,
          sync_direction: (data.settings?.syncDirection as 'import' | 'export' | 'bidirectional') || 'bidirectional',
          conflict_resolution: (data.settings?.conflictResolution as 'manual' | 'local_wins' | 'remote_wins' | 'newest_wins') || 'manual',
          webhook_enabled: true, // Always enabled
          webhook_secret: webhookSecret,
          webhook_url: webhookUrl,
        })
      }
    } catch (error) {
      toast.error('Failed to load configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [integrationId, organizationId])

  useEffect(() => {
    if (integrationId && organizationId) {
      loadConfig()
    }
  }, [integrationId, organizationId, loadConfig])

  const testConnection = async () => {
    if (!config.api_key || !config.project_id) {
      toast.error('Please fill in API Key and Project ID before testing')
      return
    }

    if (!integrationId) {
      toast.error('Please save the configuration first before testing the connection')
      return
    }

    setTesting(true)
    setTestResult(null)
    
    try {
      const result = await integrationSyncService.testConnection(integrationId, organizationId!)
      setTestResult(result)
      
      if (result) {
        toast.success('Connection test successful')
      } else {
        toast.error('Connection test failed')
      }
    } catch (error) {
      setTestResult(false)
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed'
      toast.error(errorMessage)
      console.error('Test connection error:', error)
    } finally {
      setTesting(false)
    }
  }

  const saveConfig = async () => {
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

    if (!organizationId) return

    setLoading(true)
    
    try {
      console.log('💾 Saving integration config...', {
        integrationId,
        organizationId,
        sync_enabled: config.sync_enabled,
        sync_interval_minutes: config.sync_interval_minutes
      })

      if (integrationId) {
        const updatePayload = {
          name: config.name,
          settings: {
            apiKey: config.api_key,
            projectId: config.project_id,
            baseUrl: config.base_url,
            syncEnabled: config.sync_enabled,
            syncIntervalSeconds: config.sync_interval_minutes * 60, // Convert to seconds for storage
            syncDirection: config.sync_direction,
            conflictResolution: config.conflict_resolution,
            webhookEnabled: config.webhook_enabled,
            webhookSecret: config.webhook_secret,
            webhookUrl: config.webhook_url,
          },
          status: config.status,
        }

        console.log('📤 Updating integration with payload:', updatePayload)

        const response = await edgeFunctions.integrations.update(integrationId, updatePayload)

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to update integration')
        }

        console.log('✅ Integration updated successfully')

        // Automatically create/update auto_sync_schedules record
        const syncConfigBody = {
          config: {
            enabled: config.sync_enabled,
            frequencyMinutes: config.sync_interval_minutes,
            direction: config.sync_direction,
            conflictResolution: config.conflict_resolution,
            onlyOnline: true,
            timeWindowEnabled: false,
            deviceFilter: 'all',
          }
        }

        console.log('📅 Updating sync schedule...', syncConfigBody)

        try {
          const syncConfigResponse = await edgeFunctions.call('auto-sync-config', {
            method: 'POST',
            params: {
              integration_id: integrationId,
              organization_id: organizationId,
            },
            body: syncConfigBody
          })
          
          if (!syncConfigResponse.success) {
            console.error('❌ Sync schedule update failed:', syncConfigResponse.error)
            throw new Error(syncConfigResponse.error?.message || 'Failed to update sync schedule')
          }

          console.log('✅ Sync schedule updated successfully:', syncConfigResponse.data)
        } catch (scheduleError) {
          console.error('❌ Failed to update sync schedule:', scheduleError)
          // Don't fail the whole save if schedule update fails
          toast.warning('Integration saved but sync schedule update failed. Check console for details.')
          throw scheduleError // Re-throw to see the actual error
        }
      }

      toast.success('Configuration saved successfully')
      
      // Reload the config to reflect any server-side changes
      await loadConfig()
      
      // Small delay to ensure UI updates before redirect
      setTimeout(() => {
        router.push('/dashboard/organizations?tab=integrations')
      }, 500)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save configuration'
      console.error('💥 Save error:', error)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!integrationId || !organizationId || !integrationType) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Missing required parameters</p>
        <Button onClick={() => router.push('/dashboard/organizations?tab=integrations')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Integrations
        </Button>
      </div>
    )
  }

  if (integrationType !== 'golioth') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">This integration type is not yet supported in page view</p>
        <Button onClick={() => router.push('/dashboard/organizations?tab=integrations')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Integrations
        </Button>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Configure Integration</h2>
          <p className="text-muted-foreground">Edit {integrationType} integration settings</p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/organizations?tab=integrations')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Integrations
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{integrationId ? 'Edit' : 'Add'} Golioth Integration</CardTitle>
          <CardDescription>Configure your Golioth integration settings and sync options</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="sync-settings">Sync Settings</TabsTrigger>
              <TabsTrigger value="run-sync" disabled={!integrationId}>Run Sync</TabsTrigger>
              <TabsTrigger value="conflicts" disabled={!integrationId}>Conflicts</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="activity" disabled={!integrationId}>Activity Log</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
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
                  onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                  placeholder="Enter your Golioth API key"
                  className={!config.api_key.trim() ? 'border-red-300' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-id">Project ID *</Label>
                <Input
                  id="project-id"
                  value={config.project_id}
                  onChange={(e) => setConfig({ ...config, project_id: e.target.value })}
                  placeholder="your-project-id"
                  className={!config.project_id.trim() ? 'border-red-300' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="base-url">Base URL</Label>
                <Input
                  id="base-url"
                  value={config.base_url}
                  onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
                  placeholder="https://api.golioth.io/v1"
                />
              </div>

              <IntegrationStatusToggle
                status={config.status}
                onStatusChange={(status) => setConfig({ ...config, status })}
                disabled={!config.name.trim() || !config.api_key.trim() || !config.project_id.trim()}
                disabledMessage="Fill in required fields (Name, API Key, Project ID) to enable"
              />

              <div className="flex items-center justify-between pt-4">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    onClick={testConnection}
                    disabled={testing || !integrationId || !config.api_key || !config.project_id}
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

            {/* Sync Settings Tab - Unified sync configuration */}
            <TabsContent value="sync-settings" className="space-y-6 mt-4">
              {/* Automatic Sync Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Automatic Sync</CardTitle>
                  <CardDescription>
                    Configure automated device synchronization between Golioth and NetNeural
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <Label htmlFor="sync-interval">Sync Interval (minutes)</Label>
                    <Input
                      id="sync-interval"
                      type="number"
                      min={1}
                      max={1440}
                      value={config.sync_interval_minutes}
                      onChange={(e) => {
                        const value = parseInt(e.target.value) || 1
                        setConfig({ ...config, sync_interval_minutes: Math.max(1, Math.min(1440, value)) })
                      }}
                      disabled={!config.sync_enabled}
                    />
                    <p className="text-sm text-muted-foreground">
                      Range: 1-1440 minutes (1 minute to 24 hours). Recommended: 5-15 minutes
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sync-direction">Sync Direction</Label>
                    <Select
                      value={config.sync_direction}
                      onValueChange={(value: 'import' | 'export' | 'bidirectional') => 
                        setConfig({ ...config, sync_direction: value })
                      }
                      disabled={!config.sync_enabled}
                    >
                      <SelectTrigger id="sync-direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="import">Import (Golioth → NetNeural)</SelectItem>
                        <SelectItem value="export">Export (NetNeural → Golioth)</SelectItem>
                        <SelectItem value="bidirectional">Bidirectional (Both ways)</SelectItem>
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
                      onValueChange={(value: 'manual' | 'local_wins' | 'remote_wins' | 'newest_wins') => 
                        setConfig({ ...config, conflict_resolution: value })
                      }
                      disabled={!config.sync_enabled}
                    >
                      <SelectTrigger id="conflict-resolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">Manual - Review conflicts manually</SelectItem>
                        <SelectItem value="local_wins">Local Wins - NetNeural data takes priority</SelectItem>
                        <SelectItem value="remote_wins">Remote Wins - Golioth data takes priority</SelectItem>
                        <SelectItem value="newest_wins">Newest Wins - Most recent update wins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium text-sm">Resolution Strategies</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li><strong>Manual:</strong> You review and resolve each conflict</li>
                      <li><strong>Local Wins:</strong> NetNeural version always takes priority</li>
                      <li><strong>Remote Wins:</strong> Golioth version always takes priority</li>
                      <li><strong>Newest Wins:</strong> Most recently updated version wins</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Info Notice */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">ℹ️ How Auto-Sync Works</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                  When you enable automatic sync and save, the system automatically:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <li>Creates a sync schedule in the database with your settings</li>
                  <li>Calculates the next run time based on your interval</li>
                  <li>A background cron job (configured separately) checks for due syncs</li>
                  <li>Executes syncs automatically according to your configuration</li>
                </ol>
                <div className="mt-3 p-2 bg-blue-100 dark:bg-blue-900 rounded">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    <strong>Note:</strong> Auto-sync requires a Supabase Edge Cron configured to call 
                    <code className="mx-1 px-1 bg-blue-200 dark:bg-blue-800 rounded">/functions/v1/auto-sync-cron</code> 
                    every minute. Contact your administrator to set this up.
                  </p>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  💡 You can also use the &ldquo;Run Sync&rdquo; tab to trigger syncs manually at any time.
                </p>
              </div>
            </TabsContent>

            {/* Webhooks Tab */}
            <TabsContent value="webhooks" className="space-y-4 mt-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">📋 Golioth Webhook Setup</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                  Webhooks are automatically enabled for real-time device event processing.
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <li>Copy the generated Webhook URL and Secret below</li>
                  <li>Go to <a href="https://console.golioth.io" target="_blank" rel="noopener noreferrer" className="underline">Golioth Console</a> → Project Settings → Webhooks</li>
                  <li>Create a new webhook with the URL and add custom header: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">X-Integration-ID: {integrationId}</code></li>
                  <li>Configure webhook to send: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">X-Golioth-Signature</code> header with HMAC-SHA256 signature</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook-url"
                    value={config.webhook_url}
                    readOnly
                    className="bg-muted cursor-default font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(config.webhook_url)
                      toast.success('Webhook URL copied to clipboard')
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ✨ Use this URL in your Golioth project webhook configuration
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Webhook Signing Secret (HMAC-SHA256)</Label>
                <div className="flex gap-2">
                  <Input
                    id="webhook-secret"
                    type="text"
                    value={config.webhook_secret}
                    readOnly
                    className="bg-muted cursor-default font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(config.webhook_secret)
                      toast.success('Webhook secret copied to clipboard')
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  🔒 Golioth will use this secret to sign webhook requests with HMAC-SHA256
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="integration-header">Required Custom Header</Label>
                <div className="flex gap-2">
                  <Input
                    id="integration-header"
                    value={`X-Integration-ID: ${integrationId || 'save-to-generate'}`}
                    readOnly
                    className="bg-muted cursor-default font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`X-Integration-ID: ${integrationId}`)
                      toast.success('Header copied to clipboard')
                    }}
                    disabled={!integrationId}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  📌 Add this custom header to your Golioth webhook configuration
                </p>
              </div>
            </TabsContent>

            {/* Run Sync Tab */}
            {integrationId && (
              <TabsContent value="run-sync" className="space-y-4 mt-4">
                <IntegrationSyncTab
                  integrationId={integrationId}
                  organizationId={organizationId}
                  integrationType="golioth"
                  integrationName={config.name}
                />
              </TabsContent>
            )}

            {/* Conflicts Tab */}
            {integrationId && (
              <TabsContent value="conflicts" className="space-y-4 mt-4">
                <ConflictsTab organizationId={organizationId} />
              </TabsContent>
            )}

            {/* Activity Log Tab */}
            {integrationId && (
              <TabsContent value="activity" className="space-y-4 mt-4">
                <IntegrationActivityLog
                  integrationId={integrationId}
                  organizationId={organizationId}
                  limit={50}
                  autoRefresh={true}
                />
              </TabsContent>
            )}
          </Tabs>

          <div className="flex justify-end gap-2 pt-6 mt-6 border-t">
            <Button variant="outline" onClick={() => router.push('/dashboard/organizations?tab=integrations')}>
              Cancel
            </Button>
            <Button 
              onClick={saveConfig} 
              disabled={loading || !config.name.trim() || !config.api_key.trim() || !config.project_id.trim()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Configuration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
