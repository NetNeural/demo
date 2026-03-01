'use client'

import { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { InvoiceTable } from '@/components/billing/InvoiceTable'
import { PaymentTable } from '@/components/billing/PaymentTable'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { edgeFunctions } from '@/lib/edge-functions'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ExternalLink,
  FileBarChart,
  TrendingUp,
  CreditCard,
  FileText,
  ShieldAlert,
  Building2,
  DollarSign,
  Users,
  BarChart3,
  Repeat,
  Settings,
  Wrench,
  Tag,
  Power,
  FlaskConical,
  Zap,
} from 'lucide-react'

import { RevenueTab } from './components/RevenueTab'
import { FinancialReportsTab } from './components/FinancialReportsTab'
import { SubscriptionsTab } from './components/SubscriptionsTab'
import { UsageMeteringTab } from './components/UsageMeteringTab'
import { CustomersTab } from './components/CustomersTab'
import { PlanManagementTab } from './components/PlanManagementTab'
import { BillingOperationsTab } from './components/BillingOperationsTab'
import { PromoCodesTab } from './components/PromoCodesTab'

const NETNEURAL_ROOT_ORG_ID = '00000000-0000-0000-0000-000000000001'

type BillingMode = 'off' | 'testing' | 'live'

const BILLING_MODES: { value: BillingMode; label: string; icon: typeof Power; color: string; bg: string; description: string }[] = [
  { value: 'off', label: 'Off', icon: Power, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', description: 'Billing disabled — no charges processed' },
  { value: 'testing', label: 'Testing', icon: FlaskConical, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950', description: 'Stripe test mode — sandbox charges only' },
  { value: 'live', label: 'Live', icon: Zap, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950', description: 'Production billing — real charges active' },
]

// ── Tab configuration (mirrors the support page pattern) ─────────────
const billingTabs = [
  {
    id: 'financial-reports',
    label: 'Financial Reports',
    icon: FileBarChart,
    ownerOnly: true,
  },
  {
    id: 'revenue',
    label: 'Revenue',
    icon: TrendingUp,
    ownerOnly: true,
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    icon: Repeat,
    ownerOnly: true,
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    ownerOnly: true,
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: FileText,
    ownerOnly: true,
  },
  {
    id: 'usage',
    label: 'Usage Metering',
    icon: BarChart3,
    ownerOnly: true,
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    ownerOnly: true,
  },
  {
    id: 'plan-management',
    label: 'Plan Management',
    icon: Settings,
    ownerOnly: true,
  },
  {
    id: 'operations',
    label: 'Billing Ops',
    icon: Wrench,
    ownerOnly: true,
  },
  {
    id: 'promo-codes',
    label: 'Promo Codes',
    icon: Tag,
    ownerOnly: true,
  },
]

export default function BillingAdministrationPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BillingAdminContent />
    </Suspense>
  )
}

function BillingAdminContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization, isLoading, userRole, permissions } = useOrganization()
  const { user, loading: userLoading } = useUser()
  const isSuperAdmin = user?.isSuperAdmin || false

  // URL-synced tab state (same pattern as support page)
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return searchParams.get('tab') || 'financial-reports'
    }
    return 'financial-reports'
  })

  // Update activeTab when URL parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle tab change — update both state and URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  // ── Stripe Customer Portal (hooks must be before early returns) ───
  const [portalLoading, setPortalLoading] = useState(false)

  // ── Billing Mode Toggle (super admin only) ───
  const [billingMode, setBillingMode] = useState<BillingMode>('off')
  const [billingModeLoading, setBillingModeLoading] = useState(true)
  const [billingModeSaving, setBillingModeSaving] = useState(false)
  const supabase = createClient()

  // Load billing mode from org settings
  useEffect(() => {
    async function loadBillingMode() {
      try {
        const { data } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', NETNEURAL_ROOT_ORG_ID)
          .single()
        const mode = (data?.settings as Record<string, unknown>)?.billing_mode as BillingMode
        if (mode && ['off', 'testing', 'live'].includes(mode)) {
          setBillingMode(mode)
        }
      } catch (err) {
        console.error('Failed to load billing mode:', err)
      } finally {
        setBillingModeLoading(false)
      }
    }
    loadBillingMode()
  }, [supabase])

  const handleBillingModeChange = useCallback(async (newMode: BillingMode) => {
    if (!isSuperAdmin) return
    if (newMode === billingMode) return

    // Confirmation for going live
    if (newMode === 'live') {
      const confirmed = window.confirm(
        '⚠️ GOING LIVE — This will enable real billing charges.\n\n' +
        'All subscriptions will process real payments through Stripe.\n\n' +
        'Are you sure you want to activate live billing?'
      )
      if (!confirmed) return
    }

    setBillingModeSaving(true)
    try {
      // Get current settings via edge function to merge
      const { data: orgData } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', NETNEURAL_ROOT_ORG_ID)
        .single()

      const currentSettings = (orgData?.settings as Record<string, unknown>) || {}
      const updatedSettings = { ...currentSettings, billing_mode: newMode }

      // Use edge function to bypass RLS (uses supabaseAdmin)
      const result = await edgeFunctions.organizations.update(NETNEURAL_ROOT_ORG_ID, {
        settings: updatedSettings,
      })

      if (!result.success) throw new Error(typeof result.error === 'string' ? result.error : 'Update failed')

      setBillingMode(newMode)
      const modeInfo = BILLING_MODES.find(m => m.value === newMode)!
      toast.success(`Billing mode set to ${modeInfo.label}`, {
        description: modeInfo.description,
      })
    } catch (err) {
      console.error('Failed to update billing mode:', err)
      toast.error('Failed to update billing mode')
    } finally {
      setBillingModeSaving(false)
    }
  }, [isSuperAdmin, billingMode, supabase])

  const handleOpenPortal = useCallback(async () => {
    if (!currentOrganization) return
    setPortalLoading(true)
    try {
      const res = await edgeFunctions.call<{ url: string }>(
        '/create-portal-session',
        {
          method: 'POST',
          body: {
            organizationId: currentOrganization.id,
            returnPath: '/dashboard/billing',
          },
        }
      )
      const portalUrl = res?.data?.url
      if (portalUrl) {
        window.open(portalUrl, '_blank')
        return
      }
      alert(
        'Stripe Customer Portal is not yet configured. Contact support for billing changes.'
      )
    } catch {
      alert('Unable to open billing portal. Please contact support.')
    } finally {
      setPortalLoading(false)
    }
  }, [currentOrganization])

  if (isLoading || userLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  // Must have an organization selected
  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Billing Administration</h2>
          <p className="text-muted-foreground">Select an organization to continue</p>
        </div>
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">No organization selected</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Use the organization dropdown in the sidebar to select an organization.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Only accessible when NetNeural org is selected
  const isNetNeuralOrg = currentOrganization.id === NETNEURAL_ROOT_ORG_ID
  if (!isNetNeuralOrg) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Billing Administration</h2>
          <p className="text-muted-foreground">NetNeural platform billing management</p>
        </div>
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">NetNeural Organization Required</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Billing Administration is only available when the NetNeural organization is selected.
              Switch to the NetNeural organization from the sidebar to access this page.
            </p>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Permission check: only owner, billing role, or super_admin
  const hasAccess = isSuperAdmin || userRole === 'owner' || userRole === 'billing'
  if (!hasAccess) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Billing Administration</h2>
          <p className="text-muted-foreground">NetNeural platform billing management</p>
        </div>
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Access Restricted</p>
            <p className="max-w-md text-sm text-muted-foreground">
              You need Owner or Billing role in the NetNeural organization to access
              Billing Administration. Contact your administrator for access.
            </p>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const canManage = isSuperAdmin || permissions.canManageBilling

  // Owner/billing tabs visible to org owners, billing role, and super admins
  const canAccessOwnerTabs = isSuperAdmin || userRole === 'owner' || userRole === 'billing'

  const visibleTabs = billingTabs.filter(
    (tab) => !tab.ownerOnly || canAccessOwnerTabs
  )

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <DollarSign className="h-7 w-7" />
            Billing Administration
          </h2>
          <p className="text-muted-foreground">
            Financial management for the NetNeural platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Billing Mode Toggle — Super Admin Only */}
          {isSuperAdmin && (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center rounded-lg border bg-muted/30 p-1">
                {BILLING_MODES.map((mode) => {
                  const Icon = mode.icon
                  const isActive = billingMode === mode.value
                  return (
                    <button
                      key={mode.value}
                      onClick={() => handleBillingModeChange(mode.value)}
                      disabled={billingModeSaving || billingModeLoading}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                        isActive
                          ? cn(mode.bg, mode.color, 'shadow-sm ring-1 ring-inset',
                              mode.value === 'off' && 'ring-gray-300 dark:ring-gray-600',
                              mode.value === 'testing' && 'ring-amber-300 dark:ring-amber-700',
                              mode.value === 'live' && 'ring-green-300 dark:ring-green-700',
                            )
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        (billingModeSaving || billingModeLoading) && 'opacity-50 cursor-not-allowed',
                      )}
                      title={mode.description}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {mode.label}
                    </button>
                  )
                })}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {billingModeLoading ? 'Loading...' : (
                  billingMode === 'off' ? 'Billing inactive' :
                  billingMode === 'testing' ? 'Sandbox mode' :
                  '🔴 Live billing active'
                )}
              </span>
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleOpenPortal}
            disabled={portalLoading}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {portalLoading ? 'Opening…' : 'Manage Billing'}
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Tabs — support page style */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {canAccessOwnerTabs && (
          <TabsContent value="financial-reports">
            <FinancialReportsTab />
          </TabsContent>
        )}

        {canAccessOwnerTabs && (
          <TabsContent value="revenue">
            <RevenueTab />
          </TabsContent>
        )}

        {canAccessOwnerTabs && (
          <TabsContent value="subscriptions">
            <SubscriptionsTab />
          </TabsContent>
        )}

        {canAccessOwnerTabs && (
          <TabsContent value="payments">
            <PaymentTable
              organizationId={currentOrganization.id}
              canManage={canManage}
            />
          </TabsContent>
        )}

        {canAccessOwnerTabs && (
          <TabsContent value="invoices">
            <InvoiceTable
              organizationId={currentOrganization.id}
              canManage={canManage}
            />
          </TabsContent>
        )}

        {canAccessOwnerTabs && (
          <TabsContent value="usage">
            <UsageMeteringTab />
          </TabsContent>
        )}

        {canAccessOwnerTabs && (
          <TabsContent value="customers">
            <CustomersTab />
          </TabsContent>
        )}

        {canAccessOwnerTabs && (
          <TabsContent value="plan-management">
            <PlanManagementTab />
          </TabsContent>
        )}

        {canAccessOwnerTabs && (
          <TabsContent value="operations">
            <BillingOperationsTab />
          </TabsContent>
        )}

        {canAccessOwnerTabs && (
          <TabsContent value="promo-codes">
            <PromoCodesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
