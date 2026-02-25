'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { AIReportSummary } from '@/components/reports/AIReportSummary'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { toast } from 'sonner'
import {
  format,
  subDays,
  formatDistanceToNow,
  eachHourOfInterval,
  eachDayOfInterval,
  startOfHour,
  startOfDay,
} from 'date-fns'
import {
  CalendarIcon,
  Download,
  Filter,
  Search,
  Clock,
  User,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
  Send,
  RotateCcw,
  Bot,
  BarChart3,
  X,
  Minus,
  Plus,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  SendReportDialog,
  type ReportPayload,
} from '@/components/reports/SendReportDialog'

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

/** Humanize action_type for display */
const humanizeAction = (action: string): string => {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'error', label: 'Error' },
  { value: 'pending', label: 'Pending' },
]

const ITEMS_PER_PAGE = 50

const CRITICAL_ACTION_TYPES = [
  'device_delete',
  'integration_delete',
  'user_delete',
  'member_removed',
  'organization_delete',
  'settings_update',
  'settings_updated',
]

/** useDebounce hook: delays value updates until user stops typing */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

/** Compute object diff — returns only keys that changed between before/after */
function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): { key: string; oldVal: unknown; newVal: unknown }[] {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
  const diffs: { key: string; oldVal: unknown; newVal: unknown }[] = []
  const skipKeys = new Set(['updated_at', 'created_at'])
  for (const key of allKeys) {
    if (skipKeys.has(key)) continue
    const oldVal = before[key]
    const newVal = after[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({ key, oldVal, newVal })
    }
  }
  return diffs
}

/** Format a value for display in the diff view */
function formatDiffValue(val: unknown): string {
  if (val === null || val === undefined) return '(empty)'
  if (typeof val === 'object') return JSON.stringify(val, null, 2)
  return String(val)
}

export function AuditLogReport() {
  const { currentOrganization, userRole, isLoading: isLoadingOrg } = useOrganization()
  const { user: currentUser } = useUser()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [totalCount, setTotalCount] = useState(0)
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
  const [hideSystemActions, setHideSystemActions] = useState<boolean>(true)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // User list for filter
  const [users, setUsers] = useState<Array<{ id: string; email: string }>>([])

  // Expanded row for viewing changes
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)

  // Debounced search (400ms) — fires DB query only after user stops typing
  const debouncedSearch = useDebounce(searchQuery, 400)

  // Realtime subscription ref
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  // Check if user is admin - check both global and organization roles
  const isAdmin = useMemo(() => {
    if (!currentUser) return false
    // Super admin always has access
    if (currentUser.role === 'super_admin') return true
    // Check global org owner/admin roles
    if (currentUser.role === 'org_owner' || currentUser.role === 'org_admin')
      return true
    // Check organization-specific admin/owner roles
    if (userRole && ['admin', 'owner'].includes(userRole)) return true
    return false
  }, [currentUser, userRole])

  // Whether we're still resolving the user's admin status
  const isResolvingAdmin = !currentUser || isLoadingOrg

  // Fetch users for filter dropdown — use organization_members + auth.users
  const fetchUsers = useCallback(async () => {
    if (!currentOrganization) return

    try {
      const supabase = createClient()
      // Get all org members with their emails
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', currentOrganization.id)

      if (error) {
        console.error('[AuditLogReport] Error fetching members:', error)
        return
      }

      if (data && data.length > 0) {
        // Now get user details for these member IDs
        const userIds = data.map((m) => m.user_id).filter(Boolean)
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email')
          .in('id', userIds)
          .order('email')

        if (userError) {
          console.error('[AuditLogReport] Error fetching user details:', userError)
          return
        }

        if (userData) {
          setUsers(userData)
        }
      }
    } catch (error) {
      console.error('[AuditLogReport] Error fetching users:', error)
    }
  }, [currentOrganization])

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    if (!currentOrganization) {
      setLogs([])
      setLoading(false)
      return
    }

    // Don't evaluate access until user/org context is fully loaded
    if (isResolvingAdmin) {
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

      const supabase = createClient()

      let query = supabase
        .from('user_audit_log')
        .select('*', { count: 'exact' })
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

      // Hide system/automated actions (no user_id)
      if (hideSystemActions) {
        query = query.not('user_id', 'is', null)
      }

      // Apply search query (debounced)
      if (debouncedSearch.trim()) {
        const searchTerm = debouncedSearch.trim()
        query = query.or(
          `action_type.ilike.%${searchTerm}%,resource_type.ilike.%${searchTerm}%,resource_name.ilike.%${searchTerm}%,resource_id.ilike.%${searchTerm}%`
        )
      }

      // Server-side pagination
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('[AuditLogReport] Error fetching audit logs:', error)
        toast.error('Error loading audit logs', {
          description: error.message,
        })
        setLogs([])
        return
      }

      setLogs((data || []) as AuditLogEntry[])
      setTotalCount(count || data?.length || 0)

      // Fetch lightweight stats for the full filtered set (all pages)
      const statsBuilder = supabase
        .from('user_audit_log')
        .select('status, user_id, action_type')
        .eq('organization_id', currentOrganization.id)

      if (startDate) statsBuilder.gte('created_at', startDate.toISOString())
      if (endDate) {
        const eod = new Date(endDate)
        eod.setHours(23, 59, 59, 999)
        statsBuilder.lte('created_at', eod.toISOString())
      }
      if (categoryFilter !== 'all') statsBuilder.eq('action_category', categoryFilter)
      if (statusFilter !== 'all') statsBuilder.eq('status', statusFilter)
      if (userFilter !== 'all') statsBuilder.eq('user_id', userFilter)
      if (hideSystemActions) statsBuilder.not('user_id', 'is', null)
      if (debouncedSearch.trim()) {
        const s = debouncedSearch.trim()
        statsBuilder.or(
          `action_type.ilike.%${s}%,resource_type.ilike.%${s}%,resource_name.ilike.%${s}%,resource_id.ilike.%${s}%`
        )
      }

      const { data: statsData } = await statsBuilder

      if (statsData && statsData.length > 0) {
        const successCount = statsData.filter((l) => l.status === 'success').length
        const failedCount = statsData.filter((l) => l.status === 'failed' || l.status === 'error').length
        const uniqueUserIds = new Set(statsData.filter((l) => l.user_id).map((l) => l.user_id))
        const criticalCount = statsData.filter((l) =>
          CRITICAL_ACTION_TYPES.some((type) => l.action_type.includes(type))
        ).length

        setStats({
          totalActions: count || statsData.length,
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
    isResolvingAdmin,
    startDate,
    endDate,
    categoryFilter,
    statusFilter,
    userFilter,
    debouncedSearch,
    hideSystemActions,
    currentPage,
  ])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, categoryFilter, statusFilter, userFilter, hideSystemActions, startDate, endDate])

  // Load data on mount and when filters change
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Realtime subscription for new audit log entries
  useEffect(() => {
    if (!currentOrganization || !isAdmin || isResolvingAdmin) return

    const supabase = createClient()
    const channel = supabase
      .channel(`audit-log-${currentOrganization.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_audit_log',
          filter: `organization_id=eq.${currentOrganization.id}`,
        },
        (payload) => {
          const newEntry = payload.new as AuditLogEntry
          // Only prepend if on page 1 and not filtered out by system toggle
          if (currentPage === 1) {
            if (hideSystemActions && !newEntry.user_id) return
            setLogs((prev) => {
              if (prev.some((l) => l.id === newEntry.id)) return prev
              return [newEntry, ...prev].slice(0, ITEMS_PER_PAGE)
            })
            setTotalCount((c) => c + 1)
            setStats((prev) => ({
              ...prev,
              totalActions: prev.totalActions + 1,
              successfulActions: prev.successfulActions + (newEntry.status === 'success' ? 1 : 0),
              failedActions: prev.failedActions + (newEntry.status === 'failed' || newEntry.status === 'error' ? 1 : 0),
              criticalActions: prev.criticalActions + (CRITICAL_ACTION_TYPES.some((t) => newEntry.action_type.includes(t)) ? 1 : 0),
            }))
          }
        }
      )
      .subscribe()

    realtimeChannelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      realtimeChannelRef.current = null
    }
  }, [currentOrganization, isAdmin, isResolvingAdmin, currentPage, hideSystemActions])

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
      `audit-log-${format(new Date(), 'yyyy-MM-dd')}-${logs.length}entries.csv`
    )
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success('Audit log exported successfully')
  }

  // Build payload for SendReportDialog
  const getReportPayload = (): ReportPayload => {
    const headers = ['Timestamp', 'User Email', 'Action Category', 'Action Type', 'Resource Type', 'Resource Name', 'Resource ID', 'Status', 'Method', 'Endpoint', 'IP Address', 'Error Message']
    const csvData = logs.map((log) => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user_email || 'System',
      log.action_category, log.action_type,
      log.resource_type || '', log.resource_name || '', log.resource_id || '',
      log.status, log.method || '', log.endpoint || '',
      log.ip_address || '', log.error_message || '',
    ])
    const csvContent = [headers.join(','), ...csvData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n')
    return {
      title: 'User Activity Audit Log',
      csvContent,
      csvFilename: `audit-log-${format(new Date(), 'yyyy-MM-dd')}-${logs.length}entries.csv`,
      smsSummary: `${stats.totalActions} actions (${stats.successfulActions} success, ${stats.failedActions} failed) by ${stats.uniqueUsers} users. ${stats.criticalActions} critical actions.`,
    }
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

  // Server-side pagination
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  // Activity timeline data — bin actions by hour or day
  const timelineData = useMemo(() => {
    if (!logs.length || !startDate || !endDate) return []
    const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const useHours = diffDays <= 2
    try {
      if (useHours) {
        const hours = eachHourOfInterval({ start: startDate, end: endDate })
        return hours.map((hour) => {
          const hourStart = startOfHour(hour)
          const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
          const count = logs.filter((l) => {
            const t = new Date(l.created_at)
            return t >= hourStart && t < hourEnd
          }).length
          const failCount = logs.filter((l) => {
            const t = new Date(l.created_at)
            return t >= hourStart && t < hourEnd && (l.status === 'failed' || l.status === 'error')
          }).length
          return { label: format(hour, 'HH:mm'), fullLabel: format(hour, 'MMM dd HH:mm'), total: count, failed: failCount }
        })
      } else {
        const days = eachDayOfInterval({ start: startDate, end: endDate })
        return days.map((day) => {
          const dayStart = startOfDay(day)
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
          const count = logs.filter((l) => {
            const t = new Date(l.created_at)
            return t >= dayStart && t < dayEnd
          }).length
          const failCount = logs.filter((l) => {
            const t = new Date(l.created_at)
            return t >= dayStart && t < dayEnd && (l.status === 'failed' || l.status === 'error')
          }).length
          return { label: format(day, 'MMM dd'), fullLabel: format(day, 'MMM dd, yyyy'), total: count, failed: failCount }
        })
      }
    } catch {
      return []
    }
  }, [logs, startDate, endDate])

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
              restricted to super admins, organization owners, and organization
              admins.
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
              dateRangePreset === 'today'
                ? 'Today'
                : dateRangePreset === '24h'
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

      {/* Statistics Cards — click to filter */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => { setCategoryFilter('all'); setStatusFilter('all') }}
        >
          <CardHeader className="pb-3">
            <CardDescription>Total Actions</CardDescription>
            <CardTitle className="text-3xl">{stats.totalActions}</CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={cn('cursor-pointer transition-shadow hover:shadow-md', statusFilter === 'success' && 'ring-2 ring-green-400')}
          onClick={() => setStatusFilter(statusFilter === 'success' ? 'all' : 'success')}
        >
          <CardHeader className="pb-3">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {stats.successfulActions}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card
          className={cn('cursor-pointer transition-shadow hover:shadow-md', statusFilter === 'failed' && 'ring-2 ring-red-400')}
          onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
        >
          <CardHeader className="pb-3">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {stats.failedActions}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => setUserFilter('all')}
        >
          <CardHeader className="pb-3">
            <CardDescription>Unique Users</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {stats.uniqueUsers}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card
          className="cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => setSearchQuery(searchQuery === 'delete' ? '' : 'delete')}
        >
          <CardHeader className="pb-3">
            <CardDescription>Critical Actions</CardDescription>
            <CardTitle className="text-3xl text-orange-600">
              {stats.criticalActions}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Activity Timeline */}
      {timelineData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Activity Timeline
            </CardTitle>
            <CardDescription>
              Action density over the selected date range (current page)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={timelineData} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const d = (payload[0] as any).payload as { fullLabel: string; total: number; failed: number }
                    return (
                      <div className="rounded border bg-white px-3 py-2 text-xs shadow-md">
                        <p className="font-medium">{d.fullLabel}</p>
                        <p className="text-muted-foreground">
                          {d.total} actions{d.failed > 0 ? ` (${d.failed} failed)` : ''}
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                  {timelineData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.failed > 0 ? '#f87171' : '#60a5fa'}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            {/* Active filter badges */}
            {(categoryFilter !== 'all' || statusFilter !== 'all' || userFilter !== 'all' || debouncedSearch.trim()) && (
              <div className="flex flex-wrap gap-1.5">
                {categoryFilter !== 'all' && (
                  <Badge variant="secondary" className="cursor-pointer gap-1 pl-2 pr-1" onClick={() => setCategoryFilter('all')}>
                    {ACTION_CATEGORIES.find((c) => c.value === categoryFilter)?.label || categoryFilter}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="cursor-pointer gap-1 pl-2 pr-1" onClick={() => setStatusFilter('all')}>
                    Status: {statusFilter}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {userFilter !== 'all' && (
                  <Badge variant="secondary" className="cursor-pointer gap-1 pl-2 pr-1" onClick={() => setUserFilter('all')}>
                    User: {users.find((u) => u.id === userFilter)?.email || 'Selected'}
                    <X className="h-3 w-3" />
                  </Badge>
                )}
                {debouncedSearch.trim() && (
                  <Badge variant="secondary" className="cursor-pointer gap-1 pl-2 pr-1" onClick={() => setSearchQuery('')}>
                    Search: &quot;{debouncedSearch.trim()}&quot;
                    <X className="h-3 w-3" />
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range Presets */}
          <div className="flex flex-wrap items-center gap-2">
            {(['today', '24h', '7d', '30d', 'custom'] as DateRangePreset[]).map(
              (preset) => (
                <Button
                  key={preset}
                  variant={dateRangePreset === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleDateRangePresetChange(preset)}
                >
                  {preset === 'today' && 'Today'}
                  {preset === '24h' && 'Last 24 Hours'}
                  {preset === '7d' && 'Last 7 Days'}
                  {preset === '30d' && 'Last 30 Days'}
                  {preset === 'custom' && 'Custom Range'}
                </Button>
              )
            )}

            <div className="ml-auto flex items-center gap-3">
              {/* System/Automated toggle */}
              <Button
                variant={hideSystemActions ? 'outline' : 'secondary'}
                size="sm"
                onClick={() => setHideSystemActions(!hideSystemActions)}
                title={hideSystemActions ? 'Show system/automated actions' : 'Hide system/automated actions'}
              >
                <Bot className="mr-1.5 h-3.5 w-3.5" />
                {hideSystemActions ? 'Show System' : 'Hide System'}
              </Button>

              {/* Clear Filters */}
              {(categoryFilter !== 'all' || statusFilter !== 'all' || userFilter !== 'all' || searchQuery.trim()) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCategoryFilter('all')
                    setStatusFilter('all')
                    setUserFilter('all')
                    setSearchQuery('')
                  }}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Clear Filters
                </Button>
              )}
            </div>
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

          {/* Search — debounced */}
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
              {searchQuery && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
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
              onClick={() => setSendDialogOpen(true)}
              disabled={logs.length === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              Send Report
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

      {/* SendReportDialog — positioned outside Card */}
      <SendReportDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        getReportPayload={getReportPayload}
      />

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log ({totalCount} entries)</CardTitle>
          <CardDescription>
            Showing {logs.length} of {totalCount} audit log entries
            {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
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
                {hideSystemActions
                  ? 'No user actions found. Try clicking "Show System" to include automated actions, or adjust your filters.'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <>
              {/* Sticky table header + scrollable body */}
              <div className="max-h-[70vh] overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <React.Fragment key={log.id}>
                        <TableRow className={cn(
                          expandedRow === log.id && 'bg-muted/30',
                          CRITICAL_ACTION_TYPES.some((t) => log.action_type.includes(t)) && 'border-l-2 border-l-orange-400'
                        )}>
                          <TableCell className="whitespace-nowrap">
                            <div>
                              <div className="text-sm">
                                {format(
                                  new Date(log.created_at),
                                  'MMM dd, yyyy HH:mm'
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {log.user_id ? (
                                <User className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Bot className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className={cn('font-medium', !log.user_id && 'italic text-muted-foreground')}>
                                {log.user_email || 'System'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getCategoryBadge(log.action_category)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {humanizeAction(log.action_type)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.resource_type && (
                              <div>
                                <div className="max-w-[200px] truncate font-medium" title={log.resource_name || log.resource_id || ''}>
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
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() =>
                                          setExpandedRow(
                                            expandedRow === log.id ? null : log.id
                                          )
                                        }
                                      >
                                        {expandedRow === log.id ? (
                                          <Minus className="h-4 w-4" />
                                        ) : (
                                          <Plus className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {expandedRow === log.id ? 'Collapse changes' : 'View changes'}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                          </TableCell>
                        </TableRow>

                        {/* Smart diff view */}
                        {expandedRow === log.id && log.changes && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/50 p-0">
                              <div className="space-y-3 p-4">
                                {log.changes.before && log.changes.after ? (
                                  (() => {
                                    const diffs = computeDiff(
                                      log.changes.before as Record<string, unknown>,
                                      log.changes.after as Record<string, unknown>
                                    )
                                    if (diffs.length === 0) {
                                      return (
                                        <p className="text-sm italic text-muted-foreground">
                                          No visible field changes (only timestamps updated)
                                        </p>
                                      )
                                    }
                                    return (
                                      <div className="space-y-1">
                                        <h4 className="mb-2 text-sm font-semibold">
                                          {diffs.length} field{diffs.length !== 1 ? 's' : ''} changed
                                        </h4>
                                        <div className="overflow-x-auto rounded border">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="border-b bg-muted/80">
                                                <th className="px-3 py-1.5 text-left font-medium">Field</th>
                                                <th className="px-3 py-1.5 text-left font-medium text-red-600">Before</th>
                                                <th className="px-3 py-1.5 text-left font-medium text-green-600">After</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {diffs.map((d) => (
                                                <tr key={d.key} className="border-b last:border-0">
                                                  <td className="px-3 py-1.5 font-mono font-medium">{d.key}</td>
                                                  <td className="max-w-[300px] truncate px-3 py-1.5 text-red-700">
                                                    <pre className="whitespace-pre-wrap">{formatDiffValue(d.oldVal)}</pre>
                                                  </td>
                                                  <td className="max-w-[300px] truncate px-3 py-1.5 text-green-700">
                                                    <pre className="whitespace-pre-wrap">{formatDiffValue(d.newVal)}</pre>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )
                                  })()
                                ) : (
                                  <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">Details</h4>
                                    <pre className="max-h-48 overflow-auto rounded bg-white p-2 text-xs">
                                      {JSON.stringify(log.changes, null, 2)}
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
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Server-side Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}&ndash;{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <span className="px-2 text-sm font-medium">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                    >
                      Last
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
