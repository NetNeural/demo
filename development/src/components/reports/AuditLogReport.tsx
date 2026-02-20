'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { AIReportSummary } from '@/components/reports/AIReportSummary'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { toast } from 'sonner'
import { format, subDays } from 'date-fns'
import {
  CalendarIcon,
  Download,
  Filter,
  Search,
  Clock,
  User,
  FileText,
  Eye,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuditLogEntry {
  id: string
  user_id?: string | null
  user_email?: string | null
  organization_id: string | null
  action_category: string
  action_type: string
  resource_type?: string | null
  resource_id?: string | null
  resource_name?: string | null
  method?: string | null
  endpoint?: string | null
  changes?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
    [key: string]: unknown
  } | null
  metadata?: Record<string, unknown> | null
  status: 'success' | 'failed' | 'error' | 'pending'
  error_message?: string | null
  created_at: string
  ip_address?: string | null
  user_agent?: string | null
  session_id?: string | null
}

interface StatsData {
  totalActions: number
  successfulActions: number
  failedActions: number
  uniqueUsers: number
  criticalActions: number
}

type DateRangePreset = 'today' | '24h' | '7d' | '30d' | 'custom'

const ACTION_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'authentication', label: 'Authentication' },
  { value: 'device_management', label: 'Device Management' },
  { value: 'integration_management', label: 'Integration Management' },
  { value: 'alert_management', label: 'Alert Management' },
  { value: 'user_management', label: 'User Management' },
  { value: 'organization_management', label: 'Organization Management' },
  { value: 'configuration', label: 'Configuration' },
  { value: 'data_import_export', label: 'Data Import/Export' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'mqtt', label: 'MQTT' },
  { value: 'notification', label: 'Notification' },
  { value: 'other', label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'error', label: 'Error' },
  { value: 'pending', label: 'Pending' },
]

const ITEMS_PER_PAGE = 100

export function AuditLogReport() {
  const { currentOrganization } = useOrganization()
  const { user: currentUser } = useUser()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<StatsData>({
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    uniqueUsers: 0,
    criticalActions: 0,
  })

  // Filters
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('7d')
  const [startDate, setStartDate] = useState<Date | undefined>(
    subDays(new Date(), 7)
  )
  const [endDate, setEndDate] = useState<Date | undefined>(new Date())
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [userFilter, setUserFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // User list for filter
  const [users, setUsers] = useState<Array<{ id: string; email: string }>>([])

  // Expanded row for viewing changes
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Check if user is admin
  const isAdmin = useMemo(() => {
    if (!currentUser) return false
    return (
      currentUser.role === 'super_admin' || currentUser.role === 'org_owner'
    )
  }, [currentUser])

  // Fetch users for filter dropdown
  const fetchUsers = useCallback(async () => {
    if (!currentOrganization) return

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('organization_id', currentOrganization.id)
        .order('email')

      if (error) {
        console.error('[AuditLogReport] Error fetching users:', error)
        return
      }

      if (data) {
        setUsers(data)
      }
    } catch (error) {
      console.error('[AuditLogReport] Error fetching users:', error)
    }
  }, [currentOrganization])

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    if (!currentOrganization) {
      console.log('[AuditLogReport] No organization selected')
      setLogs([])
      setLoading(false)
      return
    }

    if (!isAdmin) {
      toast.error('Access Denied', {
        description: 'Only administrators can view audit logs',
      })
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log(
        '[AuditLogReport] Fetching audit logs for org:',
        currentOrganization.id
      )

      const supabase = createClient()

      let query = supabase
        .from('user_audit_log')
        .select('*')
        .eq('organization_id', currentOrganization.id)

      // Apply date range filter
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString())
      }
      if (endDate) {
        const endOfDay = new Date(endDate)
        endOfDay.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endOfDay.toISOString())
      }

      // Apply category filter
      if (categoryFilter !== 'all') {
        query = query.eq('action_category', categoryFilter)
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Apply user filter
      if (userFilter !== 'all') {
        query = query.eq('user_id', userFilter)
      }

      // Apply search query
      if (searchQuery.trim()) {
        const searchTerm = searchQuery.trim()
        // Search in action_type, resource_type, resource_name, resource_id
        query = query.or(
          `action_type.ilike.%${searchTerm}%,resource_type.ilike.%${searchTerm}%,resource_name.ilike.%${searchTerm}%,resource_id.ilike.%${searchTerm}%`
        )
      }

      // Order by most recent first
      query = query.order('created_at', { ascending: false })

      const { data, error } = await query

      if (error) {
        console.error('[AuditLogReport] Error fetching audit logs:', error)
        toast.error('Error loading audit logs', {
          description: error.message,
        })
        setLogs([])
        return
      }

      console.log('[AuditLogReport] Fetched logs:', data?.length || 0)
      setLogs((data || []) as AuditLogEntry[])

      // Calculate statistics
      if (data && data.length > 0) {
        const successCount = data.filter(
          (log) => log.status === 'success'
        ).length
        const failedCount = data.filter(
          (log) => log.status === 'failed' || log.status === 'error'
        ).length
        const uniqueUserIds = new Set(
          data.filter((log) => log.user_id).map((log) => log.user_id)
        )
        const criticalActionTypes = [
          'device_delete',
          'integration_delete',
          'user_delete',
          'organization_delete',
          'settings_update',
        ]
        const criticalCount = data.filter((log) =>
          criticalActionTypes.some((type) => log.action_type.includes(type))
        ).length

        setStats({
          totalActions: data.length,
          successfulActions: successCount,
          failedActions: failedCount,
          uniqueUsers: uniqueUserIds.size,
          criticalActions: criticalCount,
        })
      } else {
        setStats({
          totalActions: 0,
          successfulActions: 0,
          failedActions: 0,
          uniqueUsers: 0,
          criticalActions: 0,
        })
      }
    } catch (error) {
      console.error('[AuditLogReport] Error:', error)
      toast.error('Error loading audit logs')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [
    currentOrganization,
    isAdmin,
    startDate,
    endDate,
    categoryFilter,
    statusFilter,
    userFilter,
    searchQuery,
  ])

  // Load data on mount and when filters change
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Handle date range preset change
  const handleDateRangePresetChange = (preset: DateRangePreset) => {
    setDateRangePreset(preset)
    const now = new Date()

    switch (preset) {
      case 'today':
        setStartDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        setEndDate(now)
        break
      case '24h':
        setStartDate(subDays(now, 1))
        setEndDate(now)
        break
      case '7d':
        setStartDate(subDays(now, 7))
        setEndDate(now)
        break
      case '30d':
        setStartDate(subDays(now, 30))
        setEndDate(now)
        break
      case 'custom':
        // User will select custom dates
        break
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    if (logs.length === 0) {
      toast.error('No data to export')
      return
    }

    const headers = [
      'Timestamp',
      'User Email',
      'Action Category',
      'Action Type',
      'Resource Type',
      'Resource Name',
      'Resource ID',
      'Status',
      'Method',
      'Endpoint',
      'IP Address',
      'Error Message',
    ]

    const csvData = logs.map((log) => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user_email || 'System',
      log.action_category,
      log.action_type,
      log.resource_type || '',
      log.resource_name || '',
      log.resource_id || '',
      log.status,
      log.method || '',
      log.endpoint || '',
      log.ip_address || '',
      log.error_message || '',
    ])

    const csvContent = [
      headers.join(','),
      ...csvData.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute(
      'download',
      `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`
    )
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('Audit log exported successfully')
  }

  // Get severity badge for action category
  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      authentication: 'bg-blue-100 text-blue-800',
      device_management: 'bg-green-100 text-green-800',
      integration_management: 'bg-purple-100 text-purple-800',
      alert_management: 'bg-orange-100 text-orange-800',
      user_management: 'bg-yellow-100 text-yellow-800',
      organization_management: 'bg-red-100 text-red-800',
      configuration: 'bg-pink-100 text-pink-800',
      data_import_export: 'bg-indigo-100 text-indigo-800',
      webhook: 'bg-cyan-100 text-cyan-800',
      mqtt: 'bg-teal-100 text-teal-800',
      notification: 'bg-lime-100 text-lime-800',
      other: 'bg-gray-100 text-gray-800',
    }

    return (
      <Badge className={cn('font-medium', colors[category] || colors.other)}>
        {category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
      </Badge>
    )
  }

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Success
          </Badge>
        )
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        )
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-800">
            <AlertCircle className="mr-1 h-3 w-3" />
            Error
          </Badge>
        )
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  // Pagination
  const totalPages = Math.ceil(logs.length / ITEMS_PER_PAGE)
  const paginatedLogs = logs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  // Check admin access
  if (!isAdmin && !loading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-red-500" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              Only administrators can view audit logs. This feature is
              restricted to super admins and organization owners.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <OrganizationLogo
          settings={currentOrganization?.settings}
          name={currentOrganization?.name || 'NetNeural'}
          size="xl"
        />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            User Activity Audit Log
          </h2>
          <p className="text-muted-foreground">
            View and track all user actions in the system for compliance and
            troubleshooting
          </p>
        </div>
      </div>

      {/* AI Report Summary */}
      {logs.length > 0 && currentOrganization && (
        <AIReportSummary
          reportType="audit-log"
          reportData={{
            dateRange:
              dateRangePreset === '24h'
                ? 'Last 24 hours'
                : dateRangePreset === '7d'
                  ? 'Last 7 days'
                  : dateRangePreset === '30d'
                    ? 'Last 30 days'
                    : startDate && endDate
                      ? `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`
                      : 'Custom',
            totalRecords: stats.totalActions,
            metadata: {
              successfulActions: stats.successfulActions,
              failedActions: stats.failedActions,
              uniqueUsers: stats.uniqueUsers,
              criticalActions: stats.criticalActions,
              successRate:
                stats.totalActions > 0
                  ? (
                      (stats.successfulActions / stats.totalActions) *
                      100
                    ).toFixed(1)
                  : '0',
            },
          }}
          organizationId={currentOrganization.id}
        />
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Actions</CardDescription>
            <CardTitle className="text-3xl">{stats.totalActions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {stats.successfulActions}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {stats.failedActions}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Unique Users</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {stats.uniqueUsers}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Critical Actions</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {stats.criticalActions}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range Presets */}
          <div className="flex flex-wrap gap-2">
            {(['24h', '7d', '30d', 'custom'] as DateRangePreset[]).map(
              (preset) => (
                <Button
                  key={preset}
                  variant={dateRangePreset === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDateRangePresetChange(preset)}
                >
                  {preset === '24h' && 'Last 24 Hours'}
                  {preset === '7d' && 'Last 7 Days'}
                  {preset === '30d' && 'Last 30 Days'}
                  {preset === 'custom' && 'Custom Range'}
                </Button>
              )
            )}
          </div>

          {/* Custom Date Range */}
          {dateRangePreset === 'custom' && (
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium">
                  Start Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium">
                  End Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Filter Selects */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Action Category
              </label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">User</label>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="mb-2 block text-sm font-medium">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Search by action type, resource name, or resource ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={fetchLogs} disabled={loading}>
              {loading ? (
                <span className="mr-2">
                  <LoadingSpinner />
                </span>
              ) : null}
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={logs.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({logs.length} entries)</CardTitle>
          <CardDescription>
            Showing {paginatedLogs.length} of {logs.length} audit log entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No audit log entries found</p>
              <p className="text-muted-foreground">
                Try adjusting your filters
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => (
                      <>
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(
                              new Date(log.created_at),
                              'MMM dd, yyyy HH:mm:ss'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">
                                {log.user_email || 'System'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getCategoryBadge(log.action_category)}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">
                              {log.action_type}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.resource_type && (
                              <div>
                                <div className="font-medium">
                                  {log.resource_name || log.resource_id}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {log.resource_type}
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.ip_address || '-'}
                          </TableCell>
                          <TableCell>
                            {log.changes &&
                              Object.keys(log.changes).length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setExpandedRow(
                                      expandedRow === log.id ? null : log.id
                                    )
                                  }
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                          </TableCell>
                        </TableRow>
                        {expandedRow === log.id && log.changes && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/50">
                              <div className="space-y-2 p-4">
                                <h4 className="mb-2 font-semibold">Changes</h4>
                                {log.changes.before && (
                                  <div>
                                    <div className="mb-1 text-sm font-medium text-red-600">
                                      Before:
                                    </div>
                                    <pre className="overflow-x-auto rounded bg-white p-2 text-xs">
                                      {JSON.stringify(
                                        log.changes.before,
                                        null,
                                        2
                                      )}
                                    </pre>
                                  </div>
                                )}
                                {log.changes.after && (
                                  <div>
                                    <div className="mb-1 text-sm font-medium text-green-600">
                                      After:
                                    </div>
                                    <pre className="overflow-x-auto rounded bg-white p-2 text-xs">
                                      {JSON.stringify(
                                        log.changes.after,
                                        null,
                                        2
                                      )}
                                    </pre>
                                  </div>
                                )}
                                {log.error_message && (
                                  <div>
                                    <div className="mb-1 text-sm font-medium text-red-600">
                                      Error:
                                    </div>
                                    <div className="rounded bg-red-50 p-2 text-sm text-red-800">
                                      {log.error_message}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
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
    </div>
  )
}
