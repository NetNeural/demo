'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useUser } from '@/contexts/UserContext'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle,
  Clock,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

interface RunbookStep {
  id: string
  label: string
  detail?: string
  command?: string
  critical?: boolean
}

interface RunbookSection {
  id: string
  title: string
  description?: string
  icon: React.ReactNode
  steps: RunbookStep[]
}

const PRE_LAUNCH: RunbookSection[] = [
  {
    id: 'pre-database',
    title: 'Database Readiness',
    icon: <CheckCircle className="h-5 w-5" />,
    steps: [
      { id: 'db-migrations', label: 'All migrations applied to production Supabase', command: 'npx supabase link --project-ref bldojxpockljyivldxwf && echo "y" | npx supabase db push --linked', critical: true },
      { id: 'db-rls', label: 'RLS verified on all sensitive tables (see Security Audit page)', critical: true },
      { id: 'db-indexes', label: 'Performance indexes applied (devices.org_id, telemetry.device_id, etc.)' },
      { id: 'db-backups', label: 'Supabase PITR enabled on production project', critical: true, detail: 'Supabase → Settings → Database → Point in Time Recovery' },
    ],
  },
  {
    id: 'pre-env',
    title: 'Environment & Secrets',
    icon: <CheckCircle className="h-5 w-5" />,
    steps: [
      { id: 'env-prod-secrets', label: 'All PROD_ GitHub Secrets set in MonoRepo', command: 'gh secret list --repo NetNeural/MonoRepo', critical: true },
      { id: 'env-no-staging-keys', label: 'Production build does not contain staging/dev Supabase URL', critical: true, detail: 'grep SUPABASE_URL in build output → should show bldojxpockljyivldxwf' },
      { id: 'env-golioth', label: 'Golioth API key valid and scoped to production project' },
    ],
  },
  {
    id: 'pre-build',
    title: 'Build Verification',
    icon: <CheckCircle className="h-5 w-5" />,
    steps: [
      { id: 'build-passes', label: 'npm run build succeeds with zero TypeScript errors', command: 'cd development && npm run build', critical: true },
      { id: 'build-lint', label: 'npm run lint — no errors', command: 'cd development && npm run lint' },
      { id: 'build-size', label: 'Bundle sizes within acceptable bounds', detail: 'Check .next/analyze output — no chunk > 2MB' },
    ],
  },
  {
    id: 'pre-security',
    title: 'Security Sign-off',
    icon: <CheckCircle className="h-5 w-5" />,
    steps: [
      { id: 'sec-audit-complete', label: 'Security Audit Checklist 100% complete', critical: true },
      { id: 'sec-csp', label: 'Content Security Policy headers correct in next.config.js', critical: true },
      { id: 'sec-cors', label: 'Edge Function CORS origins limited to production domain', critical: true },
    ],
  },
]

const DNS_CUTOVER: RunbookSection[] = [
  {
    id: 'dns-prep',
    title: 'DNS Cutover Steps',
    icon: <ArrowRight className="h-5 w-5" />,
    steps: [
      { id: 'dns-ttl', label: 'Lower DNS TTL to 60 seconds 24h before cutover', detail: 'Reduces cache propagation time during switch' },
      { id: 'dns-cname', label: 'Confirm GitHub Pages CNAME record is set to NetNeural.github.io', command: 'nslookup sentinel.netneural.ai' },
      { id: 'dns-ssl', label: 'HTTPS certificate provisioned by GitHub Pages for custom domain', critical: true },
      { id: 'dns-verify', label: 'curl -I https://sentinel.netneural.ai — expect HTTP 200', command: 'curl -I https://sentinel.netneural.ai', critical: true },
      { id: 'dns-ttl-restore', label: 'Restore TTL to 3600 after successful cutover' },
    ],
  },
]

const SMOKE_TEST: RunbookSection[] = [
  {
    id: 'smoke-auth',
    title: 'Auth Smoke Test',
    icon: <CheckCircle className="h-5 w-5" />,
    steps: [
      { id: 'smoke-login', label: 'Login with super admin account succeeds', critical: true },
      { id: 'smoke-invite', label: 'Invite a new user email flow works end-to-end', critical: true },
      { id: 'smoke-logout', label: 'Logout redirects to login page' },
    ],
  },
  {
    id: 'smoke-platform',
    title: 'Platform Smoke Test',
    icon: <CheckCircle className="h-5 w-5" />,
    steps: [
      { id: 'smoke-org-create', label: 'Create a test organization successfully', critical: true },
      { id: 'smoke-device-add', label: 'Add a device to the organization', critical: true },
      { id: 'smoke-alert-create', label: 'Create an alert rule — verify it evaluates' },
      { id: 'smoke-telemetry', label: 'Telemetry from a device appears on dashboard' },
      { id: 'smoke-health', label: 'Platform Health page shows all components healthy' },
    ],
  },
]

const POST_LAUNCH: RunbookSection[] = [
  {
    id: 'post-24h',
    title: '24-Hour Checks',
    icon: <Clock className="h-5 w-5" />,
    steps: [
      { id: '24h-errors', label: 'Review Supabase dashboard for unexpected DB errors' },
      { id: '24h-ef-errors', label: 'Edge Function error rate < 1%', detail: 'Supabase → Functions → error rate graph' },
      { id: '24h-auth', label: 'Auth rate-limit events within expected range' },
      { id: '24h-storage', label: 'Storage bucket usage within expected bounds' },
    ],
  },
  {
    id: 'post-48h',
    title: '48-Hour Checks',
    icon: <Clock className="h-5 w-5" />,
    steps: [
      { id: '48h-perf', label: 'No p95 API latency regressions from baseline' },
      { id: '48h-users', label: 'Onboarded users successfully creating devices' },
      { id: '48h-billing', label: 'Supabase usage metrics within expected plan limits' },
    ],
  },
  {
    id: 'post-7d',
    title: '7-Day Checks',
    icon: <Clock className="h-5 w-5" />,
    steps: [
      { id: '7d-retention', label: 'User retention metrics reviewed' },
      { id: '7d-db-growth', label: 'Database row growth within projections' },
      { id: '7d-alerts', label: 'Alert evaluation pipeline healthy — no backlog' },
      { id: '7d-review', label: 'Post-launch retrospective scheduled' },
    ],
  },
]

const ROLLBACK: RunbookSection[] = [
  {
    id: 'rollback-triggers',
    title: 'Rollback Triggers',
    description: 'Initiate rollback if ANY of the following occur:',
    icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
    steps: [
      { id: 'rb-t1', label: 'Database error rate > 5% for more than 5 minutes', critical: true },
      { id: 'rb-t2', label: 'Auth service returning errors for > 2 minutes', critical: true },
      { id: 'rb-t3', label: 'Data loss or unauthorized access detected', critical: true },
      { id: 'rb-t4', label: 'Edge Function p95 latency > 10s sustained' },
    ],
  },
  {
    id: 'rollback-procedure',
    title: 'Rollback Procedure',
    icon: <RefreshCw className="h-5 w-5 text-red-500" />,
    steps: [
      { id: 'rb-1', label: 'Identify last known-good commit hash', command: 'git log --oneline -10', critical: true },
      { id: 'rb-2', label: 'Revert to previous deployment on all 3 repos', command: 'git revert HEAD && git push origin staging && git push demo staging:main --force && git push monorepo staging:main --force', critical: true },
      { id: 'rb-3', label: 'If DB migration was applied — run down migration', command: 'npx supabase migration repair --status reverted <version>', critical: true },
      { id: 'rb-4', label: 'Notify users via status page / in-app banner' },
      { id: 'rb-5', label: 'Document incident: root cause, impact duration, remediation' },
    ],
  },
]

const ALL_SECTIONS = [...PRE_LAUNCH, ...DNS_CUTOVER, ...SMOKE_TEST, ...POST_LAUNCH, ...ROLLBACK]

export default function RunbookPage() {
  const { user, loading } = useUser()
  const isSuperAdmin = user?.isSuperAdmin || false
  const [checked, setChecked] = useState<Set<string>>(new Set())

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('go_live_runbook_v1')
      if (saved) setChecked(new Set(JSON.parse(saved) as string[]))
    } catch { /* ignore */ }
  }, [])

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try { localStorage.setItem('go_live_runbook_v1', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }

  const allIds = ALL_SECTIONS.flatMap(s => s.steps.map(i => i.id))
  const total = allIds.length
  const done = checked.size
  const pct = Math.round((done / total) * 100)

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Super Admin Only</p>
          </div>
        </div>
      </div>
    )
  }

  const renderSection = (section: RunbookSection, isRollback = false) => {
    const sectionDone = section.steps.filter(i => checked.has(i.id)).length
    return (
      <Card key={section.id} className={isRollback ? 'border-red-200' : ''}>
        <CardHeader>
          <CardTitle className={`flex items-center justify-between ${isRollback ? 'text-red-700' : ''}`}>
            <span className="flex items-center gap-2">{section.icon}{section.title}</span>
            <Badge variant="outline">{sectionDone}/{section.steps.length}</Badge>
          </CardTitle>
          {section.description && (
            <CardDescription className="font-medium text-orange-600">{section.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {section.steps.map(step => (
            <div
              key={step.id}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${checked.has(step.id) ? 'bg-green-50 border-green-200' : isRollback ? 'bg-red-50/30 hover:bg-red-50' : 'hover:bg-muted/50'}`}
              onClick={() => toggle(step.id)}
            >
              <Checkbox
                checked={checked.has(step.id)}
                onCheckedChange={() => toggle(step.id)}
                className="mt-0.5"
                onClick={e => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-medium text-sm ${checked.has(step.id) ? 'line-through text-muted-foreground' : ''}`}>
                    {step.label}
                  </p>
                  {step.critical && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 border text-xs">critical</Badge>
                  )}
                </div>
                {step.detail && <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>}
                {step.command && (
                  <code className="text-xs bg-gray-100 text-gray-800 rounded px-2 py-0.5 mt-1 block font-mono">
                    {step.command}
                  </code>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Go-Live Runbook
          </h2>
          <p className="text-muted-foreground">Pre-launch checklist, DNS cutover, smoke tests, and rollback plan</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{pct}%</p>
          <p className="text-xs text-muted-foreground">{done} / {total} complete</p>
        </div>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-100 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 60 ? 'bg-yellow-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {pct === 100 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 font-medium">Runbook complete — you are cleared for launch!</p>
          </CardContent>
        </Card>
      )}

      {/* Pre-Launch */}
      <div>
        <h3 className="text-xl font-semibold mb-3">Pre-Launch Verification</h3>
        <div className="space-y-4">{PRE_LAUNCH.map(s => renderSection(s))}</div>
      </div>

      {/* DNS */}
      <div>
        <h3 className="text-xl font-semibold mb-3">DNS Cutover</h3>
        <div className="space-y-4">{DNS_CUTOVER.map(s => renderSection(s))}</div>
      </div>

      {/* Smoke Test */}
      <div>
        <h3 className="text-xl font-semibold mb-3">Smoke Tests</h3>
        <div className="space-y-4">{SMOKE_TEST.map(s => renderSection(s))}</div>
      </div>

      {/* Post-Launch */}
      <div>
        <h3 className="text-xl font-semibold mb-3">Post-Launch Monitoring</h3>
        <div className="space-y-4">{POST_LAUNCH.map(s => renderSection(s))}</div>
      </div>

      {/* Rollback */}
      <div>
        <h3 className="text-xl font-semibold mb-3 text-red-700 flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          Rollback Plan
        </h3>
        <div className="space-y-4">{ROLLBACK.map(s => renderSection(s, true))}</div>
      </div>

      <p className="text-xs text-muted-foreground pb-8">
        Checklist progress is automatically saved to your browser.
      </p>
    </div>
  )
}
