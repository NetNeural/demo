'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, Check, X, Loader2, RefreshCw } from 'lucide-react'
import { integrationSyncService } from '@/services/integration-sync.service'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface DeviceConflict {
  id: string
  device_id: string
  conflict_type: string
  field_name: string
  local_value: unknown
  remote_value: unknown
  local_updated_at: string | null
  remote_updated_at: string | null
  resolution_status: 'pending' | 'resolved' | 'ignored' | 'auto_resolved'
  created_at: string
  device?: {
    name: string
  }
}

interface ConflictsTabProps {
  organizationId: string
  integrationId?: string
}

export function ConflictsTab({
  organizationId,
}: Omit<ConflictsTabProps, 'integrationId'>) {
  const [conflicts, setConflicts] = useState<DeviceConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)

  const loadConflicts = useCallback(async () => {
    setLoading(true)
    try {
      const data =
        await integrationSyncService.getPendingConflicts(organizationId)
      // Filter by integration if specified (integrationId would require device lookup)
      setConflicts(data as unknown as DeviceConflict[])
    } catch (error) {
      console.error('Failed to load conflicts:', error)
      toast.error('Failed to load conflicts')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    loadConflicts()
  }, [loadConflicts])

  const resolveConflict = async (
    conflictId: string,
    strategy: 'local_wins' | 'remote_wins',
    conflict: DeviceConflict
  ) => {
    setResolving(conflictId)
    try {
      const resolvedValue =
        strategy === 'local_wins'
          ? { [conflict.field_name]: conflict.local_value }
          : { [conflict.field_name]: conflict.remote_value }

      await integrationSyncService.resolveConflict(
        conflictId,
        strategy,
        resolvedValue
      )
      toast.success(`Conflict resolved: ${strategy.replace('_', ' ')}`)
      await loadConflicts()
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      toast.error('Failed to resolve conflict')
    } finally {
      setResolving(null)
    }
  }

  const ignoreConflict = async (conflictId: string) => {
    setResolving(conflictId)
    try {
      await integrationSyncService.resolveConflict(
        conflictId,
        'local_wins',
        undefined
      )
      toast.success('Conflict ignored')
      await loadConflicts()
    } catch (error) {
      console.error('Failed to ignore conflict:', error)
      toast.error('Failed to ignore conflict')
    } finally {
      setResolving(null)
    }
  }

  const renderValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="italic text-muted-foreground">null</span>
    }
    if (typeof value === 'object') {
      return (
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          {JSON.stringify(value)}
        </code>
      )
    }
    return (
      <code className="rounded bg-muted px-1 py-0.5 text-xs">
        {String(value)}
      </code>
    )
  }

  const getConflictTypeColor = (type: string) => {
    switch (type) {
      case 'data_mismatch':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'timestamp_conflict':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'status_conflict':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (conflicts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Check className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold">No Conflicts</h3>
            <p className="text-muted-foreground">
              All device data is synchronized successfully
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {conflicts.length} Pending Conflicts
          </h3>
          <p className="text-sm text-muted-foreground">
            Review and resolve conflicts between local and remote data
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadConflicts}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Conflicts occur when the same device has different values locally and
          remotely. Choose which version to keep or ignore the conflict.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {conflicts.map((conflict) => (
          <Card key={conflict.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    {conflict.device?.name || 'Unknown Device'}
                  </CardTitle>
                  <CardDescription>
                    Field:{' '}
                    <code className="rounded bg-muted px-1 py-0.5 text-xs">
                      {conflict.field_name}
                    </code>
                    {' • '}
                    <Badge
                      variant="outline"
                      className={getConflictTypeColor(conflict.conflict_type)}
                    >
                      {conflict.conflict_type.replace('_', ' ')}
                    </Badge>
                  </CardDescription>
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(conflict.created_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Local Value (NetNeural)
                    </h4>
                    {conflict.local_updated_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(
                          new Date(conflict.local_updated_at),
                          'MMM d, h:mm a'
                        )}
                      </span>
                    )}
                  </div>
                  <div className="rounded-md bg-blue-50 p-3 dark:bg-blue-950">
                    {renderValue(conflict.local_value)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">
                      Remote Value (Golioth)
                    </h4>
                    {conflict.remote_updated_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(
                          new Date(conflict.remote_updated_at),
                          'MMM d, h:mm a'
                        )}
                      </span>
                    )}
                  </div>
                  <div className="rounded-md bg-purple-50 p-3 dark:bg-purple-950">
                    {renderValue(conflict.remote_value)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    resolveConflict(conflict.id, 'local_wins', conflict)
                  }
                  disabled={resolving === conflict.id}
                >
                  {resolving === conflict.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Keep Local
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    resolveConflict(conflict.id, 'remote_wins', conflict)
                  }
                  disabled={resolving === conflict.id}
                >
                  {resolving === conflict.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Keep Remote
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => ignoreConflict(conflict.id)}
                  disabled={resolving === conflict.id}
                >
                  <X className="mr-2 h-4 w-4" />
                  Ignore
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
