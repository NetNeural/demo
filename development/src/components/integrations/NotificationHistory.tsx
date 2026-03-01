'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Download,
  RotateCcw,
  Mail,
  MessageSquare,
  Webhook,
  Phone,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { integrationService } from '@/services/integration.service'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { toast } from 'sonner'
import type { Database } from '@/types/supabase'

type ActivityLog =
  Database['public']['Tables']['integration_activity_log']['Row']

type NotificationType = 'all' | 'email' | 'slack' | 'webhook' | 'sms'
type StatusFilter = 'all' | 'success' | 'failed' | 'started'

interface NotificationEntry extends ActivityLog {
  device_integrations?: {
    name: string
    integration_type: string
  } | null
}

interface Props {
  organizationId: string
}

const PAGE_SIZE = 25

const NOTIFICATION_TYPE_ICONS: Record<string, React.ReactNode> = {
  notification_email: <Mail className="h-4 w-4 text-blue-600" />,
  notification_slack: <MessageSquare className="h-4 w-4 text-purple-600" />,
  notification_webhook: <Webhook className="h-4 w-4 text-orange-600" />,
  notification_sms: <Phone className="h-4 w-4 text-green-600" />,
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  notification_email: 'Email',
  notification_slack: 'Slack',
  notification_webhook: 'Webhook',
  notification_sms: 'SMS',
}

function getDeliveryBadge(status: string) {
  switch (status) {
    case 'success':
      return (
        <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200">
          <CheckCircle2 className="h-3 w-3" />
          Delivered
        </Badge>
      )
    case 'started':
      return (
        <Badge className="gap-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      )
    case 'failed':
    case 'error':
      return (
        <Badge className="gap-1 bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    case 'timeout':
      return (
        <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900 dark:text-amber-200">
          <AlertCircle className="h-3 w-3" />
          Timeout
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {status}
        </Badge>
      )
  }
}

export function NotificationHistory({ organizationId }: Props) {
  const { fmt } = useDateFormatter()
  const [notifications, setNotifications] = useState<NotificationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [typeFilter, setTypeFilter] = useState<NotificationType>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationEntry | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const result = await integrationService.getNotificationLog(
        organizationId,
        {
          type: typeFilter,
          status: statusFilter,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }
      )
      setNotifications(result.data as NotificationEntry[])
      setTotalCount(result.count)
    } catch (error) {
      console.error('[NotificationHistory] Failed to load:', error)
      toast.error('Failed to load notification history')
    } finally {
      setLoading(false)
    }
  }, [organizationId, typeFilter, statusFilter, page])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [typeFilter, statusFilter])

  const handleRetry = async (entry: NotificationEntry) => {
    setRetrying(entry.id)
    try {
      await integrationService.retryNotification(entry.id, organizationId)
      toast.success('Notification resent successfully')
      loadNotifications()
    } catch (error) {
      console.error('[NotificationHistory] Retry failed:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to retry notification'
      )
    } finally {
      setRetrying(null)
    }
  }

  const handleViewDetails = (entry: NotificationEntry) => {
    setSelectedNotification(entry)
    setDetailsOpen(true)
  }

  const exportCsv = () => {
    const csv = [
      [
        'Timestamp',
        'Type',
        'Integration',
        'Recipient',
        'Subject',
        'Status',
        'Response Code',
        'Response Time (ms)',
        'Error',
      ],
      ...notifications.map((n) => {
        const meta = (n.metadata || {}) as Record<string, unknown>
        return [
          new Date(n.created_at).toISOString(),
          NOTIFICATION_TYPE_LABELS[n.activity_type] || n.activity_type,
          n.device_integrations?.name || n.integration_id,
          Array.isArray(meta.recipients)
            ? (meta.recipients as string[]).join('; ')
            : (meta.channel as string) || '',
          (meta.subject as string) || '',
          n.status,
          n.response_status?.toString() || '',
          n.response_time_ms?.toString() || '',
          n.error_message || '',
        ]
      }),
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `notification-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const getRecipientDisplay = (entry: NotificationEntry) => {
    const meta = (entry.metadata || {}) as Record<string, unknown>
    if (Array.isArray(meta.recipients) && (meta.recipients as string[]).length > 0) {
      const recipients = meta.recipients as string[]
      return recipients.length === 1
        ? recipients[0]
        : `${recipients[0]} +${recipients.length - 1}`
    }
    if (meta.channel) return `#${meta.channel}`
    if (meta.webhook_url) return new URL(meta.webhook_url as string).hostname
    if (entry.endpoint) {
      try {
        return new URL(entry.endpoint).hostname
      } catch {
        return entry.endpoint
      }
    }
    return '—'
  }

  const getSubjectDisplay = (entry: NotificationEntry) => {
    const meta = (entry.metadata || {}) as Record<string, unknown>
    return (meta.subject as string) || (meta.message as string) || '—'
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Notification History
              </CardTitle>
              <CardDescription>
                All outbound notifications across integrations — email, Slack,
                SMS, and webhooks
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportCsv}
                disabled={notifications.length === 0}
              >
                <Download className="mr-1 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadNotifications}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as NotificationType)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="slack">Slack</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Delivered</SelectItem>
                <SelectItem value="started">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {totalCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {totalCount} notification{totalCount !== 1 ? 's' : ''} found
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Send className="mb-4 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">No notifications yet</p>
              <p className="text-sm">
                Outbound notification activity will appear here
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Subject / Message</TableHead>
                      <TableHead className="w-[120px]">Status</TableHead>
                      <TableHead className="w-[100px]">Response</TableHead>
                      <TableHead className="w-[160px]">Sent</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((entry) => (
                      <TableRow
                        key={entry.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewDetails(entry)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {NOTIFICATION_TYPE_ICONS[entry.activity_type] || (
                              <Send className="h-4 w-4" />
                            )}
                            <span className="text-sm">
                              {NOTIFICATION_TYPE_LABELS[entry.activity_type] ||
                                entry.activity_type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate font-mono text-sm">
                          {getRecipientDisplay(entry)}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-sm">
                          {getSubjectDisplay(entry)}
                        </TableCell>
                        <TableCell>{getDeliveryBadge(entry.status)}</TableCell>
                        <TableCell>
                          {entry.response_status ? (
                            <span
                              className={`font-mono text-sm ${
                                entry.response_status >= 200 &&
                                entry.response_status < 300
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {entry.response_status}
                            </span>
                          ) : entry.response_time_ms ? (
                            <span className="text-sm text-muted-foreground">
                              {entry.response_time_ms}ms
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fmt.timeAgo(entry.created_at)}
                        </TableCell>
                        <TableCell>
                          {['failed', 'error', 'timeout'].includes(
                            entry.status
                          ) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRetry(entry)
                              }}
                              disabled={retrying === entry.id}
                              title="Retry notification"
                            >
                              {retrying === entry.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page >= totalPages - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[80vh] max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification &&
                NOTIFICATION_TYPE_ICONS[selectedNotification.activity_type]}
              Notification Details
            </DialogTitle>
            <DialogDescription>
              Complete details about this notification
            </DialogDescription>
          </DialogHeader>

          {selectedNotification && (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4">
                {/* Overview Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Type
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      {
                        NOTIFICATION_TYPE_ICONS[
                          selectedNotification.activity_type
                        ]
                      }
                      <span>
                        {NOTIFICATION_TYPE_LABELS[
                          selectedNotification.activity_type
                        ] || selectedNotification.activity_type}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Delivery Status
                    </label>
                    <div className="mt-1">
                      {getDeliveryBadge(selectedNotification.status)}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Recipient
                    </label>
                    <p className="mt-1 font-mono text-sm">
                      {getRecipientDisplay(selectedNotification)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Sent At
                    </label>
                    <p className="mt-1 text-sm">
                      {fmt.dateTime(selectedNotification.created_at)}
                    </p>
                  </div>
                  {selectedNotification.device_integrations && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Integration
                      </label>
                      <p className="mt-1 text-sm">
                        {selectedNotification.device_integrations.name}
                      </p>
                    </div>
                  )}
                  {selectedNotification.response_time_ms && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Response Time
                      </label>
                      <p className="mt-1 text-sm">
                        {selectedNotification.response_time_ms}ms
                      </p>
                    </div>
                  )}
                </div>

                {/* Subject / Message */}
                {(() => {
                  const meta = (selectedNotification.metadata || {}) as Record<
                    string,
                    unknown
                  >
                  return (
                    <>
                      {meta.subject && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Subject
                          </label>
                          <p className="mt-1 text-sm">
                            {meta.subject as string}
                          </p>
                        </div>
                      )}
                      {meta.message && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Message
                          </label>
                          <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                            {meta.message as string}
                          </p>
                        </div>
                      )}
                      {meta.recipients && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">
                            Recipients
                          </label>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {(meta.recipients as string[]).map(
                              (r: string, i: number) => (
                                <Badge key={i} variant="outline">
                                  {r}
                                </Badge>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                {/* Response Info */}
                {(selectedNotification.response_status ||
                  selectedNotification.response_body) && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Response</h4>
                    {selectedNotification.response_status && (
                      <div>
                        <label className="text-sm text-muted-foreground">
                          Status Code
                        </label>
                        <p className="font-mono text-sm">
                          HTTP {selectedNotification.response_status}
                        </p>
                      </div>
                    )}
                    {selectedNotification.response_body && (
                      <div>
                        <label className="text-sm text-muted-foreground">
                          Response Body
                        </label>
                        <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
                          {JSON.stringify(
                            selectedNotification.response_body,
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Info */}
                {(selectedNotification.error_message ||
                  selectedNotification.error_code) && (
                  <div className="space-y-2 rounded-lg bg-red-50 p-3 dark:bg-red-950">
                    <h4 className="font-medium text-red-600">Error Details</h4>
                    {selectedNotification.error_code && (
                      <div>
                        <label className="text-sm text-red-600/80">
                          Error Code
                        </label>
                        <p className="font-mono text-sm text-red-600">
                          {selectedNotification.error_code}
                        </p>
                      </div>
                    )}
                    {selectedNotification.error_message && (
                      <div>
                        <label className="text-sm text-red-600/80">
                          Message
                        </label>
                        <p className="text-sm text-red-600">
                          {selectedNotification.error_message}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Metadata */}
                {selectedNotification.metadata &&
                  Object.keys(selectedNotification.metadata as object).length >
                    0 && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Full Metadata
                      </label>
                      <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
                        {JSON.stringify(
                          selectedNotification.metadata,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}

                {/* Completed At */}
                {selectedNotification.completed_at && (
                  <div className="border-t pt-4">
                    <label className="text-sm text-muted-foreground">
                      Completed At
                    </label>
                    <p className="text-sm">
                      {fmt.dateTime(selectedNotification.completed_at)}
                    </p>
                  </div>
                )}

                {/* Retry Button */}
                {['failed', 'error', 'timeout'].includes(
                  selectedNotification.status
                ) && (
                  <div className="border-t pt-4">
                    <Button
                      onClick={() => {
                        handleRetry(selectedNotification)
                        setDetailsOpen(false)
                      }}
                      disabled={retrying === selectedNotification.id}
                      variant="outline"
                      className="gap-2"
                    >
                      {retrying === selectedNotification.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Retry Notification
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
