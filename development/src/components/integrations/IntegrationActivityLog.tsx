'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  ExternalLink,
  Info,
  Filter,
  Download
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import type { Database } from '@/types/supabase'

type ActivityLog = Database['public']['Tables']['integration_activity_log']['Row']

interface Props {
  integrationId: string
  organizationId: string
  limit?: number
  autoRefresh?: boolean
}

export function IntegrationActivityLog({
  integrationId,
  organizationId, // eslint-disable-line @typescript-eslint/no-unused-vars -- Used by RLS for access control
  limit = 100,
  autoRefresh = false,
}: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [filterDirection, setFilterDirection] = useState<'all' | 'outgoing' | 'incoming'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all')

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      console.log('[ActivityLog] Loading logs for integration:', integrationId)
      console.log('[ActivityLog] Filters:', { filterDirection, filterStatus, limit })
      
      // Query database directly using Supabase client
      const supabase = createClient()
      let query = supabase
        .from('integration_activity_log')
        .select('*')
        .eq('integration_id', integrationId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit)

      // Apply direction filter
      if (filterDirection !== 'all') {
        query = query.eq('direction', filterDirection)
      }

      // Apply status filter
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query

      if (error) {
        console.error('[ActivityLog] Database query failed:', error)
        throw new Error(error.message || 'Failed to load activity logs')
      }

      console.log('[ActivityLog] Loaded logs:', data?.length || 0, data)
      setLogs(data || [])
    } catch (error) {
      console.error('[ActivityLog] Failed to load activity logs:', error)
    } finally {
      setLoading(false)
    }
  }, [integrationId, organizationId, limit, filterDirection, filterStatus])

  useEffect(() => {
    loadLogs()

    // Real-time updates would require direct Supabase client
    // For now, we'll just poll if autoRefresh is enabled
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadLogs()
      }, 30000) // Refresh every 30 seconds

      return () => {
        clearInterval(interval)
      }
    }
    return undefined
  }, [integrationId, limit, autoRefresh, loadLogs])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case 'failed':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'timeout':
        return <AlertCircle className="h-4 w-4 text-amber-600" />
      case 'started':
        return <Clock className="h-4 w-4 text-blue-600 animate-pulse" />
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getDirectionIcon = (direction: string) => {
    return direction === 'outgoing' ? (
      <ArrowUpFromLine className="h-4 w-4 text-blue-600" />
    ) : (
      <ArrowDownToLine className="h-4 w-4 text-purple-600" />
    )
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      success: 'default',
      failed: 'destructive',
      error: 'destructive',
      timeout: 'secondary',
      started: 'outline',
    }

    return (
      <Badge variant={variants[status] || 'outline'} className="text-xs">
        {status}
      </Badge>
    )
  }

  const getActivityTypeLabel = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const handleViewDetails = (log: ActivityLog) => {
    setSelectedLog(log)
    setDetailsOpen(true)
  }

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Direction', 'Type', 'Method', 'Endpoint', 'Status', 'Response Time (ms)', 'Error'],
      ...logs.map(log => [
        new Date(log.created_at).toISOString(),
        log.direction,
        log.activity_type,
        log.method || '',
        log.endpoint || '',
        log.status,
        log.response_time_ms?.toString() || '',
        log.error_message || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `integration-activity-${integrationId}-${new Date().toISOString()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Integration Activity Log</CardTitle>
              <CardDescription>
                All integration activity (outgoing calls & incoming webhooks)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {/* Filters */}
              <Button
                variant={filterDirection === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterDirection('all')}
              >
                All
              </Button>
              <Button
                variant={filterDirection === 'outgoing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterDirection('outgoing')}
              >
                <ArrowUpFromLine className="h-4 w-4 mr-1" />
                Outgoing
              </Button>
              <Button
                variant={filterDirection === 'incoming' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterDirection('incoming')}
              >
                <ArrowDownToLine className="h-4 w-4 mr-1" />
                Incoming
              </Button>
              
              {/* Export */}
              <Button
                variant="ghost"
                size="sm"
                onClick={exportLogs}
                disabled={logs.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>

              {/* Refresh */}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadLogs}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 mt-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              All Status
            </Button>
            <Button
              variant={filterStatus === 'success' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('success')}
            >
              Success
            </Button>
            <Button
              variant={filterStatus === 'failed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('failed')}
            >
              Failed
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No activity logs yet</p>
                <p className="text-sm">Integration activity will appear here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleViewDetails(log)}
                  >
                    {/* Direction Icon */}
                    <div className="mt-1">
                      {getDirectionIcon(log.direction)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {getActivityTypeLabel(log.activity_type)}
                        </span>
                        {getStatusBadge(log.status)}
                        {log.method && (
                          <Badge variant="outline" className="text-xs">
                            {log.method}
                          </Badge>
                        )}
                        {log.response_time_ms && (
                          <span className="text-xs text-muted-foreground">
                            {log.response_time_ms}ms
                          </span>
                        )}
                      </div>

                      {/* Endpoint */}
                      {log.endpoint && (
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          {log.endpoint}
                        </p>
                      )}

                      {/* Response Status */}
                      {log.response_status && (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono ${
                            log.response_status >= 200 && log.response_status < 300
                              ? 'text-green-600'
                              : log.response_status >= 400
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                          }`}>
                            HTTP {log.response_status}
                          </span>
                        </div>
                      )}

                      {/* Error Message */}
                      {log.error_message && (
                        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                          {log.error_message}
                        </p>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        {' • '}
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                    </div>

                    {/* Status Icon */}
                    <div className="mt-1">
                      {getStatusIcon(log.status)}
                    </div>

                    {/* Details Link */}
                    <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Activity Details</DialogTitle>
            <DialogDescription>
              Complete information about this integration activity
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4">
                {/* Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Direction</label>
                    <div className="flex items-center gap-2 mt-1">
                      {getDirectionIcon(selectedLog.direction)}
                      <span className="capitalize">{selectedLog.direction}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <p className="mt-1">{getActivityTypeLabel(selectedLog.activity_type)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                    <p className="mt-1 text-sm">{new Date(selectedLog.created_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Request Info */}
                {(selectedLog.method || selectedLog.endpoint) && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Request</h4>
                    {selectedLog.method && (
                      <div>
                        <label className="text-sm text-muted-foreground">Method</label>
                        <p className="font-mono text-sm">{selectedLog.method}</p>
                      </div>
                    )}
                    {selectedLog.endpoint && (
                      <div>
                        <label className="text-sm text-muted-foreground">Endpoint</label>
                        <p className="font-mono text-sm break-all">{selectedLog.endpoint}</p>
                      </div>
                    )}
                    {selectedLog.request_body && (
                      <div>
                        <label className="text-sm text-muted-foreground">Request Body</label>
                        <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.request_body, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Response Info */}
                {(selectedLog.response_status || selectedLog.response_body) && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Response</h4>
                    {selectedLog.response_status && (
                      <div>
                        <label className="text-sm text-muted-foreground">Status Code</label>
                        <p className="font-mono text-sm">HTTP {selectedLog.response_status}</p>
                      </div>
                    )}
                    {selectedLog.response_time_ms && (
                      <div>
                        <label className="text-sm text-muted-foreground">Response Time</label>
                        <p className="text-sm">{selectedLog.response_time_ms}ms</p>
                      </div>
                    )}
                    {selectedLog.response_body && (
                      <div>
                        <label className="text-sm text-muted-foreground">Response Body</label>
                        <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                          {JSON.stringify(selectedLog.response_body, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Info */}
                {(selectedLog.error_message || selectedLog.error_code) && (
                  <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <h4 className="font-medium text-red-600">Error Details</h4>
                    {selectedLog.error_code && (
                      <div>
                        <label className="text-sm text-red-600/80">Error Code</label>
                        <p className="font-mono text-sm text-red-600">{selectedLog.error_code}</p>
                      </div>
                    )}
                    {selectedLog.error_message && (
                      <div>
                        <label className="text-sm text-red-600/80">Message</label>
                        <p className="text-sm text-red-600">{selectedLog.error_message}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Metadata */}
                {selectedLog.metadata && Object.keys(selectedLog.metadata as object).length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Metadata</label>
                    <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  {selectedLog.ip_address && (
                    <div>
                      <label className="text-sm text-muted-foreground">IP Address</label>
                      <p className="text-sm font-mono">{selectedLog.ip_address}</p>
                    </div>
                  )}
                  {selectedLog.user_agent && (
                    <div>
                      <label className="text-sm text-muted-foreground">User Agent</label>
                      <p className="text-sm font-mono truncate">{selectedLog.user_agent}</p>
                    </div>
                  )}
                  {selectedLog.completed_at && (
                    <div>
                      <label className="text-sm text-muted-foreground">Completed At</label>
                      <p className="text-sm">{new Date(selectedLog.completed_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
