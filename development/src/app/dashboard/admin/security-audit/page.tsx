'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useUser } from '@/contexts/UserContext'
import { isPlatformAdmin } from '@/lib/permissions'
import {
  CheckCircle,
  Circle,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'

interface CheckItem {
  id: string
  label: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  howToVerify: string
  docsUrl?: string
}

interface Section {
  title: string
  icon: React.ReactNode
  items: CheckItem[]
}

const AUDIT_SECTIONS: Section[] = [
  {
    title: 'Row-Level Security (RLS)',
    icon: <ShieldCheck className="h-5 w-5" />,
    items: [
      {
        id: 'rls-enabled-organizations',
        label: 'RLS enabled on organizations table',
        description: 'Users should only see their own organization(s)',
        severity: 'critical',
        howToVerify: 'Supabase → Table Editor → organizations → RLS policies',
      },
      {
        id: 'rls-enabled-devices',
        label: 'RLS enabled on devices table',
        description: 'Devices must be scoped to organization membership',
        severity: 'critical',
        howToVerify: 'Supabase → Table Editor → devices → RLS policies',
      },
      {
        id: 'rls-enabled-alerts',
        label: 'RLS enabled on alerts table',
        description: 'Alert rules and events scoped per org',
        severity: 'critical',
        howToVerify: 'Supabase → Table Editor → alerts → RLS policies',
      },
      {
        id: 'rls-enabled-telemetry',
        label: 'RLS enabled on telemetry/readings tables',
        description: 'Raw device data protected by org membership',
        severity: 'critical',
        howToVerify: 'Supabase → Table Editor → telemetry → RLS policies',
      },
      {
        id: 'no-anon-sensitive',
        label: 'No anon/public access to sensitive tables',
        description:
          'Verify anon role has no SELECT on orgs, devices, users, telemetry',
        severity: 'critical',
        howToVerify:
          "Run: SELECT * FROM pg_policies WHERE roles @> ARRAY['anon']",
      },
    ],
  },
  {
    title: 'API Keys & Secrets',
    icon: <ShieldCheck className="h-5 w-5" />,
    items: [
      {
        id: 'no-service-role-client',
        label: 'Service role key not exposed to browser',
        description:
          'SUPABASE_SERVICE_ROLE_KEY must never appear in client bundle',
        severity: 'critical',
        howToVerify: 'grep -r "SUPABASE_SERVICE_ROLE" src/ — should be empty',
      },
      {
        id: 'anon-key-minimal',
        label: 'Anon key has minimal permissions',
        description:
          'Anon key is public — it should only hit public-safe endpoints',
        severity: 'high',
        howToVerify: 'Supabase → Settings → API → check anon key policies',
      },
      {
        id: 'env-not-committed',
        label: '.env files not committed to git',
        description: '.env.local, .env.production must be in .gitignore',
        severity: 'critical',
        howToVerify: 'git log --all -- .env* — should show no tracked files',
      },
      {
        id: 'github-secrets-set',
        label: 'All GitHub Secrets set for all 3 repos',
        description:
          'DEV_, STAGING_, PROD_ prefixed secrets in respective repos',
        severity: 'high',
        howToVerify: 'gh secret list --repo NetNeural/MonoRepo',
      },
    ],
  },
  {
    title: 'Edge Function Security',
    icon: <ShieldCheck className="h-5 w-5" />,
    items: [
      {
        id: 'ef-cors-origins',
        label: 'Edge Functions have restricted CORS origins',
        description:
          'Access-Control-Allow-Origin must not be wildcard (*) for sensitive functions',
        severity: 'high',
        howToVerify: 'Review supabase/functions/*/index.ts for corsHeaders',
      },
      {
        id: 'ef-auth-required',
        label: 'Sensitive Edge Functions verify JWT',
        description:
          'All non-public functions must validate Authorization header',
        severity: 'critical',
        howToVerify:
          'Review each function for createClient with auth.getUser() check',
      },
      {
        id: 'ef-input-validation',
        label: 'Edge Functions validate and sanitize inputs',
        description:
          'No raw SQL from user input; JSON schema validation in place',
        severity: 'high',
        howToVerify: 'Review function handlers for input validation logic',
      },
    ],
  },
  {
    title: 'Storage Bucket Policies',
    icon: <ShieldCheck className="h-5 w-5" />,
    items: [
      {
        id: 'storage-not-public',
        label: 'Sensitive buckets are not public',
        description:
          'organization-assets, avatars etc. should enforce owner access rules',
        severity: 'high',
        howToVerify: 'Supabase → Storage → Policies per bucket',
      },
      {
        id: 'storage-size-limit',
        label: 'Upload size limits configured',
        description: 'Bucket file size limits to prevent abuse',
        severity: 'medium',
        howToVerify: 'Supabase → Storage → Bucket settings → max file size',
      },
    ],
  },
  {
    title: 'Auth Configuration',
    icon: <ShieldCheck className="h-5 w-5" />,
    items: [
      {
        id: 'auth-email-templates',
        label: 'Custom email templates configured',
        description:
          'Invite, password reset, and magic link emails are branded correctly',
        severity: 'medium',
        howToVerify: 'Supabase → Auth → Email Templates',
      },
      {
        id: 'auth-rate-limiting',
        label: 'Rate limiting enabled on auth endpoints',
        description: 'Prevent brute force on login and signup',
        severity: 'high',
        howToVerify: 'Supabase → Auth → Rate Limits configuration',
      },
      {
        id: 'auth-confirm-email',
        label: 'Email confirmation required for signup',
        description: 'Unconfirmed accounts should not access platform',
        severity: 'high',
        howToVerify: 'Supabase → Auth → Email → Confirm email: enabled',
      },
      {
        id: 'auth-session-expiry',
        label: 'JWT expiry set appropriately',
        description:
          'Access token expiry ≤ 1 hour; refresh token rotation enabled',
        severity: 'medium',
        howToVerify: 'Supabase → Auth → JWT expiry settings',
      },
    ],
  },
  {
    title: 'Audit Logging',
    icon: <ShieldCheck className="h-5 w-5" />,
    items: [
      {
        id: 'audit-admin-actions',
        label: 'Admin actions write to audit log',
        description:
          'Super admin operations (tier change, org delete, user ban) logged',
        severity: 'high',
        howToVerify:
          'Check audit_log table; verify trigger or function inserts on sensitive ops',
      },
      {
        id: 'audit-login-events',
        label: 'Login/logout events captured',
        description:
          'Supabase Auth logs or custom table tracks sign-in activity',
        severity: 'medium',
        howToVerify:
          'Supabase → Auth → Users → check last_sign_in_at; or custom audit table',
      },
    ],
  },
]

const SEVERITY_COLORS = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
}

export default function SecurityAuditPage() {
  const { user, loading } = useUser()
  const isSuperAdmin = isPlatformAdmin(user)

  const allIds = AUDIT_SECTIONS.flatMap((s) => s.items.map((i) => i.id))
  const [checked, setChecked] = useState<Set<string>>(new Set())

  // Persist to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('security_audit_v1')
      if (saved) setChecked(new Set(JSON.parse(saved) as string[]))
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try {
        localStorage.setItem('security_audit_v1', JSON.stringify([...next]))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const total = allIds.length
  const done = checked.size
  const pct = Math.round((done / total) * 100)

  const criticalUnchecked = AUDIT_SECTIONS.flatMap((s) => s.items).filter(
    (i) => i.severity === 'critical' && !checked.has(i.id)
  ).length

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
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
            <p className="text-sm text-muted-foreground">
              Security audit requires super admin access.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <ShieldCheck className="h-8 w-8" />
            Security Audit Checklist
          </h2>
          <p className="text-muted-foreground">
            Pre-launch security review — verify all items before going live
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{pct}%</p>
          <p className="text-xs text-muted-foreground">
            {done} / {total} complete
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-3 w-full rounded-full bg-gray-100">
        <div
          className={`h-3 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : pct > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Critical warning */}
      {criticalUnchecked > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 pt-4">
            <XCircle className="h-5 w-5 flex-shrink-0 text-red-600" />
            <p className="text-sm text-red-700">
              <strong>
                {criticalUnchecked} critical item
                {criticalUnchecked > 1 ? 's' : ''}
              </strong>{' '}
              still unchecked. Do not launch until all critical items are
              verified.
            </p>
          </CardContent>
        </Card>
      )}

      {pct === 100 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-3 pt-4">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
            <p className="text-sm font-medium text-green-700">
              All security checks complete — you are cleared for launch!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {AUDIT_SECTIONS.map((section) => {
        const sectionDone = section.items.filter((i) =>
          checked.has(i.id)
        ).length
        return (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {section.icon}
                  {section.title}
                </span>
                <Badge variant="outline">
                  {sectionDone}/{section.items.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${checked.has(item.id) ? 'border-green-200 bg-green-50' : 'hover:bg-muted/50'}`}
                  onClick={() => toggle(item.id)}
                >
                  <Checkbox
                    checked={checked.has(item.id)}
                    onCheckedChange={() => toggle(item.id)}
                    className="mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-sm font-medium ${checked.has(item.id) ? 'text-muted-foreground line-through' : ''}`}
                      >
                        {item.label}
                      </p>
                      <Badge
                        className={`${SEVERITY_COLORS[item.severity]} border text-xs`}
                      >
                        {item.severity}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                    <p className="mt-1 font-mono text-xs text-blue-600">
                      → {item.howToVerify}
                    </p>
                  </div>
                  {item.docsUrl && (
                    <a
                      href={item.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}

      <p className="pb-8 text-xs text-muted-foreground">
        Checklist progress is automatically saved to your browser.
      </p>
    </div>
  )
}

export { SecurityAuditPage }
