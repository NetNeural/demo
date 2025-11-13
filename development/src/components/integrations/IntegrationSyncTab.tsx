'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Loader2, Play, Square, Download, Trash2 } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'

interface SyncOptions {
  direction?: 'import' | 'export' | 'bidirectional'
  createMissing?: boolean
  updateExisting?: boolean
  syncStatus?: boolean
  syncMetadata?: boolean
  dryRun?: boolean
  deviceLimit?: number
}

interface SyncLogEntry {
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
}

interface Props {
  integrationId: string
  organizationId: string
  integrationType: string
  integrationName: string
  
  // Optional customization per integration
  defaultOptions?: Partial<SyncOptions>
  availableDirections?: Array<'import' | 'export' | 'bidirectional'>
  showCreateMissing?: boolean
  showUpdateExisting?: boolean
  showSyncStatus?: boolean
  showSyncMetadata?: boolean
  showDryRun?: boolean
  showDeviceLimit?: boolean
  customOptionsRenderer?: (options: SyncOptions, setOptions: (options: SyncOptions) => void, syncing: boolean) => React.ReactNode
  helpText?: string
}

export function IntegrationSyncTab({
  integrationId,
  organizationId,
  integrationType,
  integrationName,
  defaultOptions = {},
  availableDirections = ['import', 'export', 'bidirectional'],
  showCreateMissing = true,
  showUpdateExisting = true,
  showSyncStatus = true,
  showSyncMetadata = true,
  showDryRun = true,
  showDeviceLimit = true,
  customOptionsRenderer,
  helpText
}: Props) {
  const [syncing, setSyncing] = useState(false)
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({
    direction: defaultOptions.direction || 'bidirectional',
    createMissing: defaultOptions.createMissing ?? true,
    updateExisting: defaultOptions.updateExisting ?? true,
    syncStatus: defaultOptions.syncStatus ?? true,
    syncMetadata: defaultOptions.syncMetadata ?? true,
    dryRun: defaultOptions.dryRun ?? false,
    deviceLimit: defaultOptions.deviceLimit ?? 0
  })
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new log entries appear
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [syncLog])

  const addLogEntry = (level: SyncLogEntry['level'], message: string) => {
    setSyncLog(prev => [...prev, {
      timestamp: new Date().toISOString(),
      level,
      message
    }])
  }

  const clearLog = () => {
    setSyncLog([])
  }

  const exportLog = () => {
    const logText = syncLog.map(entry => 
      `[${new Date(entry.timestamp).toLocaleTimeString()}] [${entry.level.toUpperCase()}] ${entry.message}`
    ).join('\n')
    
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${integrationName}-sync-${Date.now()}.log`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Log exported successfully')
  }

  const handleSync = async () => {
    setSyncing(true)
    clearLog()
    
    addLogEntry('info', `Starting ${syncOptions.dryRun ? 'DRY RUN' : 'sync'} for ${integrationName}...`)
    addLogEntry('info', `Integration Type: ${integrationType}`)
    addLogEntry('info', `Direction: ${syncOptions.direction}`)
    addLogEntry('info', `Options: ${JSON.stringify(syncOptions, null, 2)}`)

    try {
      addLogEntry('info', 'Calling sync endpoint...')
      
      const response = await edgeFunctions.integrations.sync({
        integrationId,
        organizationId,
        operation: syncOptions.direction === 'import' ? 'import' : 
                   syncOptions.direction === 'export' ? 'export' : 'bidirectional',
        deviceIds: syncOptions.deviceLimit && syncOptions.deviceLimit > 0 ? [] : undefined
      })

      if (!response.success) {
        addLogEntry('error', `Sync failed: ${response.error?.message || 'Unknown error'}`)
        toast.error('Sync failed')
        return
      }

      interface SyncResult {
        summary?: {
          syncedDevices?: number
          createdDevices?: number
          updatedDevices?: number
          skippedDevices?: number
          errorCount?: number
        }
        details?: Array<{
          success: boolean
          deviceName?: string
          deviceId: string
          action: string
          error?: string
        }>
        errors?: Array<{
          deviceId: string
          error: string
        }>
        logs?: string[] // Detailed log messages from edge function
      }
      
      const result = response.data as SyncResult
      addLogEntry('success', 'Sync endpoint responded successfully')
      
      // Log detailed logs from edge function (if available)
      if (result.logs && Array.isArray(result.logs)) {
        result.logs.forEach((log) => {
          // Determine log level based on emoji/content
          if (log.includes('✅') || log.includes('SUCCESS')) {
            addLogEntry('success', log)
          } else if (log.includes('⚠️') || log.includes('WARNING') || log.includes('ℹ️')) {
            addLogEntry('warning', log)
          } else if (log.includes('✗') || log.includes('ERROR') || log.includes('Failed')) {
            addLogEntry('error', log)
          } else {
            addLogEntry('info', log)
          }
        })
      }
      
      // Log summary
      if (result.summary) {
        addLogEntry('info', '=== Sync Summary ===')
        addLogEntry('success', `✓ Devices synced: ${result.summary.syncedDevices || 0}`)
        addLogEntry('success', `✓ Devices created: ${result.summary.createdDevices || 0}`)
        addLogEntry('success', `✓ Devices updated: ${result.summary.updatedDevices || 0}`)
        addLogEntry('warning', `⚠ Devices skipped: ${result.summary.skippedDevices || 0}`)
        addLogEntry('error', `✗ Errors: ${result.summary.errorCount || 0}`)
      }

      // Log details
      if (result.details && Array.isArray(result.details)) {
        addLogEntry('info', '=== Sync Details ===')
        result.details.forEach((detail) => {
          if (detail.success) {
            addLogEntry('success', `✓ ${detail.deviceName || detail.deviceId}: ${detail.action}`)
          } else {
            addLogEntry('error', `✗ ${detail.deviceName || detail.deviceId}: ${detail.error}`)
          }
        })
      }

      // Log errors
      if (result.errors && Array.isArray(result.errors)) {
        result.errors.forEach((error) => {
          // Handle both string errors and object errors
          if (typeof error === 'string') {
            addLogEntry('error', `✗ ${error}`)
          } else {
            addLogEntry('error', `✗ ${error.deviceId}: ${error.error}`)
          }
        })
      }

      addLogEntry('success', syncOptions.dryRun ? 'Dry run completed' : 'Sync completed successfully')
      toast.success(syncOptions.dryRun ? 'Dry run completed' : 'Sync completed')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      addLogEntry('error', `Sync failed: ${errorMessage}`)
      toast.error('Sync failed')
      console.error('Sync error:', error)
    } finally {
      setSyncing(false)
    }
  }

  const stopSync = () => {
    // TODO: Implement sync cancellation if we add streaming support
    setSyncing(false)
    addLogEntry('warning', 'Sync stopped by user')
  }

  return (
    <div className="space-y-4">
      {/* Sync Options */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Sync Options</h3>
          {helpText && (
            <p className="text-sm text-muted-foreground">{helpText}</p>
          )}
        </div>
        
        {customOptionsRenderer ? (
          // Custom options UI for this integration
          customOptionsRenderer(syncOptions, setSyncOptions, syncing)
        ) : (
          // Default options UI
          <>
            <div className="grid grid-cols-2 gap-4">
              {/* Direction */}
              {availableDirections.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="sync-direction">Direction</Label>
                  <Select
                    value={syncOptions.direction}
                    onValueChange={(value: 'import' | 'export' | 'bidirectional') => 
                      setSyncOptions({ ...syncOptions, direction: value })
                    }
                    disabled={syncing}
                  >
                    <SelectTrigger id="sync-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDirections.includes('import') && (
                        <SelectItem value="import">Import (Remote → Local)</SelectItem>
                      )}
                      {availableDirections.includes('export') && (
                        <SelectItem value="export">Export (Local → Remote)</SelectItem>
                      )}
                      {availableDirections.includes('bidirectional') && (
                        <SelectItem value="bidirectional">Bidirectional</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Device Limit */}
              {showDeviceLimit && (
                <div className="space-y-2">
                  <Label htmlFor="device-limit">Device Limit</Label>
                  <Input
                    id="device-limit"
                    type="number"
                    min={0}
                    value={syncOptions.deviceLimit}
                    onChange={(e) => 
                      setSyncOptions({ ...syncOptions, deviceLimit: parseInt(e.target.value) || 0 })
                    }
                    disabled={syncing}
                    placeholder="0 = no limit"
                  />
                </div>
              )}
            </div>

            {/* Switches */}
            <div className="grid grid-cols-2 gap-4">
              {showCreateMissing && (
                <div className="flex items-center justify-between">
                  <Label>Create Missing Devices</Label>
                  <Switch
                    checked={syncOptions.createMissing}
                    onCheckedChange={(checked) => 
                      setSyncOptions({ ...syncOptions, createMissing: checked })
                    }
                    disabled={syncing}
                  />
                </div>
              )}

              {showUpdateExisting && (
                <div className="flex items-center justify-between">
                  <Label>Update Existing Devices</Label>
                  <Switch
                    checked={syncOptions.updateExisting}
                    onCheckedChange={(checked) => 
                      setSyncOptions({ ...syncOptions, updateExisting: checked })
                    }
                    disabled={syncing}
                  />
                </div>
              )}

              {showSyncStatus && (
                <div className="flex items-center justify-between">
                  <Label>Sync Status</Label>
                  <Switch
                    checked={syncOptions.syncStatus}
                    onCheckedChange={(checked) => 
                      setSyncOptions({ ...syncOptions, syncStatus: checked })
                    }
                    disabled={syncing}
                  />
                </div>
              )}

              {showSyncMetadata && (
                <div className="flex items-center justify-between">
                  <Label>Sync Metadata</Label>
                  <Switch
                    checked={syncOptions.syncMetadata}
                    onCheckedChange={(checked) => 
                      setSyncOptions({ ...syncOptions, syncMetadata: checked })
                    }
                    disabled={syncing}
                  />
                </div>
              )}

              {showDryRun && (
                <div className="flex items-center justify-between">
                  <Label className="text-amber-600">Dry Run (Test Mode)</Label>
                  <Switch
                    checked={syncOptions.dryRun}
                    onCheckedChange={(checked) => 
                      setSyncOptions({ ...syncOptions, dryRun: checked })
                    }
                    disabled={syncing}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* Sync Controls */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="flex-1"
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {syncOptions.dryRun ? 'Run Dry Run' : 'Start Sync'}
              </>
            )}
          </Button>
          
          {syncing && (
            <Button
              onClick={stopSync}
              variant="destructive"
              size="icon"
            >
              <Square className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Sync Log Terminal */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Sync Log</h3>
          <div className="flex gap-2">
            <Button
              onClick={exportLog}
              variant="outline"
              size="sm"
              disabled={syncLog.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              onClick={clearLog}
              variant="outline"
              size="sm"
              disabled={syncLog.length === 0}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        {/* Terminal-like log output */}
        <div className="bg-gray-950 text-gray-100 rounded-md p-4 font-mono text-sm h-[400px] overflow-y-auto">
          {syncLog.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No sync operations yet. Click &quot;Start Sync&quot; to begin.
            </div>
          ) : (
            syncLog.map((entry, index) => (
              <div
                key={index}
                className={`py-1 ${
                  entry.level === 'error' ? 'text-red-400' :
                  entry.level === 'warning' ? 'text-yellow-400' :
                  entry.level === 'success' ? 'text-green-400' :
                  'text-gray-300'
                }`}
              >
                <span className="text-gray-500">
                  [{new Date(entry.timestamp).toLocaleTimeString()}]
                </span>
                {' '}
                <span className={`font-bold ${
                  entry.level === 'error' ? 'text-red-500' :
                  entry.level === 'warning' ? 'text-yellow-500' :
                  entry.level === 'success' ? 'text-green-500' :
                  'text-blue-500'
                }`}>
                  [{entry.level.toUpperCase()}]
                </span>
                {' '}
                {entry.message}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: Switch to the Activity Log tab to see detailed API communication logs.
        </p>
      </Card>
    </div>
  )
}
