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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { isPlatformAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import {
  Shield,
  Save,
  RotateCcw,
  Info,
  CheckCircle2,
  XCircle,
  Building2,
  Crown,
  Loader2,
} from 'lucide-react'
import type { OrganizationRole } from '@/types/organization'
import {
  getOrganizationPermissions,
  getRoleDisplayInfo,
} from '@/types/organization'

// ─── Types ───────────────────────────────────────────────────────────────────

type AccessLevel = 'enabled' | 'netneural_only' | 'superadmin_only' | 'disabled'

interface FeatureRow {
  id: string
  label: string
  description: string
  category: string
  type: 'nav' | 'action'
  /** Code-level defaults per role (before any DB overrides) */
  codeDefaults: Record<AllRole, AccessLevel>
}

type AllRole = OrganizationRole | 'super_admin'

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_ROLES: AllRole[] = [
  'viewer',
  'member',
  'admin',
  'owner',
  'billing',
  'super_admin',
]

const ROLE_COLORS: Record<AllRole, string> = {
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  member: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  owner: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  billing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  super_admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const ACCESS_LEVELS: AccessLevel[] = [
  'enabled',
  'netneural_only',
  'superadmin_only',
  'disabled',
]

const ACCESS_CONFIG: Record<
  AccessLevel,
  { label: string; shortLabel: string; icon: React.ReactNode; classes: string }
> = {
  enabled: {
    label: 'Enabled (all orgs)',
    shortLabel: 'Enabled',
    icon: <CheckCircle2 className="h-4 w-4" />,
    classes: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/40',
  },
  netneural_only: {
    label: 'NetNeural org only',
    shortLabel: 'NN Only',
    icon: <Building2 className="h-4 w-4" />,
    classes: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/40',
  },
  superadmin_only: {
    label: 'Super Admin only',
    shortLabel: 'SA Only',
    icon: <Crown className="h-4 w-4" />,
    classes: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/40',
  },
  disabled: {
    label: 'Disabled / Hidden',
    shortLabel: 'Hidden',
    icon: <XCircle className="h-4 w-4" />,
    classes: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/40',
  },
}

// ─── Default NAV features ─────────────────────────────────────────────────────

const ALL_ENABLED: Record<AllRole, AccessLevel> = {
  viewer: 'enabled',
  member: 'enabled',
  admin: 'enabled',
  owner: 'enabled',
  billing: 'enabled',
  super_admin: 'enabled',
}

const SUPERADMIN_ONLY: Record<AllRole, AccessLevel> = {
  viewer: 'superadmin_only',
  member: 'superadmin_only',
  admin: 'superadmin_only',
  owner: 'superadmin_only',
  billing: 'superadmin_only',
  super_admin: 'enabled',
}

const NETNEURAL_OWNER_SA: Record<AllRole, AccessLevel> = {
  viewer: 'netneural_only',
  member: 'netneural_only',
  admin: 'netneural_only',
  owner: 'netneural_only',
  billing: 'netneural_only',
  super_admin: 'enabled',
}

function buildActionDefaults(
  key: keyof ReturnType<typeof getOrganizationPermissions>
): Record<AllRole, AccessLevel> {
  const roles: OrganizationRole[] = [
    'viewer',
    'member',
    'admin',
    'owner',
    'billing',
  ]
  const result: Record<AllRole, AccessLevel> = {
    viewer: 'disabled',
    member: 'disabled',
    admin: 'disabled',
    owner: 'disabled',
    billing: 'disabled',
    super_admin: 'enabled',
  }
  for (const role of roles) {
    result[role] = getOrganizationPermissions(role)[key]
      ? 'enabled'
      : 'disabled'
  }
  return result
}

const NAV_FEATURES: FeatureRow[] = [
  // Core
  {
    id: 'nav:dashboard',
    label: 'Dashboard',
    description: 'Main overview / home page',
    category: 'Core',
    type: 'nav',
    codeDefaults: { ...ALL_ENABLED },
  },
  {
    id: 'nav:devices',
    label: 'Devices',
    description: 'View and manage connected devices',
    category: 'Core',
    type: 'nav',
    codeDefaults: { ...ALL_ENABLED },
  },
  {
    id: 'nav:device-types',
    label: 'Device Types',
    description: 'Configure device type schemas',
    category: 'Core',
    type: 'nav',
    codeDefaults: { ...ALL_ENABLED },
  },
  {
    id: 'nav:alerts',
    label: 'Alerts',
    description: 'View and configure alert rules',
    category: 'Core',
    type: 'nav',
    codeDefaults: { ...ALL_ENABLED },
  },
  {
    id: 'nav:analytics',
    label: 'AI Analytics',
    description: 'AI-powered analytics dashboards',
    category: 'Core',
    type: 'nav',
    codeDefaults: { ...ALL_ENABLED },
  },
  {
    id: 'nav:reports',
    label: 'Reports',
    description: 'Scheduled and custom reports',
    category: 'Core',
    type: 'nav',
    codeDefaults: { ...ALL_ENABLED },
  },
  {
    id: 'nav:organizations',
    label: 'Organization',
    description: 'Org settings, members, and integrations',
    category: 'Core',
    type: 'nav',
    codeDefaults: { ...ALL_ENABLED },
  },
  {
    id: 'nav:feedback',
    label: 'Feedback',
    description: 'Submit product feedback',
    category: 'Core',
    type: 'nav',
    codeDefaults: { ...ALL_ENABLED },
  },
  {
    id: 'nav:settings',
    label: 'Personal Settings',
    description: 'User profile and preferences',
    category: 'Core',
    type: 'nav',
    codeDefaults: { ...ALL_ENABLED },
  },
  // NetNeural / Billing
  {
    id: 'nav:plans-pricing',
    label: 'Plans & Pricing',
    description: 'Subscription plan management (NetNeural org, owner+)',
    category: 'Billing',
    type: 'nav',
    codeDefaults: {
      viewer: 'netneural_only',
      member: 'netneural_only',
      admin: 'netneural_only',
      owner: 'netneural_only',
      billing: 'netneural_only',
      super_admin: 'enabled',
    },
  },
  {
    id: 'nav:billing',
    label: 'Billing Administration',
    description: 'Invoices, usage, revenue (NetNeural org, owner/billing+)',
    category: 'Billing',
    type: 'nav',
    codeDefaults: {
      viewer: 'disabled',
      member: 'disabled',
      admin: 'disabled',
      owner: 'netneural_only',
      billing: 'netneural_only',
      super_admin: 'enabled',
    },
  },
  // Support
  {
    id: 'nav:support',
    label: 'Support',
    description: 'Help desk and support tickets',
    category: 'Support',
    type: 'nav',
    codeDefaults: {
      viewer: 'disabled',
      member: 'disabled',
      admin: 'enabled',
      owner: 'enabled',
      billing: 'disabled',
      super_admin: 'enabled',
    },
  },
  // Reseller
  {
    id: 'nav:reseller',
    label: 'Reseller Hub',
    description: 'Reseller management (reseller/enterprise tier orgs only)',
    category: 'Reseller',
    type: 'nav',
    codeDefaults: {
      viewer: 'disabled',
      member: 'disabled',
      admin: 'disabled',
      owner: 'netneural_only',
      billing: 'disabled',
      super_admin: 'enabled',
    },
  },
  {
    id: 'nav:reseller-invite',
    label: 'Invite Partners',
    description: 'Send reseller invitations (reseller/enterprise tier only)',
    category: 'Reseller',
    type: 'nav',
    codeDefaults: {
      viewer: 'disabled',
      member: 'disabled',
      admin: 'disabled',
      owner: 'netneural_only',
      billing: 'disabled',
      super_admin: 'enabled',
    },
  },
  // Admin
  {
    id: 'nav:admin:customers',
    label: 'Customers',
    description: 'Customer org management (super admin only)',
    category: 'Admin',
    type: 'nav',
    codeDefaults: { ...SUPERADMIN_ONLY },
  },
  {
    id: 'nav:admin:platform-health',
    label: 'Platform Health',
    description: 'System health and uptime monitoring (super admin only)',
    category: 'Admin',
    type: 'nav',
    codeDefaults: { ...SUPERADMIN_ONLY },
  },
  {
    id: 'nav:admin:security-audit',
    label: 'Security Audit',
    description: 'SOC 2 security checklist (super admin only)',
    category: 'Admin',
    type: 'nav',
    codeDefaults: { ...SUPERADMIN_ONLY },
  },
  {
    id: 'nav:admin:go-live-runbook',
    label: 'Go-Live Runbook',
    description: 'Deployment checklist (super admin only)',
    category: 'Admin',
    type: 'nav',
    codeDefaults: { ...SUPERADMIN_ONLY },
  },
  {
    id: 'nav:admin:hydra-kpis',
    label: 'Hydra KPIs',
    description: 'Internal KPI tracking (super admin only)',
    category: 'Admin',
    type: 'nav',
    codeDefaults: { ...SUPERADMIN_ONLY },
  },
  {
    id: 'nav:admin:onboarding',
    label: 'Onboarding',
    description: 'Customer onboarding progress (super admin only)',
    category: 'Admin',
    type: 'nav',
    codeDefaults: { ...SUPERADMIN_ONLY },
  },
  {
    id: 'nav:admin:permissions',
    label: 'Permission Manager',
    description: 'This page — feature permissions matrix (super admin only)',
    category: 'Admin',
    type: 'nav',
    codeDefaults: { ...SUPERADMIN_ONLY },
  },
]

const ACTION_FEATURES: FeatureRow[] = [
  {
    id: 'action:canManageMembers',
    label: 'Manage Members',
    description: 'Full member management (invite + remove)',
    category: 'Members',
    type: 'action',
    codeDefaults: buildActionDefaults('canManageMembers'),
  },
  {
    id: 'action:canInviteMembers',
    label: 'Invite Members',
    description: 'Send invitations to join the org',
    category: 'Members',
    type: 'action',
    codeDefaults: buildActionDefaults('canInviteMembers'),
  },
  {
    id: 'action:canRemoveMembers',
    label: 'Remove Members',
    description: 'Remove users from the org',
    category: 'Members',
    type: 'action',
    codeDefaults: buildActionDefaults('canRemoveMembers'),
  },
  {
    id: 'action:canManageDevices',
    label: 'Manage Devices',
    description: 'Add, edit, and delete devices',
    category: 'Devices',
    type: 'action',
    codeDefaults: buildActionDefaults('canManageDevices'),
  },
  {
    id: 'action:canManageLocations',
    label: 'Manage Locations',
    description: 'Create and edit location groups',
    category: 'Devices',
    type: 'action',
    codeDefaults: buildActionDefaults('canManageLocations'),
  },
  {
    id: 'action:canManageIntegrations',
    label: 'Manage Integrations',
    description: 'Configure third-party integrations',
    category: 'Integrations',
    type: 'action',
    codeDefaults: buildActionDefaults('canManageIntegrations'),
  },
  {
    id: 'action:canConfigureAlerts',
    label: 'Configure Alerts',
    description: 'Create and modify alert rules',
    category: 'Alerts',
    type: 'action',
    codeDefaults: buildActionDefaults('canConfigureAlerts'),
  },
  {
    id: 'action:canViewBilling',
    label: 'View Billing',
    description: 'View invoices and billing history',
    category: 'Billing',
    type: 'action',
    codeDefaults: buildActionDefaults('canViewBilling'),
  },
  {
    id: 'action:canManageBilling',
    label: 'Manage Billing',
    description: 'Update payment methods and subscriptions',
    category: 'Billing',
    type: 'action',
    codeDefaults: buildActionDefaults('canManageBilling'),
  },
  {
    id: 'action:canUpdateSettings',
    label: 'Update Org Settings',
    description: 'Edit org branding, timezone, and configuration',
    category: 'Settings',
    type: 'action',
    codeDefaults: buildActionDefaults('canUpdateSettings'),
  },
  {
    id: 'action:canDeleteOrganization',
    label: 'Delete Organization',
    description: 'Permanently delete the organization',
    category: 'Settings',
    type: 'action',
    codeDefaults: buildActionDefaults('canDeleteOrganization'),
  },
  {
    id: 'action:canViewAuditLogs',
    label: 'View Audit Logs',
    description: 'Read security and access audit logs',
    category: 'Security',
    type: 'action',
    codeDefaults: buildActionDefaults('canViewAuditLogs'),
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce(
    (acc, item) => {
      const k = key(item)
      if (!acc[k]) acc[k] = []
      acc[k].push(item)
      return acc
    },
    {} as Record<string, T[]>
  )
}

function nextAccessLevel(current: AccessLevel): AccessLevel {
  const idx = ACCESS_LEVELS.indexOf(current)
  return (
    ACCESS_LEVELS[(idx + 1) % ACCESS_LEVELS.length] ??
    ACCESS_LEVELS[0] ??
    'enabled'
  )
}

// ─── AccessCell ───────────────────────────────────────────────────────────────

function AccessCell({
  level,
  isDefault,
  onClick,
  readOnly,
}: {
  level: AccessLevel
  isDefault: boolean
  onClick: () => void
  readOnly?: boolean
}) {
  const cfg = ACCESS_CONFIG[level]
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={readOnly ? undefined : onClick}
            disabled={readOnly}
            className={`flex w-full items-center justify-center gap-1 rounded border px-1.5 py-1 text-xs font-medium transition-colors ${cfg.classes} ${readOnly ? 'cursor-default opacity-70' : 'cursor-pointer'} ${!isDefault ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
            aria-label={cfg.label}
          >
            {cfg.icon}
            <span className="hidden lg:inline">{cfg.shortLabel}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className="font-semibold">{cfg.label}</p>
          {!isDefault && (
            <p className="mt-1 text-orange-300">
              ⚠ Override active (differs from code default)
            </p>
          )}
          {!readOnly && (
            <p className="mt-1 text-muted-foreground">
              Click to cycle to next state
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── PermissionMatrix ─────────────────────────────────────────────────────────

function PermissionMatrix({
  features,
  overrides,
  onCellChange,
  readOnly,
}: {
  features: FeatureRow[]
  overrides: Record<string, Record<AllRole, AccessLevel>>
  onCellChange: (featureId: string, role: AllRole, level: AccessLevel) => void
  readOnly?: boolean
}) {
  const groups = groupBy(features, (f) => f.category)

  const getLevel = (feature: FeatureRow, role: AllRole): AccessLevel => {
    return overrides[feature.id]?.[role] ?? feature.codeDefaults[role]
  }

  const isDefault = (feature: FeatureRow, role: AllRole): boolean => {
    const overrideMap = overrides[feature.id]
    if (!overrideMap) return true
    const val = overrideMap[role]
    if (val === undefined) return true
    return val === feature.codeDefaults[role]
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="sticky left-0 z-10 min-w-[200px] bg-muted/50 px-4 py-3 text-left font-semibold">
              Feature
            </th>
            {ALL_ROLES.map((role) => {
              const info =
                role === 'super_admin'
                  ? { label: 'Super Admin', color: 'red' }
                  : getRoleDisplayInfo(role as OrganizationRole)
              return (
                <th
                  key={role}
                  className="min-w-[100px] px-2 py-3 text-center font-semibold"
                >
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}
                  >
                    {info.label}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {Object.entries(groups).map(([category, rows]) => (
            <>
              <tr key={`cat-${category}`} className="border-b bg-muted/30">
                <td
                  colSpan={ALL_ROLES.length + 1}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground"
                >
                  {category}
                </td>
              </tr>
              {rows.map((feature) => (
                <tr
                  key={feature.id}
                  className="border-b transition-colors hover:bg-muted/20"
                >
                  <td className="sticky left-0 z-10 bg-background px-4 py-2">
                    <div className="flex items-start gap-2">
                      <div>
                        <p className="font-medium">{feature.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </td>
                  {ALL_ROLES.map((role) => (
                    <td key={role} className="px-2 py-2 text-center">
                      <AccessCell
                        level={getLevel(feature, role)}
                        isDefault={isDefault(feature, role)}
                        readOnly={readOnly}
                        onClick={() => {
                          const current = getLevel(feature, role)
                          onCellChange(
                            feature.id,
                            role,
                            nextAccessLevel(current)
                          )
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const { user, loading } = useUser()
  const { currentOrganization, userRole } = useOrganization()
  const isSuperAdmin = isPlatformAdmin(user, currentOrganization?.id, userRole)

  const [overrides, setOverrides] = useState<
    Record<string, Record<AllRole, AccessLevel>>
  >({})
  const [originalOverrides, setOriginalOverrides] = useState<
    Record<string, Record<AllRole, AccessLevel>>
  >({})
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const supabase = createClient()

  // Load DB overrides
  useEffect(() => {
    if (!isSuperAdmin) return

    async function load() {
      setLoadingData(true)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('feature_permissions')
          .select('feature_id, role, access_level')

        if (error) throw error

        const map: Record<string, Record<AllRole, AccessLevel>> = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const row of (data ?? []) as any[]) {
          if (!map[row.feature_id]) {
            map[row.feature_id] = {} as Record<AllRole, AccessLevel>
          }
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          map[row.feature_id]![row.role as AllRole] =
            row.access_level as AccessLevel
        }
        setOverrides(map)
        setOriginalOverrides(JSON.parse(JSON.stringify(map)))
      } catch (err) {
        console.error('Failed to load feature permissions:', err)
      } finally {
        setLoadingData(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin])

  const handleCellChange = useCallback(
    (featureId: string, role: AllRole, level: AccessLevel) => {
      setOverrides((prev) => {
        const existing = (prev[featureId] ?? {}) as Record<AllRole, AccessLevel>
        return {
          ...prev,
          [featureId]: {
            ...existing,
            [role]: level,
          } as Record<AllRole, AccessLevel>,
        }
      })
    },
    []
  )

  const handleSave = async () => {
    setSaving(true)
    setSaveMessage(null)

    // Build upsert rows for every cell that differs from code default
    const allFeatures = [...NAV_FEATURES, ...ACTION_FEATURES]
    const upsertRows: {
      feature_id: string
      feature_type: string
      role: string
      access_level: string
      updated_by: string
    }[] = []

    for (const feature of allFeatures) {
      for (const role of ALL_ROLES) {
        const current = overrides[feature.id]?.[role]
        if (current !== undefined) {
          upsertRows.push({
            feature_id: feature.id,
            feature_type: feature.type,
            role,
            access_level: current,
            updated_by: user?.id ?? '',
          })
        }
      }
    }

    try {
      if (upsertRows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('feature_permissions')
          .upsert(upsertRows, { onConflict: 'feature_id,role' })
        if (error) throw error
      }

      setOriginalOverrides(JSON.parse(JSON.stringify(overrides)))
      setSaveMessage({
        type: 'success',
        text: 'Permissions saved successfully.',
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setSaveMessage({ type: 'error', text: `Save failed: ${message}` })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMessage(null), 5000)
    }
  }

  const handleReset = () => {
    setOverrides(JSON.parse(JSON.stringify(originalOverrides)))
    setSaveMessage(null)
  }

  const hasChanges =
    JSON.stringify(overrides) !== JSON.stringify(originalOverrides)

  // ── Guards ──
  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <Shield className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Restricted</h2>
        <p className="text-muted-foreground">
          This page is only accessible to Platform Admins.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Permission Manager</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            View and override which roles can access each feature. Changes are
            stored as DB overrides — the underlying code defaults are shown for
            reference but may not reflect live gating logic until consumed by
            app code.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Save feedback */}
      {saveMessage && (
        <div
          className={`rounded-md border px-4 py-2 text-sm ${
            saveMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-700 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
          <Info className="h-4 w-4 shrink-0" />
          You have unsaved changes. Click&nbsp;<strong>Save Changes</strong>
          &nbsp;to persist them.
        </div>
      )}

      {/* Legend */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Access Level Legend</CardTitle>
          <CardDescription className="text-xs">
            Click any cell to cycle through access levels. Cells with an orange
            ring differ from the code default.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ACCESS_LEVELS.map((level) => {
              const cfg = ACCESS_CONFIG[level]
              return (
                <div
                  key={level}
                  className={`flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium ${cfg.classes}`}
                >
                  {cfg.icon}
                  {cfg.label}
                </div>
              )
            })}
            <div className="flex items-center gap-1.5 rounded border border-orange-300 px-2.5 py-1 text-xs font-medium text-orange-700 ring-2 ring-orange-400 ring-offset-1">
              <Info className="h-3.5 w-3.5" />
              Orange ring = DB override active
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matrix Tabs */}
      {loadingData ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading permission overrides…
          </span>
        </div>
      ) : (
        <Tabs defaultValue="nav">
          <TabsList>
            <TabsTrigger value="nav">Navigation Access</TabsTrigger>
            <TabsTrigger value="action">Action Permissions</TabsTrigger>
          </TabsList>

          {/* Navigation Tab */}
          <TabsContent value="nav" className="mt-4 space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>Navigation Access:</strong> Controls which sidebar links
                are visible per role.
                <br />
                <span className="text-xs">
                  <em>NetNeural Only</em> — shown only when the NetNeural root
                  org is active. <em>Super Admin Only</em> — shown only when
                  isSuperAdmin = true regardless of org role.
                </span>
              </div>
            </div>
            <PermissionMatrix
              features={NAV_FEATURES}
              overrides={overrides}
              onCellChange={handleCellChange}
            />
          </TabsContent>

          {/* Action Permissions Tab */}
          <TabsContent value="action" className="mt-4 space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>Action Permissions:</strong> Maps to the{' '}
                <code>OrganizationPermissions</code> interface computed by{' '}
                <code>getOrganizationPermissions(role)</code>.
                <br />
                <span className="text-xs">
                  Code defaults are shown. DB overrides stored here are
                  available via the <code>feature_permissions</code> table for
                  custom runtime enforcement.
                </span>
              </div>
            </div>
            <PermissionMatrix
              features={ACTION_FEATURES}
              overrides={overrides}
              onCellChange={handleCellChange}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Role Summary Cards */}
      <div>
        <h2 className="mb-3 text-base font-semibold">Role Descriptions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ALL_ROLES.map((role) => {
            const info =
              role === 'super_admin'
                ? {
                    label: 'Super Admin',
                    color: 'red',
                    description: 'Full platform access, crosses org boundaries',
                  }
                : getRoleDisplayInfo(role as OrganizationRole)
            return (
              <Card key={role} className="p-3">
                <Badge
                  variant="outline"
                  className={`mb-2 w-full justify-center text-xs font-semibold ${ROLE_COLORS[role]}`}
                >
                  {info.label}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {info.description}
                </p>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
