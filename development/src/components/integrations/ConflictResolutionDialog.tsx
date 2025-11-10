'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertTriangle } from 'lucide-react'
import { integrationSyncService } from '@/services/integration-sync.service'
import { toast } from 'sonner'

interface Conflict {
  id: string
  device_id: string
  device_name: string
  field_name: string
  local_value: Record<string, unknown> | string | number | boolean | null
  remote_value: Record<string, unknown> | string | number | boolean | null
  detected_at: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  onResolved?: () => void
}

export function ConflictResolutionDialog({
  open,
  onOpenChange,
  organizationId,
  onResolved,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const loadConflicts = async () => {
    setLoading(true)
    try {
      const data = await integrationSyncService.getPendingConflicts(organizationId)
      setConflicts(data as unknown as Conflict[])
      setCurrentIndex(0)
    } catch (error) {
      console.error('Failed to load conflicts:', error)
      toast.error('Failed to load conflicts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadConflicts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, organizationId])

  const handleResolve = async (strategy: 'local_wins' | 'remote_wins' | 'merge') => {
    if (!currentConflict) return

    setResolving(true)
    try {
      const value = strategy === 'remote_wins' ? currentConflict.remote_value : currentConflict.local_value
      const resolvedValue = typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined
      
      await integrationSyncService.resolveConflict(
        currentConflict.id,
        strategy,
        resolvedValue
      )

      toast.success(`Conflict resolved using ${strategy.replace('_', ' ')}`)

      // Remove resolved conflict and move to next
      const newConflicts = conflicts.filter((c) => c.id !== currentConflict.id)
      setConflicts(newConflicts)

      if (newConflicts.length === 0) {
        onResolved?.()
        onOpenChange(false)
      } else if (currentIndex >= newConflicts.length) {
        setCurrentIndex(newConflicts.length - 1)
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      toast.error('Failed to resolve conflict')
    } finally {
      setResolving(false)
    }
  }

  const currentConflict = conflicts[currentIndex]

  const formatValue = (value: Record<string, unknown> | string | number | boolean | null): string => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Resolve Device Conflicts
          </DialogTitle>
          <DialogDescription>
            {conflicts.length === 0 ? (
              'No pending conflicts'
            ) : (
              `Conflict ${currentIndex + 1} of ${conflicts.length}`
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : conflicts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No conflicts to resolve</p>
          </div>
        ) : currentConflict ? (
          <div className="space-y-6">
            {/* Device Info */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <h4 className="font-medium">{currentConflict.device_name}</h4>
                <p className="text-sm text-muted-foreground">
                  Field: <code className="px-1 py-0.5 bg-background rounded">
                    {currentConflict.field_name}
                  </code>
                </p>
              </div>
              <Badge variant="destructive">Conflict</Badge>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-4">
              {/* Local Value */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">NetNeural (Local)</h5>
                  <Badge variant="outline">Local</Badge>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <pre className="text-sm overflow-auto max-h-40">
                    {formatValue(currentConflict.local_value)}
                  </pre>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleResolve('local_wins')}
                  disabled={resolving}
                >
                  {resolving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Keep Local
                </Button>
              </div>

              {/* Remote Value */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">Golioth (Remote)</h5>
                  <Badge variant="outline">Remote</Badge>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <pre className="text-sm overflow-auto max-h-40">
                    {formatValue(currentConflict.remote_value)}
                  </pre>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleResolve('remote_wins')}
                  disabled={resolving}
                >
                  {resolving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Keep Remote
                </Button>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="ghost"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0 || resolving}
              >
                Previous
              </Button>

              <p className="text-sm text-muted-foreground">
                Detected {new Date(currentConflict.detected_at).toLocaleString()}
              </p>

              <Button
                variant="ghost"
                onClick={() => setCurrentIndex(Math.min(conflicts.length - 1, currentIndex + 1))}
                disabled={currentIndex === conflicts.length - 1 || resolving}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
