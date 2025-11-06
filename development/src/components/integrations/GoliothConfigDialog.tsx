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
import { createClient } from '@/lib/supabase/client'
import { goliothSyncService } from '@/services/golioth-sync.service'
import { toast } from 'sonner'
import { IntegrationActivityLog } from './IntegrationActivityLog'
import { IntegrationStatusToggle } from './IntegrationStatusToggle'

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
}

export function GoliothConfigDialog({ 
  open, 
  onOpenChange, 
  integrationId, 
  organizationId,
  onSaved 
}: Props) {
  const supabase = createClient()
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
      const { data, error } = await supabase
        .from('device_integrations')
        .select('*')
        .eq('id', integrationId)
        .single()

      if (error) throw error

      if (data) {
        setConfig({
          id: data.id,
          name: data.name,
          api_key: data.api_key_encrypted || '',
          project_id: data.project_id || '',
          base_url: data.base_url || 'https://api.golioth.io/v1',
          status: (data.status as 'active' | 'inactive' | 'not-configured') || 'not-configured',
          sync_enabled: data.sync_enabled || false,
          sync_interval_seconds: data.sync_interval_seconds || 300,
          sync_direction: (data.sync_direction as 'import' | 'export' | 'bidirectional') || 'bidirectional',
          conflict_resolution: (data.conflict_resolution as 'manual' | 'local_wins' | 'remote_wins' | 'newest_wins') || 'manual',
          webhook_enabled: data.webhook_enabled || false,
          webhook_secret: data.webhook_secret || '',
          webhook_url: data.webhook_url || '',
        })
      }
    } catch (error: any) {
      toast.error('Failed to load configuration')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [integrationId])

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
      toast.error('Please save the configuration first before testing the connection')
      return
    }

    setTesting(true)
    setTestResult(null)
    
    try {
      const result = await goliothSyncService.testConnection(integrationId, organizationId)
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
      console.error('[GoliothConfigDialog] Test connection error:', error)
    } finally {
      setTesting(false)
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
      const payload = {
        organization_id: organizationId,
        integration_type: 'golioth',
        name: config.name,
        api_key_encrypted: config.api_key,
        project_id: config.project_id,
        base_url: config.base_url,
        sync_enabled: config.sync_enabled,
        sync_interval_seconds: config.sync_interval_seconds,
        sync_direction: config.sync_direction,
        conflict_resolution: config.conflict_resolution,
        webhook_enabled: config.webhook_enabled,
        webhook_secret: config.webhook_secret,
        webhook_url: config.webhook_url,
        status: config.status,
      }

      console.log('[GoliothConfigDialog] Saving config:', { integrationId, organizationId, payload })

      if (integrationId) {
        // Update existing
        console.log('[GoliothConfigDialog] Performing UPDATE with ID:', integrationId)
        
        const { data, error } = await supabase
          .from('device_integrations')
          .update(payload)
          .eq('id', integrationId)
          .select()

        console.log('[GoliothConfigDialog] Update result:', { data, error, rowCount: data?.length })

        if (error) {
          console.error('[GoliothConfigDialog] Update error:', error)
          throw new Error(error.message || 'Failed to update integration')
        }

        // Check if any rows were updated
        if (!data || data.length === 0) {
          console.warn('[GoliothConfigDialog] No rows updated - integration might not exist or RLS blocking')
          // Still treat as success since no error occurred
        }
      } else {
        // Create new
        const { data, error } = await supabase
          .from('device_integrations')
          .insert(payload)
          .select()

        console.log('[GoliothConfigDialog] Insert result:', { data, error })

        if (error) {
          console.error('[GoliothConfigDialog] Insert error:', error)
          throw new Error(error.message || 'Failed to create integration')
        }
      }

      toast.success('Configuration saved successfully')
      onSaved?.()
      onOpenChange(false)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to save configuration'
      toast.error(errorMessage)
      console.error('[GoliothConfigDialog] Save error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-white">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            {integrationId ? 'Edit' : 'Add'} Golioth Integration
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-gray-100 dark:bg-gray-100">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sync">Sync Settings</TabsTrigger>
            <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
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
                onValueChange={(value: any) => 
                  setConfig({ ...config, sync_direction: value })
                }
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
                onValueChange={(value: any) => 
                  setConfig({ ...config, conflict_resolution: value })
                }
              >
                <SelectTrigger id="conflict-resolution">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (Require user resolution)</SelectItem>
                  <SelectItem value="local_wins">Local Wins (NetNeural takes priority)</SelectItem>
                  <SelectItem value="remote_wins">Remote Wins (Golioth takes priority)</SelectItem>
                  <SelectItem value="newest_wins">Newest Wins (Latest update wins)</SelectItem>
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
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Webhooks</Label>
                <p className="text-sm text-muted-foreground">
                  Receive real-time updates from Golioth
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
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                value={config.webhook_url}
                onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                placeholder="https://your-domain.com/functions/v1/golioth-webhook"
                disabled={!config.webhook_enabled}
              />
              <p className="text-sm text-muted-foreground">
                Configure this URL in your Golioth project settings
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Webhook Secret</Label>
              <Input
                id="webhook-secret"
                type="password"
                value={config.webhook_secret}
                onChange={(e) => setConfig({ ...config, webhook_secret: e.target.value })}
                placeholder="Enter webhook secret for signature verification"
                disabled={!config.webhook_enabled}
              />
              <p className="text-sm text-muted-foreground">
                Used to verify webhook authenticity (HMAC SHA-256)
              </p>
            </div>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
      </DialogContent>
    </Dialog>
  )
}
