'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Download, 
  Upload, 
  ArrowLeftRight,
  Clock
} from 'lucide-react'
import { goliothSyncService } from '@/services/golioth-sync.service'
import type { Database } from '@/types/supabase'

type SyncLog = Database['public']['Tables']['golioth_sync_log']['Row']

interface Props {
  organizationId: string
  integrationId?: string
  limit?: number
  autoRefresh?: boolean
}

export function SyncHistoryList({
  organizationId,
  integrationId,
  limit = 50,
  autoRefresh = false,
}: Props) {
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLogs()

    if (autoRefresh) {
      const channel = goliothSyncService.subscribeSyncUpdates(
        organizationId,
        (newLog) => {
          setLogs((prev) => [newLog, ...prev].slice(0, limit))
        }
      )

      return () => {
        channel.unsubscribe()
      }
    }
    return undefined
  }, [organizationId, integrationId, limit, autoRefresh])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await goliothSyncService.getSyncHistory(organizationId, limit)
      const filtered = integrationId
        ? data.filter((log) => log.integration_id === integrationId)
        : data
      setLogs(filtered)
    } catch (error) {
      console.error('Failed to load sync history:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'partial':
        return <AlertCircle className="h-4 w-4 text-amber-600" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'import':
        return <Download className="h-4 w-4" />
      case 'export':
        return <Upload className="h-4 w-4" />
      case 'bidirectional':
        return <ArrowLeftRight className="h-4 w-4" />
      default:
        return <RefreshCw className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      completed: 'default',
      failed: 'destructive',
      partial: 'secondary',
      started: 'outline',
      processing: 'outline',
    }

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sync History</CardTitle>
            <CardDescription>Recent synchronization operations</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] pr-4 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mb-2" />
              <p>No sync history yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Operation Icon */}
                  <div className="mt-1">
                    {getOperationIcon(log.operation)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize">
                        {log.operation}
                      </span>
                      {getStatusBadge(log.status)}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        <strong className="text-green-600">{log.devices_succeeded}</strong> succeeded
                      </span>
                      {(log.devices_failed ?? 0) > 0 && (
                        <span>
                          <strong className="text-red-600">{log.devices_failed}</strong> failed
                        </span>
                      )}
                      {(log.conflicts_detected ?? 0) > 0 && (
                        <span>
                          <strong className="text-amber-600">{log.conflicts_detected}</strong> conflicts
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                      {log.completed_at && (
                        <> • Duration: {
                          Math.round(
                            (new Date(log.completed_at).getTime() - new Date(log.created_at).getTime()) / 1000
                          )
                        }s</>
                      )}
                    </p>

                    {/* Error Message */}
                    {log.error_message && (
                      <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded mt-2">
                        {log.error_message}
                      </p>
                    )}
                  </div>

                  {/* Status Icon */}
                  <div className="mt-1">
                    {getStatusIcon(log.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
