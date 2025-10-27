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
import { goliothSyncService } from '@/services/golioth-sync.service'
import { toast } from 'sonner'

interface Props {
  integrationId: string
  organizationId: string
  onSyncComplete?: () => void
}

export function GoliothSyncButton({ integrationId, organizationId, onSyncComplete }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [operation, setOperation] = useState<string | null>(null)

  const handleSync = async (op: 'import' | 'export' | 'bidirectional') => {
    setSyncing(true)
    setOperation(op)

    try {
      const result = await goliothSyncService.triggerSync({
        integrationId,
        organizationId,
        operation: op,
      })

      if (result.status === 'completed') {
        toast.success(
          `Sync completed: ${result.devicesSucceeded} devices synced successfully`
        )
      } else if (result.status === 'partial') {
        toast.warning(
          `Sync partially completed: ${result.devicesSucceeded} succeeded, ${result.devicesFailed} failed`
        )
      } else if (result.status === 'failed') {
        toast.error('Sync failed. Check sync history for details.')
      }

      onSyncComplete?.()
    } catch (error: any) {
      toast.error(`Sync failed: ${error.message}`)
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
          Import from Golioth
          <span className="ml-auto text-xs text-muted-foreground">→</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => handleSync('export')}>
          <Upload className="mr-2 h-4 w-4" />
          Export to Golioth
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
