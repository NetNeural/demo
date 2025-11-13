'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, Check, X, AlertCircle } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'
import { IntegrationActivityLog } from './IntegrationActivityLog'
import { IntegrationStatusToggle } from './IntegrationStatusToggle'
import { IntegrationSyncTab } from './IntegrationSyncTab'
import { integrationService } from '@/services/integration.service'

interface AwsIotConfig {
  id?: string
  name: string
  region: string
  access_key_id: string
  secret_access_key: string
  endpoint?: string
  certificate?: string
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
}

const AWS_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'eu-west-1', label: 'EU (Ireland)' },
  { value: 'eu-central-1', label: 'EU (Frankfurt)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
]

export function AwsIotConfigDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  organizationId,
  onSaved 
}: Props) {
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  
  const [config, setConfig] = useState<AwsIotConfig>({
    name: 'AWS IoT Integration',
    region: 'us-east-1',
    access_key_id: '',
    secret_access_key: '',
    endpoint: '',
    certificate: '',
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
        throw new Error(typeof response.error === 'string' ? response.error : 'Failed to load integrations')
      }

      const integrations = (response.data as any)?.integrations || []
      const integration = integrations.find((i: any) => i.id === integrationId)
      
      if (integration) {
        const cfg = integration.config as any
        setConfig({
          id: integration.id,
          name: integration.name,
          region: cfg?.region || 'us-east-1',
          access_key_id: cfg?.accessKeyId || '',
          secret_access_key: cfg?.secretAccessKey || '',
          endpoint: cfg?.endpoint || '',
          certificate: cfg?.certificate || '',
          status: integration.status || 'not-configured',
          sync_enabled: integration.syncEnabled || false,
          sync_interval_seconds: integration.syncIntervalSeconds || 300,
          sync_direction: integration.syncDirection || 'bidirectional',
          conflict_resolution: integration.conflictResolution || 'manual',
          webhook_enabled: integration.webhookEnabled || false,
          webhook_secret: integration.webhookSecret || '',
          webhook_url: integration.webhookUrl || '',
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
    if (open) {
      loadConfig()
      setTestResult(null)
    }
  }, [open, loadConfig])

  const testConnection = async () => {
    if (!integrationId) {
      toast.error('Save configuration first to enable testing')
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      await integrationService.testIntegration(integrationId, 'aws_iot')
      setTestResult(true)
      toast.success('Connection successful!')
    } catch (error) {
      setTestResult(false)
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      toast.error(errorMessage)
      console.error('[AwsIotConfigDialog] Test connection error:', error)
    } finally {
      setTesting(false)
    }
  }

  const saveConfig = async () => {
    if (!config.name.trim() || !config.access_key_id.trim() || !config.secret_access_key.trim()) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const awsConfig = {
        region: config.region,
        accessKeyId: config.access_key_id,
        secretAccessKey: config.secret_access_key,
        endpoint: config.endpoint,
        certificate: config.certificate,
        syncEnabled: config.sync_enabled,
        syncIntervalSeconds: config.sync_interval_seconds,
        syncDirection: config.sync_direction,
        conflictResolution: config.conflict_resolution,
        webhookEnabled: config.webhook_enabled,
      }

      console.log('[AwsIotConfigDialog] Saving config:', { integrationId, organizationId })

      let response
      if (integrationId) {
        console.log('[AwsIotConfigDialog] Performing UPDATE with ID:', integrationId)
        
        response = await edgeFunctions.integrations.update(integrationId, {
          name: config.name,
          settings: awsConfig,
          status: config.status,
        })

        console.log('[AwsIotConfigDialog] Update result:', { success: response.success })

        if (!response.success) {
          console.error('[AwsIotConfigDialog] Update error:', response.error)
          throw new Error(typeof response.error === 'string' ? response.error : 'Failed to update integration')
        }

        toast.success('Configuration updated successfully')
      } else {
        response = await edgeFunctions.integrations.create({
          organization_id: organizationId,
          integration_type: 'aws_iot',
          name: config.name,
          settings: awsConfig,
        } as any)

        console.log('[AwsIotConfigDialog] Create result:', { success: response.success })

        if (!response.success) {
          console.error('[AwsIotConfigDialog] Create error:', response.error)
          let errorMsg = typeof response.error === 'string' ? response.error : 'Failed to create integration'
          
          if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
            errorMsg = `An AWS IoT integration with the name "${config.name}" already exists. Please choose a different name.`
          }
          
          throw new Error(errorMsg)
        }

        const createdIntegration = (response.data as any)?.integration
        if (createdIntegration?.id) {
          setConfig({ ...config, id: createdIntegration.id })
        }
        toast.success('Configuration created successfully')
      }

      onSaved?.()
      loadConfig()
    } catch (error) {
      console.error('[AwsIotConfigDialog] Save error:', error)
      toast.error('Failed to save configuration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AWS IoT Core Integration</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-gray-100 dark:bg-gray-100">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sync">Sync Settings</TabsTrigger>
            <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="run-sync">Run Sync</TabsTrigger>
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
                placeholder="e.g., AWS IoT Production"
                className={!config.name.trim() ? 'border-red-300' : ''}
              />
              <p className="text-sm text-muted-foreground">
                A friendly name to identify this integration
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">AWS Region *</Label>
              <Select value={config.region} onValueChange={(value) => setConfig({ ...config, region: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AWS_REGIONS.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-key">Access Key ID *</Label>
              <Input
                id="access-key"
                type="password"
                value={config.access_key_id}
                onChange={(e) => setConfig({ ...config, access_key_id: e.target.value })}
                placeholder="AKIA..."
                className={!config.access_key_id.trim() ? 'border-red-300' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secret-key">Secret Access Key *</Label>
              <Input
                id="secret-key"
                type="password"
                value={config.secret_access_key}
                onChange={(e) => setConfig({ ...config, secret_access_key: e.target.value })}
                placeholder="Enter secret access key"
                className={!config.secret_access_key.trim() ? 'border-red-300' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endpoint">Custom Endpoint (Optional)</Label>
              <Input
                id="endpoint"
                value={config.endpoint}
                onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                placeholder="https://your-endpoint.iot.region.amazonaws.com"
              />
            </div>

            <IntegrationStatusToggle
              status={config.status}
              onStatusChange={(status) => setConfig({ ...config, status })}
              disabled={!config.name.trim() || !config.access_key_id.trim() || !config.secret_access_key.trim()}
              disabledMessage="Fill in required fields (Name, Access Key, Secret Key) to enable"
            />

            <div className="flex items-center justify-between pt-4">
              <div className="flex flex-col gap-1">
                <Button
                  variant="outline"
                  onClick={testConnection}
                  disabled={testing || !integrationId || !config.access_key_id || !config.secret_access_key}
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

          {/* Sync Settings Tab */}
          <TabsContent value="sync" className="space-y-4">
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
                  setConfig({ ...config, sync_interval_seconds: parseInt(e.target.value) })
                }
                disabled={!config.sync_enabled}
              />
              <p className="text-sm text-muted-foreground">
                Minimum: 60 seconds
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sync-direction">Sync Direction</Label>
              <Select
                value={config.sync_direction}
                onValueChange={(value: 'import' | 'export' | 'bidirectional') => 
                  setConfig({ ...config, sync_direction: value })
                }
              >
                <SelectTrigger id="sync-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="import">Import (AWS IoT → NetNeural)</SelectItem>
                  <SelectItem value="export">Export (NetNeural → AWS IoT)</SelectItem>
                  <SelectItem value="bidirectional">Bidirectional (Both ways)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose how devices should be synchronized
              </p>
            </div>
          </TabsContent>

          {/* Conflicts Tab */}
          <TabsContent value="conflicts" className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <p className="text-sm text-amber-900 dark:text-amber-100">
                Conflicts occur when a device is modified in both systems
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="conflict-resolution">Automatic Resolution</Label>
              <Select
                value={config.conflict_resolution}
                onValueChange={(value: 'manual' | 'local_wins' | 'remote_wins' | 'newest_wins') => 
                  setConfig({ ...config, conflict_resolution: value })
                }
              >
                <SelectTrigger id="conflict-resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (Require user resolution)</SelectItem>
                  <SelectItem value="local_wins">Local Wins (NetNeural takes priority)</SelectItem>
                  <SelectItem value="remote_wins">Remote Wins (AWS IoT takes priority)</SelectItem>
                  <SelectItem value="newest_wins">Newest Wins (Latest update wins)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <h4 className="font-medium text-sm">Resolution Strategies</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Manual:</strong> You review and resolve each conflict</li>
                <li><strong>Local Wins:</strong> NetNeural version always takes priority</li>
                <li><strong>Remote Wins:</strong> AWS IoT version always takes priority</li>
                <li><strong>Newest Wins:</strong> Most recently updated version wins</li>
              </ul>
            </div>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Webhooks</Label>
                <p className="text-sm text-muted-foreground">
                  Receive real-time updates from AWS IoT Core
                </p>
              </div>
              <Switch
                checked={config.webhook_enabled}
                onCheckedChange={(checked) => 
                  setConfig({ ...config, webhook_enabled: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL (Auto-generated)</Label>
              <Input
                id="webhook-url"
                value={config.webhook_url}
                readOnly
                className="bg-muted cursor-default"
                placeholder="Will be auto-generated when saved"
              />
              <p className="text-sm text-muted-foreground">
                ✨ This URL is automatically generated. Configure it in your AWS IoT Rules.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Webhook Secret (Auto-generated)</Label>
              <Input
                id="webhook-secret"
                type="password"
                value={config.webhook_secret}
                readOnly
                className="bg-muted cursor-default"
                placeholder="Will be auto-generated when saved"
              />
              <p className="text-sm text-muted-foreground">
                ✨ Securely generated for HMAC SHA-256 signature verification
              </p>
            </div>
          </TabsContent>

          {/* Run Sync Tab - Execute sync operations */}
          {integrationId && (
            <TabsContent value="run-sync" className="space-y-4">
              <IntegrationSyncTab
                integrationId={integrationId}
                organizationId={organizationId}
                integrationType="aws_iot"
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

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={saveConfig} 
            disabled={loading || !config.name.trim() || !config.access_key_id.trim() || !config.secret_access_key.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
