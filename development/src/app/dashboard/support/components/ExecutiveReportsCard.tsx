'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { edgeFunctions } from '@/lib/edge-functions'
import { toast } from 'sonner'
import {
  Mail,
  Send,
  Eye,
  Loader2,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Play,
  Settings2,
  FileText,
  BarChart3,
  ScrollText,
  RefreshCw,
  History,
  Users,
  ChevronDown,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportSchedule {
  id: string
  report_type: string
  frequency: string
  day_of_week: number | null
  day_of_month: number | null
  time_utc: string
  recipients: string[]
  is_enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
}

interface ReportRun {
  id: string
  report_type: string
  status: string
  triggered_by: string
  duration_ms: number | null
  error_message: string | null
  created_at: string
}

interface OrgMember {
  id: string
  email: string
  full_name: string
  name: string
  role: string
}

interface Props {
  organizationId: string
}

const REPORT_TYPES = [
  {
    key: 'daily-report',
    label: 'Daily Platform Report',
    description: 'Platform stats, device health, alerts summary, GitHub activity',
    icon: BarChart3,
    color: 'text-blue-500',
  },
  {
    key: 'assessment-report',
    label: 'Software Assessment',
    description: 'Architecture scorecard, feature roadmap, 10-dimension grading',
    icon: FileText,
    color: 'text-purple-500',
  },
  {
    key: 'executive-summary',
    label: 'Executive Summary',
    description: 'MVP status, issue tracking, environment health, risk assessment, financials',
    icon: ScrollText,
    color: 'text-emerald-500',
  },
] as const

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

// Mirror of the edge function's default recipients — shown in the confirmation dialog
const DEFAULT_LEADERSHIP_RECIPIENTS = [
  'heath.scheiman@netneural.ai',
  'chris.payne@netneural.ai',
  'mike.jordan@netneural.ai',
  'matt.scholle@netneural.ai',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// The report_schedules and report_runs tables are new and not yet in the
// generated Supabase types. Use an untyped helper to avoid TS errors.
// Regenerate types after migration to remove these casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const untypedFrom = (client: ReturnType<typeof createClient>, table: string) =>
  (client as any).from(table)

const NETNEURAL_ORG_ID = '00000000-0000-0000-0000-000000000001'

export default function ExecutiveReportsCard({ organizationId }: Props) {
  // Only render for the NetNeural internal organization
  const isNetNeural = organizationId === NETNEURAL_ORG_ID
  if (!isNetNeural) return null

  return <ExecutiveReportsCardInner organizationId={organizationId} />
}

function ExecutiveReportsCardInner({ organizationId }: Props) {
  const supabase = createClient()

  // State
  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [recentRuns, setRecentRuns] = useState<ReportRun[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [runningReport, setRunningReport] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewingReport, setPreviewingReport] = useState<string | null>(null)
  const [savingSchedule, setSavingSchedule] = useState<string | null>(null)

  // Members & recipient state
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientPopoverOpen, setRecipientPopoverOpen] = useState(false)

  // Confirmation dialog state
  const [confirmSendType, setConfirmSendType] = useState<string | null>(null)

  // Ref guards to prevent double-fire on rapid clicks
  const sendingRef = useRef(false)
  const previewingRef = useRef(false)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchMembers = useCallback(async () => {
    if (!organizationId) return
    try {
      const response = await edgeFunctions.members.list(organizationId)
      if (!response.success) return
      const membersData =
        (response.data as { members: OrgMember[] })?.members || []
      setOrgMembers(membersData)
    } catch (err) {
      console.error('Failed to fetch members for recipient list:', err)
    }
  }, [organizationId])

  const fetchSchedules = useCallback(async () => {
    const { data, error } = await untypedFrom(supabase, 'report_schedules')
      .select('*')
      .order('report_type')

    if (error) {
      console.error('Failed to load schedules:', error)
      // Table may not exist yet — not a fatal error
      setSchedules([])
    } else {
      setSchedules(data || [])
    }
    setLoadingSchedules(false)
  }, [supabase])

  const fetchRecentRuns = useCallback(async () => {
    const { data, error } = await untypedFrom(supabase, 'report_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Failed to load runs:', error)
      setRecentRuns([])
    } else {
      setRecentRuns(data || [])
    }
  }, [supabase])

  useEffect(() => {
    fetchMembers()
    fetchSchedules()
    fetchRecentRuns()
  }, [fetchMembers, fetchSchedules, fetchRecentRuns])

  // -------------------------------------------------------------------------
  // Recipient management
  // -------------------------------------------------------------------------

  const toggleRecipient = (email: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email]
    )
  }

  const removeRecipient = (email: string) => {
    setSelectedRecipients((prev) => prev.filter((e) => e !== email))
  }

  const filteredMembers = orgMembers.filter((m) => {
    if (!recipientSearch) return true
    const q = recipientSearch.toLowerCase()
    return (
      (m.email || '').toLowerCase().includes(q) ||
      (m.full_name || '').toLowerCase().includes(q) ||
      (m.name || '').toLowerCase().includes(q)
    )
  })

  // -------------------------------------------------------------------------
  // Run report on demand
  // -------------------------------------------------------------------------

  const runReport = async (reportType: string) => {
    if (sendingRef.current) return
    sendingRef.current = true
    setRunningReport(reportType)
    const startTime = Date.now()

    // Log the run as "running"
    const { data: runRow } = await untypedFrom(supabase, 'report_runs')
      .insert({
        report_type: reportType,
        status: 'running',
        triggered_by: 'manual',
      })
      .select('id')
      .single()

    try {
      const body: Record<string, unknown> = {}
      if (selectedRecipients.length > 0) {
        body.recipients = selectedRecipients
      }

      const { data, error } = await supabase.functions.invoke(reportType, {
        method: 'POST',
        body,
      })

      const durationMs = Date.now() - startTime

      if (error) throw error

      // Update the run log
      if (runRow?.id) {
        await untypedFrom(supabase, 'report_runs')
          .update({
            status: 'success',
            duration_ms: durationMs,
            details: data,
          })
          .eq('id', runRow.id)
      }

      const reportLabel = REPORT_TYPES.find(r => r.key === reportType)?.label ?? reportType
      toast.success(
        `${reportLabel} sent successfully`,
        { description: `Completed in ${(durationMs / 1000).toFixed(1)}s` }
      )
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      const durationMs = Date.now() - startTime

      if (runRow?.id) {
        await untypedFrom(supabase, 'report_runs')
          .update({
            status: 'error',
            duration_ms: durationMs,
            error_message: msg,
          })
          .eq('id', runRow.id)
      }

      toast.error(`Failed to send report`, { description: msg })
    } finally {
      sendingRef.current = false
      setRunningReport(null)
      fetchRecentRuns()
      fetchSchedules()
    }
  }

  // -------------------------------------------------------------------------
  // Preview report
  // -------------------------------------------------------------------------

  const previewReport = async (reportType: string) => {
    if (previewingRef.current) return
    previewingRef.current = true
    setPreviewingReport(reportType)
    try {
      const { data, error } = await supabase.functions.invoke(reportType, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { preview: true },
      })

      if (error) throw error

      // The edge function returns HTML when preview=true (via query param).
      // Since we can't easily pass query params via SDK, we'll handle it:
      // If data is a string, it's HTML. If it's JSON, extract html field.
      let html = ''
      if (typeof data === 'string') {
        html = data
      } else if (data?.html) {
        html = data.html
      } else {
        html = `<pre>${JSON.stringify(data, null, 2)}</pre>`
      }

      const label = REPORT_TYPES.find(r => r.key === reportType)?.label ?? reportType
      setPreviewTitle(label)
      setPreviewHtml(html)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Preview failed', { description: msg })
    } finally {
      previewingRef.current = false
      setPreviewingReport(null)
    }
  }

  // -------------------------------------------------------------------------
  // Schedule management
  // -------------------------------------------------------------------------

  const updateSchedule = async (
    reportType: string,
    updates: Partial<ReportSchedule>
  ) => {
    setSavingSchedule(reportType)
    try {
      const { error } = await untypedFrom(supabase, 'report_schedules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('report_type', reportType)

      if (error) throw error
      toast.success('Schedule updated')
      fetchSchedules()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to update schedule', { description: msg })
    } finally {
      setSavingSchedule(null)
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const getScheduleForType = (reportType: string): ReportSchedule | undefined =>
    schedules.find((s) => s.report_type === reportType)

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return 'Never'
    const d = new Date(ts)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="default" className="bg-green-600 text-white">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Success
          </Badge>
        )
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" /> Error
          </Badge>
        )
      case 'running':
        return (
          <Badge variant="secondary">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Running
          </Badge>
        )
      case 'preview':
        return (
          <Badge variant="outline">
            <Eye className="mr-1 h-3 w-3" /> Preview
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const frequencyLabel = (freq: string) => {
    switch (freq) {
      case 'daily': return 'Daily'
      case 'weekly': return 'Weekly'
      case 'monthly': return 'Monthly'
      default: return 'Off'
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* On-Demand Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Executive Reports
          </CardTitle>
          <CardDescription>
            Send executive email reports on demand or configure an automated schedule.
            {selectedRecipients.length > 0
              ? ` Sending to ${selectedRecipients.length} selected recipient${selectedRecipients.length > 1 ? 's' : ''}.`
              : ' Reports are sent to the default leadership distribution list.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recipient Picker */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Recipients</Label>
              <Popover open={recipientPopoverOpen} onOpenChange={setRecipientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Users className="mr-1 h-3.5 w-3.5" />
                    Choose Members
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-2">
                    <Input
                      placeholder="Search members..."
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <ScrollArea className="max-h-[240px]">
                    <div className="px-2 pb-2">
                      {filteredMembers.length === 0 ? (
                        <p className="py-3 text-center text-xs text-muted-foreground">
                          No members found
                        </p>
                      ) : (
                        filteredMembers.map((member) => (
                          <label
                            key={member.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
                          >
                            <Checkbox
                              checked={selectedRecipients.includes(member.email)}
                              onCheckedChange={() => toggleRecipient(member.email)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">{member.full_name || member.name || member.email}</p>
                              <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  {selectedRecipients.length > 0 && (
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full text-xs"
                        onClick={() => setSelectedRecipients([])}
                      >
                        Clear all ({selectedRecipients.length})
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Selected recipients as badges */}
            {selectedRecipients.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedRecipients.map((email) => {
                  const member = orgMembers.find((m) => m.email === email)
                  return (
                    <Badge key={email} variant="secondary" className="gap-1 pr-1 text-xs">
                      {member?.full_name || member?.name || email}
                      <button
                        onClick={() => removeRecipient(email)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No recipients selected — will use default leadership list
              </p>
            )}
          </div>

          <Separator />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REPORT_TYPES.map(({ key, label, description, icon: Icon, color }) => {
              const schedule = getScheduleForType(key)
              const isRunning = runningReport === key
              const isPreviewing = previewingReport === key

              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 rounded-lg border p-4"
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                      {schedule?.last_run_at && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Last sent: {formatTimestamp(schedule.last_run_at)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => previewReport(key)}
                      disabled={isPreviewing || isRunning}
                    >
                      {isPreviewing ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="mr-1 h-4 w-4" />
                      )}
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setConfirmSendType(key)}
                      disabled={isRunning || isPreviewing}
                    >
                      {isRunning ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-1 h-4 w-4" />
                      )}
                      {isRunning ? 'Sending...' : 'Send Now'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Schedule
          </CardTitle>
          <CardDescription>
            Configure automated report delivery. Schedules run in UTC.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingSchedules ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading schedules...
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Schedule configuration will be available after the database migration runs.
              Use the &quot;Send Now&quot; buttons above for on-demand reports.
            </p>
          ) : (
            REPORT_TYPES.map(({ key, label, icon: Icon, color }) => {
              const schedule = getScheduleForType(key)
              if (!schedule) return null

              const isSaving = savingSchedule === key

              return (
                <div key={key} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`enable-${key}`} className="text-xs text-muted-foreground">
                        {schedule.is_enabled ? 'Enabled' : 'Disabled'}
                      </Label>
                      <Switch
                        id={`enable-${key}`}
                        checked={schedule.is_enabled}
                        onCheckedChange={(checked) =>
                          updateSchedule(key, { is_enabled: checked })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    {/* Frequency */}
                    <div className="space-y-1">
                      <Label className="text-xs">Frequency</Label>
                      <Select
                        value={schedule.frequency}
                        onValueChange={(val) => updateSchedule(key, { frequency: val })}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Off</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Day of week (weekly only) */}
                    {schedule.frequency === 'weekly' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Day</Label>
                        <Select
                          value={String(schedule.day_of_week ?? 1)}
                          onValueChange={(val) =>
                            updateSchedule(key, { day_of_week: parseInt(val) } as Partial<ReportSchedule>)
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((d) => (
                              <SelectItem key={d.value} value={d.value}>
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Day of month (monthly only) */}
                    {schedule.frequency === 'monthly' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Day of Month</Label>
                        <Select
                          value={String(schedule.day_of_month ?? 1)}
                          onValueChange={(val) =>
                            updateSchedule(key, { day_of_month: parseInt(val) } as Partial<ReportSchedule>)
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                              <SelectItem key={d} value={String(d)}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Time (UTC) */}
                    {schedule.frequency !== 'none' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Time (UTC)</Label>
                        <Input
                          type="time"
                          className="w-[120px]"
                          value={schedule.time_utc?.slice(0, 5) || '12:00'}
                          onChange={(e) =>
                            updateSchedule(key, { time_utc: e.target.value + ':00' } as Partial<ReportSchedule>)
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Schedule summary */}
                  {schedule.frequency !== 'none' && (
                    <p className="text-xs text-muted-foreground">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {schedule.frequency === 'daily' &&
                        `Runs daily at ${schedule.time_utc?.slice(0, 5) || '12:00'} UTC`}
                      {schedule.frequency === 'weekly' &&
                        `Runs every ${DAYS_OF_WEEK.find((d) => d.value === String(schedule.day_of_week))?.label || 'Monday'} at ${schedule.time_utc?.slice(0, 5) || '12:00'} UTC`}
                      {schedule.frequency === 'monthly' &&
                        `Runs on the ${schedule.day_of_month || 1}${ordinalSuffix(schedule.day_of_month || 1)} of each month at ${schedule.time_utc?.slice(0, 5) || '12:00'} UTC`}
                      {!schedule.is_enabled && ' (paused)'}
                    </p>
                  )}

                  {isSaving && (
                    <p className="text-xs text-muted-foreground">
                      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Saving...
                    </p>
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Recent Report History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Report History
              </CardTitle>
              <CardDescription>Recent report executions</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchRecentRuns()}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No report runs yet. Use the &quot;Send Now&quot; buttons above to send your first report.
            </p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    {statusBadge(run.status)}
                    <span className="font-medium">
                      {REPORT_TYPES.find(r => r.key === run.report_type)?.label ?? run.report_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {run.triggered_by === 'scheduler' ? (
                        <><Clock className="mr-0.5 inline h-3 w-3" /> Scheduled</>
                      ) : (
                        <><Play className="mr-0.5 inline h-3 w-3" /> Manual</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {run.duration_ms && (
                      <span>{(run.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                    <span>{formatTimestamp(run.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={!!confirmSendType} onOpenChange={(open) => { if (!open) setConfirmSendType(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Report</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to send the{' '}
                  <strong>
                    {REPORT_TYPES.find(r => r.key === confirmSendType)?.label ?? confirmSendType}
                  </strong>.
                </p>
                <div>
                  <p className="mb-1 font-medium text-foreground">Recipients:</p>
                  <ul className="list-inside list-disc space-y-0.5 text-sm">
                    {(selectedRecipients.length > 0
                      ? selectedRecipients
                      : DEFAULT_LEADERSHIP_RECIPIENTS
                    ).map((email) => (
                      <li key={email}>{email}</li>
                    ))}
                  </ul>
                  {selectedRecipients.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No recipients selected — using default leadership list
                    </p>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmSendType) {
                  runReport(confirmSendType)
                  setConfirmSendType(null)
                }
              }}
            >
              <Send className="mr-1 h-4 w-4" />
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTitle} — Preview</DialogTitle>
          </DialogHeader>
          {previewHtml && (
            <div
              className="rounded border bg-white p-4"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th'
}
