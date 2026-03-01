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
  Bot,
  Sparkles,
  Map,
  Layers,
  Activity,
  Shield,
  Bell,
  Cpu,
  Globe,
  MessageSquare,
  Building2,
  LineChart,
  UserCog,
  HeadphonesIcon,
  Lock,
  Palette,
  Radio,
  Gauge,
  CreditCard,
  type LucideIcon,
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
  summary: string | null
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
    description:
      'Platform stats, device health, alerts summary, GitHub activity',
    icon: BarChart3,
    color: 'text-blue-500',
  },
  {
    key: 'assessment-report',
    label: 'Software Assessment',
    description:
      'Architecture scorecard, feature roadmap, 10-dimension grading',
    icon: FileText,
    color: 'text-purple-500',
  },
  {
    key: 'executive-summary',
    label: 'Executive Summary',
    description:
      'MVP status, issue tracking, environment health, risk assessment, financials',
    icon: ScrollText,
    color: 'text-emerald-500',
  },
  {
    key: 'generate-report-summary',
    label: 'AI Report Summary',
    description:
      'GPT-powered analysis of alert, telemetry, and audit reports with caching',
    icon: Sparkles,
    color: 'text-amber-500',
  },
  {
    key: 'ai-report-summary',
    label: 'AI Insights Summary',
    description:
      'Executive-level AI analysis with key findings, red flags, and recommendations',
    icon: Bot,
    color: 'text-rose-500',
  },
  {
    key: 'platform-feature-report',
    label: 'Platform Feature Report',
    description:
      'Complete platform inventory for tier planning — all features across all categories',
    icon: Layers,
    color: 'text-teal-500',
  },
] as const

// ---------------------------------------------------------------------------
// Platform Feature Report Data — Comprehensive inventory for tier planning
// ---------------------------------------------------------------------------

interface FeatureSection {
  category: string
  icon: LucideIcon
  color: string
  features: string[]
}

const PLATFORM_FEATURES: FeatureSection[] = [
  {
    category: 'Authentication & Security',
    icon: Lock,
    color: 'text-red-500',
    features: [
      'Email/password login with Supabase Auth',
      'User registration with 3-step signup flow (plan → account → confirmation)',
      'Multi-factor authentication (MFA/TOTP)',
      'Mandatory MFA enrollment on login (forced 2FA setup for all accounts)',
      'Organization-branded login page',
      'Password change & reset flows',
      'Forced password change on first login (admin-provisioned accounts)',
      'Phone number setup & verification',
      'Session management & token refresh',
      'Role-based access control (5 roles: viewer, operator, technician, admin, owner)',
      'Row-Level Security on all tables',
      'Content Security Policy (CSP) meta headers',
      'Privacy policy page (/privacy)',
    ],
  },
  {
    category: 'Dashboard & Navigation',
    icon: Gauge,
    color: 'text-blue-500',
    features: [
      'Stat cards (devices, alerts, uptime, telemetry)',
      'Locations overview with device counts',
      'System health status panel',
      'Recent alerts feed',
      'Organization info card',
      'Quick-nav grid to all sections',
      'Collapsible sidebar navigation',
      'Organization switcher (multi-org)',
      'Quick actions menu (add device, create alert rule, invite user, submit feedback)',
      'Keyboard shortcuts (Ctrl+K search, Ctrl+/ help, N/A/R/S/D quick-nav)',
      'Theme toggle (light/dark/system)',
      'Custom branding (logo, colors, org name)',
      'Mobile-responsive layout',
    ],
  },
  {
    category: 'Device Management',
    icon: Cpu,
    color: 'text-cyan-500',
    features: [
      'Add device dialog with metadata fields',
      'Device list with card & table view toggle',
      'Filter by status, type, location',
      'Sort by name, status, last seen, created',
      'Search by name/ID',
      'Pagination with configurable page size',
      'Temperature unit toggle (°C/°F)',
      'Auto-refresh with data-freshness indicator',
      'Export devices to CSV',
      'Bulk delete devices',
      'Device detail: Overview tab (status, metadata, location, uptime)',
      'Device detail: Telemetry tab (live readings, history chart, date range)',
      'Device detail: Configuration tab (settings, firmware, thresholds)',
      'Device detail: Alerts tab (device-specific alerts, create rules)',
      'Device detail: System Info tab (hardware, network, diagnostics)',
      'Transfer device between organizations',
      'Real-time status updates via Supabase subscriptions',
    ],
  },
  {
    category: 'Device Types',
    icon: Layers,
    color: 'text-violet-500',
    features: [
      'Create/edit/delete device types',
      'Visual range bars for normal/alert thresholds',
      'Measurement metadata (unit, min, max, precision)',
      'Assign types to devices',
      'Type-based threshold defaults',
      'Color-coded type badges',
      'Type usage count tracking',
    ],
  },
  {
    category: 'Alerts & Notifications',
    icon: Bell,
    color: 'text-orange-500',
    features: [
      'Alert list with card & table view toggle',
      'Tabs: Active, Acknowledged, Resolved, All',
      'Search alerts by text',
      'Filter by severity (critical, warning, info)',
      'Filter by category (threshold, connectivity, system)',
      'Group alerts by device',
      'Acknowledge / snooze / clear actions',
      'Bulk select & bulk actions',
      'Alert timeline visualization',
      'Browser push notifications',
      'Deep linking to alert detail',
      'Alert history with date range filtering',
      'Severity-based color coding & icons',
    ],
  },
  {
    category: 'Alert Rules',
    icon: Shield,
    color: 'text-amber-500',
    features: [
      'Create/edit/delete alert rules',
      'Multi-step wizard (condition, threshold, notification, schedule)',
      'Toggle enable/disable per rule',
      'Duplicate existing rules',
      'Filter rules by type',
      'Rule evaluation on telemetry ingestion',
      'Notification channels (email, in-app, webhook)',
      'Cooldown period configuration',
    ],
  },
  {
    category: 'AI Analytics',
    icon: Sparkles,
    color: 'text-purple-500',
    features: [
      'Configurable time range (24h, 7d, 30d, custom)',
      'Device health score cards',
      'Predictive forecasting with confidence intervals',
      'Interactive charts (line, bar, area)',
      'Device performance analytics tab',
      'Alert analytics tab (trends, patterns)',
      'AI-powered summary generation (GPT)',
      'Export analytics reports',
      'Send analytics via email',
      'Cached AI summaries for performance',
    ],
  },
  {
    category: 'Facility Maps',
    icon: Map,
    color: 'text-teal-500',
    features: [
      'Create/edit/delete facility maps with metadata',
      'Image upload (drag-drop, file picker, camera capture)',
      'Click-to-place devices on floor plan',
      'Drag-to-reposition device markers',
      'Real-time device status on map (Supabase subscriptions)',
      'Responsive percentage-based coordinates',
      'Touch support for mobile/tablet',
      'Multiple maps with thumbnail strip',
      'View / Place / Edit mode switching',
      'Device count badges per map',
      'Click device marker to navigate to detail',
      'Status summary bar (online/offline/warning/error)',
      'Search & filter devices in side palette',
      'Export map as PNG image',
      'Telemetry tooltips on hover (up to 6 values)',
      'Fullscreen toggle via Browser Fullscreen API',
      'Collage / Single view toggle with arrow navigation',
    ],
  },
  {
    category: 'Feedback System',
    icon: MessageSquare,
    color: 'text-green-500',
    features: [
      'Submit bug reports with severity',
      'Submit feature requests with priority',
      'Attach screenshots',
      'Auto-create GitHub Issues',
      'Feedback history list',
      'Edit/delete submitted feedback',
      'Status tracking (open, in-progress, resolved)',
      'Admin review & response',
      'Category tagging',
      'Search & filter feedback',
    ],
  },
  {
    category: 'Integrations',
    icon: Globe,
    color: 'text-indigo-500',
    features: [
      '9 integration types (MQTT, Golioth, AWS IoT, Azure IoT, Email, Slack, Webhook, NetNeural Hub, Google IoT)',
      'Create/edit/delete integration configs',
      'Per-device sync triggers',
      'Auto-sync scheduling',
      'Status toggle (enable/disable)',
      'Copy/clone integration configs',
      'Sync history log',
      'Activity log with timestamps',
      'Connection testing & validation',
      'Credential management (encrypted)',
    ],
  },
  {
    category: 'Organization Management',
    icon: Building2,
    color: 'text-sky-500',
    features: [
      'Organization overview dashboard',
      'Member management (invite, remove, role change)',
      'Location management (CRUD, assign devices)',
      'Organization-level integrations',
      'Access request review & approval',
      'Customer org management (for MSPs)',
      'Settings: branding (logo, colors, custom login page)',
    ],
  },
  {
    category: 'Billing & Subscriptions',
    icon: CreditCard,
    color: 'text-emerald-600',
    features: [
      'Billing Administration dashboard (10-tab admin panel)',
      'Plans tab (CRUD plans, feature matrix, pricing tiers)',
      'Subscriptions tab (manage customer subscriptions)',
      'Invoices tab (invoice history, status tracking)',
      'Payment Methods tab (card management)',
      'Revenue tab (revenue analytics, MRR/ARR)',
      'Usage tab (usage metrics, per-org consumption)',
      'Discounts tab (coupon/promo management)',
      'Tax tab (tax configuration)',
      'Dunning tab (failed payment recovery)',
      'Settings tab (billing configuration)',
      'Stripe Customer Portal integration (Manage Billing button)',
      'Plans & Pricing page (owner-only: pricing display, plan comparison)',
      'Role-based billing access (owner, billing, super_admin)',
      'NetNeural-only billing restriction (org-level access control)',
    ],
  },
  {
    category: 'Reports',
    icon: LineChart,
    color: 'text-emerald-500',
    features: [
      'Report hub with 3 report types',
      'Alert History report (filters, charts, export, AI summary)',
      'Telemetry Trends report (device selection, date range, charts, export)',
      'Audit Log report (user actions, filters, export)',
      'Date range picker for all reports',
      'Export to CSV/PDF',
      'Send report via email',
      'AI-generated report summaries',
      'Chart visualizations (bar, line, pie)',
    ],
  },
  {
    category: 'Personal Settings',
    icon: UserCog,
    color: 'text-pink-500',
    features: [
      'Profile tab (name, email, avatar)',
      'Preferences (theme, language, timezone, notification preferences)',
      'Security (password change, MFA setup, active sessions, API key management)',
      'Organization list & switching',
      'Auto-save on changes',
      'Temperature unit preference (°C/°F)',
    ],
  },
  {
    category: 'User Management',
    icon: Users,
    color: 'text-slate-500',
    features: [
      'User list with role badges',
      'View/edit user details',
      'Import users (bulk)',
      'Role assignment & changes',
      'User activity tracking',
    ],
  },
  {
    category: 'Support & Administration',
    icon: HeadphonesIcon,
    color: 'text-rose-500',
    features: [
      'Customer Assistance tab (org-level help)',
      'Admin Tools (reports, export, bulk ops)',
      'Documentation hub',
      'Troubleshooting tools (super-admin)',
      'System Health monitoring (super-admin)',
      'Tests & Validation suite (super-admin)',
    ],
  },
  {
    category: 'Cross-Cutting Capabilities',
    icon: Radio,
    color: 'text-yellow-600',
    features: [
      'Multi-organization support with org switching',
      'Real-time updates via Supabase subscriptions',
      'Audit logging for all user actions',
      'Custom branding per organization',
      'Temperature unit conversion (global preference)',
      'Data freshness indicators & auto-refresh',
      'CSV export across all data views',
      'Email delivery for reports & alerts',
      'AI summaries (GPT-powered) for analytics & reports',
      'Mobile-responsive across all pages',
      'Browser push notifications',
      'Keyboard accessibility & shortcuts',
      'Dark/light/system theme support',
    ],
  },
]

const TOTAL_FEATURE_COUNT = PLATFORM_FEATURES.reduce((sum, s) => sum + s.features.length, 0)

/**
 * Generate a styled HTML report for the Platform Feature Report.
 * Used for both Preview and Send — no edge function needed.
 */
function generateFeatureReportHtml(): string {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const sections = PLATFORM_FEATURES.map((s) => {
    const items = s.features.map((f) => `<li style="padding:3px 0;color:#374151;font-size:13px;">${f}</li>`).join('')
    return `
      <div style="margin-bottom:20px;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
        <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#111827;text-transform:uppercase;letter-spacing:0.05em;">
          ${s.category} <span style="background:#f3f4f6;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500;color:#6b7280;margin-left:8px;">${s.features.length}</span>
        </h3>
        <ul style="margin:0;padding:0 0 0 16px;columns:2;column-gap:24px;">${items}</ul>
      </div>`
  }).join('')

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:900px;margin:0 auto;padding:32px;">
      <div style="border-bottom:3px solid #0d9488;padding-bottom:16px;margin-bottom:24px;">
        <h1 style="margin:0;font-size:24px;color:#111827;">NetNeural Platform Feature Report</h1>
        <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">Complete inventory of ${TOTAL_FEATURE_COUNT} features across ${PLATFORM_FEATURES.length} categories — ${now}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
        <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#0d9488;">${TOTAL_FEATURE_COUNT}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">Total Features</div>
        </div>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#2563eb;">${PLATFORM_FEATURES.length}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">Categories</div>
        </div>
        <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#d97706;">5</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">Roles (RBAC)</div>
        </div>
      </div>
      ${sections}
      <div style="border-top:1px solid #e5e7eb;padding-top:16px;margin-top:24px;text-align:center;color:#9ca3af;font-size:12px;">
        Generated by NetNeural Platform · ${now}
      </div>
    </div>`
}

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
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
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
  // Build request body for AI report functions
  // -------------------------------------------------------------------------

  const buildAIReportBody = async (reportType: string): Promise<Record<string, unknown>> => {
    // For AI functions, fetch live alert data to generate a real summary
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const dateRange = `${sevenDaysAgo.split('T')[0]} to ${now.toISOString().split('T')[0]}`

    // Fetch alerts for context
    const { data: alerts } = await supabase
      .from('alerts')
      .select('id, severity, is_resolved, alert_type, created_at')
      .gte('created_at', sevenDaysAgo)
      .limit(200)

    const alertData = (alerts || []).map((a: Record<string, unknown>) => ({
      severity: a.severity,
      is_resolved: a.is_resolved,
      alert_type: a.alert_type,
    }))

    if (reportType === 'generate-report-summary') {
      return {
        reportType: 'alert-history',
        reportData: {
          dateRange,
          totalRecords: alertData.length,
          criticalCount: alertData.filter((a: Record<string, unknown>) => a.severity === 'critical').length,
        },
        organizationId,
      }
    }

    // ai-report-summary
    return {
      reportType: 'alert_history',
      dateRange,
      totalRecords: alertData.length,
      data: alertData,
      organizationId,
    }
  }

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
      let body: Record<string, unknown> = {}

      // Platform Feature Report — generate client-side and use daily-report to email
      if (reportType === 'platform-feature-report') {
        const html = generateFeatureReportHtml()
        body = {
          preview: false,
          html,
          subject: `NetNeural Platform Feature Report — ${TOTAL_FEATURE_COUNT} Features`,
          ...(selectedRecipients.length > 0 ? { recipients: selectedRecipients } : {}),
        }
        // Use daily-report edge function as the email transport
        const { data, error } = await supabase.functions.invoke('daily-report', {
          method: 'POST',
          body,
        })
        const durationMs = Date.now() - startTime
        if (error) throw error
        if (runRow?.id) {
          await untypedFrom(supabase, 'report_runs')
            .update({ status: 'success', duration_ms: durationMs, summary: `Feature report with ${TOTAL_FEATURE_COUNT} features sent` })
            .eq('id', runRow.id)
        }
        toast.success('Platform Feature Report sent', { description: `${TOTAL_FEATURE_COUNT} features · ${(durationMs / 1000).toFixed(1)}s` })
        return
      }

      // AI report functions need structured input data
      if (reportType === 'generate-report-summary' || reportType === 'ai-report-summary') {
        body = await buildAIReportBody(reportType)
      } else {
        if (selectedRecipients.length > 0) {
          body.recipients = selectedRecipients
        }
      }

      const { data, error } = await supabase.functions.invoke(reportType, {
        method: 'POST',
        body,
      })

      const durationMs = Date.now() - startTime

      if (error) throw error

      // Build a brief human-readable summary from the response
      const summary = buildReportSummary(reportType, data)

      // Update the run log
      if (runRow?.id) {
        await untypedFrom(supabase, 'report_runs')
          .update({
            status: 'success',
            duration_ms: durationMs,
            details: data,
            summary,
          })
          .eq('id', runRow.id)
      }

      const reportLabel =
        REPORT_TYPES.find((r) => r.key === reportType)?.label ?? reportType
      const isAIReport = reportType === 'generate-report-summary' || reportType === 'ai-report-summary'
      toast.success(`${reportLabel} ${isAIReport ? 'generated' : 'sent'} successfully`, {
        description: `Completed in ${(durationMs / 1000).toFixed(1)}s`,
      })
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
      // Platform Feature Report is generated client-side — no edge function needed
      if (reportType === 'platform-feature-report') {
        setPreviewTitle('Platform Feature Report')
        setPreviewHtml(generateFeatureReportHtml())
        return
      }

      // AI report functions need structured input, not { preview: true }
      let body: Record<string, unknown>
      if (reportType === 'generate-report-summary' || reportType === 'ai-report-summary') {
        body = await buildAIReportBody(reportType)
      } else {
        body = { preview: true }
      }

      const { data, error } = await supabase.functions.invoke(reportType, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
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
        // Format AI summary responses as readable HTML
        html = formatAISummaryAsHtml(reportType, data)
      }

      const label =
        REPORT_TYPES.find((r) => r.key === reportType)?.label ?? reportType
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
      case 'daily':
        return 'Daily'
      case 'weekly':
        return 'Weekly'
      case 'monthly':
        return 'Monthly'
      default:
        return 'Off'
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
            Send executive email reports on demand or configure an automated
            schedule.
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
              <Popover
                open={recipientPopoverOpen}
                onOpenChange={setRecipientPopoverOpen}
              >
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
                              checked={selectedRecipients.includes(
                                member.email
                              )}
                              onCheckedChange={() =>
                                toggleRecipient(member.email)
                              }
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm">
                                {member.full_name ||
                                  member.name ||
                                  member.email}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {member.email}
                              </p>
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
                    <Badge
                      key={email}
                      variant="secondary"
                      className="gap-1 pr-1 text-xs"
                    >
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
            {REPORT_TYPES.map(
              ({ key, label, description, icon: Icon, color }) => {
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
                        <p className="text-xs text-muted-foreground">
                          {description}
                        </p>
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
                        ) : key === 'generate-report-summary' || key === 'ai-report-summary' ? (
                          <Sparkles className="mr-1 h-4 w-4" />
                        ) : (
                          <Send className="mr-1 h-4 w-4" />
                        )}
                        {isRunning
                          ? 'Running...'
                          : key === 'generate-report-summary' || key === 'ai-report-summary'
                            ? 'Generate'
                            : 'Send Now'}
                      </Button>
                    </div>
                  </div>
                )
              }
            )}
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
              Schedule configuration will be available after the database
              migration runs. Use the &quot;Send Now&quot; buttons above for
              on-demand reports.
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
                      <Label
                        htmlFor={`enable-${key}`}
                        className="text-xs text-muted-foreground"
                      >
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
                        onValueChange={(val) =>
                          updateSchedule(key, { frequency: val })
                        }
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
                            updateSchedule(key, {
                              day_of_week: parseInt(val),
                            } as Partial<ReportSchedule>)
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
                            updateSchedule(key, {
                              day_of_month: parseInt(val),
                            } as Partial<ReportSchedule>)
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(
                              (d) => (
                                <SelectItem key={d} value={String(d)}>
                                  {d}
                                </SelectItem>
                              )
                            )}
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
                            updateSchedule(key, {
                              time_utc: e.target.value + ':00',
                            } as Partial<ReportSchedule>)
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
                      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />{' '}
                      Saving...
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
            <Button variant="ghost" size="sm" onClick={() => fetchRecentRuns()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No report runs yet. Use the &quot;Send Now&quot; buttons above to
              send your first report.
            </p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {statusBadge(run.status)}
                      <span className="font-medium">
                        {REPORT_TYPES.find((r) => r.key === run.report_type)
                          ?.label ?? run.report_type}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {run.triggered_by === 'scheduler' ? (
                          <>
                            <Clock className="mr-0.5 inline h-3 w-3" /> Scheduled
                          </>
                        ) : (
                          <>
                            <Play className="mr-0.5 inline h-3 w-3" /> Manual
                          </>
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
                  {run.summary && (
                    <p className="mt-1 pl-[70px] text-xs text-muted-foreground">
                      {run.summary}
                    </p>
                  )}
                  {run.status === 'error' && run.error_message && (
                    <p className="mt-1 pl-[70px] text-xs text-destructive">
                      {run.error_message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Confirmation Dialog */}
      <AlertDialog
        open={!!confirmSendType}
        onOpenChange={(open) => {
          if (!open) setConfirmSendType(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmSendType === 'generate-report-summary' || confirmSendType === 'ai-report-summary'
                ? 'Generate AI Summary'
                : 'Send Report'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to{' '}
                  {confirmSendType === 'generate-report-summary' || confirmSendType === 'ai-report-summary'
                    ? 'generate'
                    : 'send'}{' '}
                  the{' '}
                  <strong>
                    {REPORT_TYPES.find((r) => r.key === confirmSendType)
                      ?.label ?? confirmSendType}
                  </strong>
                  .
                </p>
                {confirmSendType === 'generate-report-summary' || confirmSendType === 'ai-report-summary' ? (
                  <p className="text-sm text-muted-foreground">
                    This will use OpenAI to analyze recent alert data and generate an AI-powered summary with key findings, red flags, and recommendations.
                  </p>
                ) : (
                  <div>
                    <p className="mb-1 font-medium text-foreground">
                      Recipients:
                    </p>
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
                )}
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
              {confirmSendType === 'generate-report-summary' || confirmSendType === 'ai-report-summary' ? (
                <><Sparkles className="mr-1 h-4 w-4" /> Generate</>
              ) : (
                <><Send className="mr-1 h-4 w-4" /> Send Now</>
              )}
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

/**
 * Format AI summary JSON response as readable styled HTML for the preview dialog.
 */
function formatAISummaryAsHtml(
  reportType: string,
  data: Record<string, unknown> | null | undefined
): string {
  if (!data) return '<p style="color:#6b7280;">No data returned.</p>'

  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const title = reportType === 'generate-report-summary' ? 'AI Report Summary' : 'AI Insights Summary'

  // Extract summary — might be at top level or nested under 'summary'
  const summary = (data.summary ?? data) as Record<string, unknown>
  const keyFindings = Array.isArray(summary.keyFindings) ? summary.keyFindings : []
  const redFlags = Array.isArray(summary.redFlags) ? summary.redFlags : []
  const recommendations = Array.isArray(summary.recommendations) ? summary.recommendations : []
  const trendAnalysis = typeof summary.trendAnalysis === 'string' ? summary.trendAnalysis : ''
  const confidence = typeof summary.confidence === 'number' ? summary.confidence : null
  const cached = data.cached === true

  const section = (icon: string, heading: string, items: string[], color: string) => {
    if (items.length === 0) return ''
    const list = items.map((item) => `<li style="padding:3px 0;color:#374151;font-size:13px;">${item}</li>`).join('')
    return `
      <div style="margin-bottom:16px;">
        <h3 style="font-size:13px;font-weight:600;color:${color};margin:0 0 6px;">${icon} ${heading}</h3>
        <ul style="margin:0;padding:0 0 0 18px;">${list}</ul>
      </div>`
  }

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:700px;margin:0 auto;padding:24px;">
      <div style="border-bottom:3px solid #8b5cf6;padding-bottom:12px;margin-bottom:20px;">
        <h1 style="margin:0;font-size:20px;color:#111827;">🤖 ${title}</h1>
        <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">
          Generated ${now}${cached ? ' · <span style="color:#8b5cf6;">Cached</span>' : ''}${confidence != null ? ` · Confidence: ${Math.round(confidence * 100)}%` : ''}
        </p>
      </div>
      ${trendAnalysis ? `
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:14px;margin-bottom:16px;">
          <div style="font-size:13px;color:#4c1d95;font-weight:500;">✨ Trend Analysis</div>
          <p style="margin:6px 0 0;font-size:13px;color:#374151;">${trendAnalysis}</p>
        </div>` : ''}
      ${section('✅', 'Key Findings', keyFindings, '#059669')}
      ${section('🚩', 'Red Flags', redFlags, '#dc2626')}
      ${section('💡', 'Recommendations', recommendations, '#2563eb')}
      ${keyFindings.length === 0 && redFlags.length === 0 && recommendations.length === 0 ? `
        <div style="text-align:center;padding:24px;color:#9ca3af;">
          <p style="font-size:14px;">No AI insights available.</p>
          <p style="font-size:12px;">The AI service may not be configured. Rule-based summaries are shown in reports.</p>
        </div>` : ''}
      <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:16px;text-align:center;color:#9ca3af;font-size:11px;">
        AI insights are suggestions only. Always verify critical findings with your data.
      </div>
    </div>`
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th'
}

/**
 * Build a brief one-line summary from edge function response data.
 * Each report type returns different fields, so we handle them individually.
 */
function buildReportSummary(
  reportType: string,
  data: Record<string, unknown> | null | undefined
): string {
  if (!data) return 'Report sent'

  try {
    switch (reportType) {
      case 'assessment-report': {
        const grade = data.overallGrade ?? '?'
        const score = data.overallScore ?? '?'
        const roadmap = data.roadmapCompletion ?? ''
        const dims = Array.isArray(data.dimensions) ? data.dimensions : []
        const billing = dims.find(
          (d: Record<string, unknown>) => d.name === 'Monetization'
        )
        const billingNote = billing
          ? ` · Billing: ${billing.grade}`
          : ''
        return `Grade: ${grade} (${score}/100)${roadmap ? ` · Roadmap: ${roadmap}` : ''}${billingNote}`
      }
      case 'executive-summary': {
        const stats = (data.stats ?? {}) as Record<string, unknown>
        const devices = stats.totalDevices ?? '?'
        const alerts = stats.totalUnresolved ?? 0
        const health = stats.healthStatus ?? 'Unknown'
        const mvp = stats.mvpPct ?? '?'
        return `${health} · ${devices} devices · ${alerts} active alerts · MVP ${mvp}%`
      }
      case 'daily-report': {
        const stats = (data.stats ?? {}) as Record<string, unknown>
        const devices = stats.totalDevices ?? '?'
        const online = stats.onlineDevices ?? '?'
        const alerts = stats.totalUnresolved ?? 0
        const orgs = stats.organizationCount ?? '?'
        return `${online}/${devices} devices online · ${alerts} active alerts · ${orgs} orgs`
      }
      case 'generate-report-summary':
      case 'ai-report-summary': {
        const msg = typeof data.message === 'string' ? data.message : ''
        return msg.slice(0, 120) || 'AI summary generated'
      }
      default: {
        const msg = typeof data.message === 'string' ? data.message : ''
        return msg.slice(0, 120) || 'Report sent'
      }
    }
  } catch {
    return 'Report sent'
  }
}
