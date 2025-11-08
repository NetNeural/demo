'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RefreshCw, Download, Upload, ArrowLeftRight, Loader2 } from 'lucide-react'
import { integrationService } from '@/services/integration.service'
import { toast } from 'sonner'

type IntegrationType = 'golioth' | 'aws_iot' | 'aws-iot' | 'azure_iot' | 'azure-iot' | 'google_iot' | 'google-iot' | 'mqtt'
type SyncOperation = 'import' | 'export' | 'bidirectional'

interface Props {
  integrationType: IntegrationType
  integrationId: string
  organizationId: string
  platformName?: string // Display name like "AWS IoT Core", "Azure IoT Hub", etc.
  onSyncComplete?: () => void
}

export function IntegrationSyncButton({ 
  integrationType, 
  integrationId, 
  organizationId,
  platformName,
  onSyncComplete 
}: Props) {
  const [syncing, setSyncing] = useState(false)
  const [operation, setOperation] = useState<string | null>(null)

  // Normalize integration type for service calls
  const normalizedType = integrationType.replace('-', '_') as 'aws_iot' | 'azure_iot' | 'google_iot'
  
  // Get display name for platform
  const displayName = platformName || (() => {
    switch (integrationType) {
      case 'golioth': return 'Golioth'
      case 'aws_iot':
      case 'aws-iot': return 'AWS IoT Core'
      case 'azure_iot':
      case 'azure-iot': return 'Azure IoT Hub'
      case 'google_iot':
      case 'google-iot': return 'Google Cloud IoT'
      case 'mqtt': return 'MQTT Broker'
      default: return 'Platform'
    }
  })()

  const handleSync = async (op: SyncOperation) => {
    setSyncing(true)
    setOperation(op)

    try {
      const options = {
        integrationId,
        organizationId,
        operation: op,
      }

      let result

      // Call appropriate service method based on integration type
      switch (normalizedType) {
        case 'aws_iot':
          result = await integrationService.syncAwsIot(options)
          break
        case 'azure_iot':
          result = await integrationService.syncAzureIot(options)
          break
        case 'google_iot':
          result = await integrationService.syncGoogleIot(options)
          break
        default:
          // For Golioth and MQTT, use the unified device-sync endpoint
          result = await integrationService.syncGolioth(options)
      }

      if (result.status === 'completed') {
        toast.success(
          `Sync completed: ${result.devicesSucceeded || 0} devices synced successfully`
        )
      } else if (result.status === 'partial') {
        toast.warning(
          `Sync partially completed: ${result.devicesSucceeded || 0} succeeded, ${result.devicesFailed || 0} failed`
        )
      } else if (result.status === 'failed') {
        toast.error('Sync failed. Check sync history for details.')
      }

      onSyncComplete?.()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Sync failed: ${errorMessage}`)
      console.error('Sync error:', error)
    } finally {
      setSyncing(false)
      setOperation(null)
    }
  }

  const getOperationLabel = () => {
    switch (operation) {
      case 'import': return 'Importing...'
      case 'export': return 'Exporting...'
      case 'bidirectional': return 'Syncing...'
      default: return 'Syncing...'
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={syncing}>
          {syncing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {getOperationLabel()}
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Devices
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Sync Direction</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => handleSync('import')}>
          <Download className="mr-2 h-4 w-4" />
          Import from {displayName}
          <span className="ml-auto text-xs text-muted-foreground">→</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleSync('export')}>
          <Upload className="mr-2 h-4 w-4" />
          Export to {displayName}
          <span className="ml-auto text-xs text-muted-foreground">←</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => handleSync('bidirectional')}>
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Bidirectional Sync
          <span className="ml-auto text-xs text-muted-foreground">↔</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
