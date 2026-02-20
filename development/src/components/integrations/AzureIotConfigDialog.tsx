'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'
import { IntegrationActivityLog } from './IntegrationActivityLog'
import { IntegrationStatusToggle } from './IntegrationStatusToggle'
import { IntegrationSyncTab } from './IntegrationSyncTab'
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
  mode?: 'dialog' | 'page'
}

export function AzureIotConfigDialog({
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

      if (integration?.config) {
        const cfg = integration.config as any
        setConfig({
          id: integration.id,
          name: integration.name,
          connection_string: cfg.connectionString || '',
          hub_name: cfg.hubName || '',
          shared_access_key: cfg.sharedAccessKey || '',
          status: integration.status || 'not-configured',
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
        'azure_iot'
      )
      setTestResult({
        success: result.success,
        message: result.message || 'Connection test completed',
      })

      if (result.success) {
        toast.success('Azure IoT Hub connection successful!')
      } else {
        toast.error(result.message || 'Connection test failed')
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Connection test failed'
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
      const azureConfig = {
        connectionString: config.connection_string,
        hubName: config.hub_name,
        sharedAccessKey: config.shared_access_key,
      }

      let response
      if (integrationId) {
        response = await edgeFunctions.integrations.update(integrationId, {
          name: config.name,
          settings: azureConfig,
          status: config.status,
        })
      } else {
        response = await edgeFunctions.integrations.create({
          organization_id: organizationId,
          integration_type: 'azure_iot',
          name: config.name,
          settings: azureConfig,
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
          errorMsg = `An Azure IoT integration with the name "${config.name}" already exists. Please choose a different name.`
        }

        throw new Error(errorMsg)
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

  // Extract content into reusable component for both dialog and page modes
  const renderContent = () => (
    <>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start bg-gray-100 dark:bg-gray-100">
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
              placeholder="e.g., Azure IoT Production"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hub-name">IoT Hub Name *</Label>
            <Input
              id="hub-name"
              value={config.hub_name}
              onChange={(e) =>
                setConfig({ ...config, hub_name: e.target.value })
              }
              placeholder="my-iot-hub"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="connection-string">Connection String *</Label>
            <Input
              id="connection-string"
              type="password"
              value={config.connection_string}
              onChange={(e) =>
                setConfig({ ...config, connection_string: e.target.value })
              }
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
              onChange={(e) =>
                setConfig({ ...config, shared_access_key: e.target.value })
              }
              placeholder="Additional access key if needed"
            />
          </div>

          <IntegrationStatusToggle
            status={config.status}
            onStatusChange={(status) => setConfig({ ...config, status })}
            disabled={!config.connection_string || !config.hub_name}
            disabledMessage="Configure connection string and hub name to enable"
          />

          {testResult && (
            <div
              className={`flex items-start gap-2 rounded-md p-3 ${
                testResult.success
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
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
        </TabsContent>

        {/* Run Sync Tab - Execute sync operations */}
        {integrationId && (
          <TabsContent value="run-sync" className="space-y-4">
            <IntegrationSyncTab
              integrationId={integrationId}
              organizationId={organizationId}
              integrationType="azure_iot"
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

  // Render as page or dialog based on mode
  if (mode === 'page') {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {integrationId ? 'Edit' : 'Add'} Azure IoT Hub Integration
            </h2>
            <p className="text-muted-foreground">
              Configure your Azure IoT Hub integration settings
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-900">
            Azure IoT Hub Integration
          </DialogTitle>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
