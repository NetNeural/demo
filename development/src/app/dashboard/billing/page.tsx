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
  Download,
  FileDown,
} from 'lucide-react'

import { RevenueTab } from './components/RevenueTab'
import { ExpensesTab } from './components/ExpensesTab'
import { SubscriptionsTab } from './components/SubscriptionsTab'
import { UsageMeteringTab } from './components/UsageMeteringTab'
import { CustomersTab } from './components/CustomersTab'
import { PlanManagementTab } from './components/PlanManagementTab'
import { BillingOperationsTab } from './components/BillingOperationsTab'
import { PromoCodesTab } from './components/PromoCodesTab'
import { ARAgingReport } from '@/components/admin/ARAgingReport'
import { PaymentFailureReport } from '@/components/admin/PaymentFailureReport'
import { TaxSummaryReport } from '@/components/admin/TaxSummaryReport'
import {
  fetchARAgingReport,
  fetchPaymentFailureReport,
  fetchTaxSummaryReport,
  arAgingToCsv,
} from '@/lib/admin/financial-report-queries'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type {
  ARAgingSummary,
  PaymentFailureReport as PaymentFailureData,
  TaxSummaryReport as TaxSummaryData,
} from '@/lib/admin/financial-report-queries'

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
    id: 'revenue',
    label: 'Revenue',
    icon: TrendingUp,
    ownerOnly: true,
  },
  {
    id: 'ar-aging',
    label: 'AR Aging',
    icon: FileBarChart,
    ownerOnly: true,
  },
  {
    id: 'payment-failures',
    label: 'Payment Failures',
    icon: FileBarChart,
    ownerOnly: true,
  },
  {
    id: 'tax-summary',
    label: 'Tax Summary',
    icon: FileBarChart,
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
    id: 'expenses',
    label: 'Expenses',
    icon: DollarSign,
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

/** Self-loading AR Aging report panel */
function ARAgingPanel() {
  const [data, setData] = useState<ARAgingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    fetchARAgingReport(supabase)
      .then(setData)
      .catch((err) => { console.error('AR Aging load error', err); toast.error('Failed to load AR Aging report') })
      .finally(() => setLoading(false))
  }, [])

  const canExport = !loading && data && data.rows.length > 0

  function handleExportCsv() {
    if (!data) return
    const csv = arAgingToCsv(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ar-aging-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportPdf() {
    if (!data) return
    const doc = new jsPDF({ orientation: 'landscape' })
    const date = new Date().toISOString().slice(0, 10)
    doc.setFontSize(16)
    doc.text('AR Aging Report', 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated: ${date}`, 14, 22)
    autoTable(doc, {
      startY: 28,
      head: [['Organization', 'Current', '1–30 Days', '31–60 Days', '61–90 Days', '90+ Days', 'Total']],
      body: [
        ...data.rows.map((r) => [
          r.organizationName,
          `$${r.current.toFixed(2)}`,
          `$${r.days1to30.toFixed(2)}`,
          `$${r.days31to60.toFixed(2)}`,
          `$${r.days61to90.toFixed(2)}`,
          `$${r.days90plus.toFixed(2)}`,
          `$${r.total.toFixed(2)}`,
        ]),
        [
          'TOTALS',
          `$${data.totals.current.toFixed(2)}`,
          `$${data.totals.days1to30.toFixed(2)}`,
          `$${data.totals.days31to60.toFixed(2)}`,
          `$${data.totals.days61to90.toFixed(2)}`,
          `$${data.totals.days90plus.toFixed(2)}`,
          `$${data.totals.total.toFixed(2)}`,
        ],
      ],
      headStyles: { fillColor: [30, 64, 175] },
      footStyles: { fontStyle: 'bold' },
    })
    doc.save(`ar-aging-${date}.pdf`)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!canExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={!canExport}>
          <FileDown className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </div>
      <ARAgingReport data={data} loading={loading} />
    </div>
  )
}

/** Self-loading Payment Failures report panel */
function PaymentFailuresPanel() {
  const [data, setData] = useState<PaymentFailureData | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    fetchPaymentFailureReport(supabase, 6)
      .then(setData)
      .catch((err) => { console.error('Payment Failures load error', err); toast.error('Failed to load Payment Failures report') })
      .finally(() => setLoading(false))
  }, [])
  return <PaymentFailureReport data={data} loading={loading} />
}

/** Self-loading Tax Summary report panel */
function TaxSummaryPanel() {
  const [data, setData] = useState<TaxSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const supabase = createClient()
    const currentYear = new Date().getFullYear()
    fetchTaxSummaryReport(supabase, currentYear)
      .then(setData)
      .catch((err) => { console.error('Tax Summary load error', err); toast.error('Failed to load Tax Summary report') })
      .finally(() => setLoading(false))
  }, [])
  return <TaxSummaryReport data={data} loading={loading} />
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
      return searchParams.get('tab') || 'revenue'
    }
    return 'revenue'
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
        <div className="flex items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
          {/* Billing Mode Toggle — Super Admin Only */}
          {isSuperAdmin && (
            <>
              <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
                {BILLING_MODES.map((mode) => {
                  const Icon = mode.icon
                  const isActive = billingMode === mode.value
                  return (
                    <button
                      key={mode.value}
                      onClick={() => handleBillingModeChange(mode.value)}
                      disabled={billingModeSaving || billingModeLoading}
                      className={cn(
                        'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-all',
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
              <div className="mx-1 h-6 w-px bg-border" />
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenPortal}
            disabled={portalLoading}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {portalLoading ? 'Opening…' : 'Manage Billing'}
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Tabs — grouped with sub-tabs */}
      <Tabs
        value={(() => {
          const groupMap: Record<string, string> = {
            revenue: 'reports', 'ar-aging': 'reports', 'payment-failures': 'reports', 'tax-summary': 'reports',
            invoices: 'transactions', payments: 'transactions',
            subscriptions: 'reports', usage: 'reports', expenses: 'reports', customers: 'management',
            'plan-management': 'operations', operations: 'operations', 'promo-codes': 'operations',
          }
          return groupMap[activeTab] || 'reports'
        })()}
        onValueChange={(group) => {
          const defaults: Record<string, string> = {
            reports: 'revenue', transactions: 'invoices',
            management: 'customers', operations: 'plan-management',
          }
          handleTabChange(defaults[group] || 'financial-reports')
        }}
        className="space-y-6"
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileBarChart className="h-4 w-4" />
            <span>Reports & Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Transactions</span>
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Management</span>
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            <span>Operations</span>
          </TabsTrigger>
        </TabsList>

        {/* Reports & Analytics — Revenue + AR Aging + Payment Failures + Tax Summary */}
        <TabsContent value="reports">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="revenue" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Revenue
              </TabsTrigger>
              <TabsTrigger value="ar-aging" className="flex items-center gap-2">
                <FileBarChart className="h-4 w-4" />
                AR Aging
              </TabsTrigger>
              <TabsTrigger value="payment-failures" className="flex items-center gap-2">
                <FileBarChart className="h-4 w-4" />
                Payment Failures
              </TabsTrigger>
              <TabsTrigger value="tax-summary" className="flex items-center gap-2">
                <FileBarChart className="h-4 w-4" />
                Tax Summary
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="flex items-center gap-2">
                <Repeat className="h-4 w-4" />
                Subscriptions
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Usage Metering
              </TabsTrigger>
              <TabsTrigger value="expenses" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Expenses
              </TabsTrigger>
            </TabsList>
            <TabsContent value="revenue" className="mt-6">
              <RevenueTab />
            </TabsContent>
            <TabsContent value="ar-aging" className="mt-6">
              <ARAgingPanel />
            </TabsContent>
            <TabsContent value="payment-failures" className="mt-6">
              <PaymentFailuresPanel />
            </TabsContent>
            <TabsContent value="tax-summary" className="mt-6">
              <TaxSummaryPanel />
            </TabsContent>
            <TabsContent value="subscriptions" className="mt-6">
              <SubscriptionsTab />
            </TabsContent>
            <TabsContent value="usage" className="mt-6">
              <UsageMeteringTab />
            </TabsContent>
            <TabsContent value="expenses" className="mt-6">
              <ExpensesTab />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Transactions — Invoices + Payments */}
        <TabsContent value="transactions">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="invoices" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoices
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payments
              </TabsTrigger>
            </TabsList>
            <TabsContent value="invoices" className="mt-6">
              <InvoiceTable
                organizationId={currentOrganization.id}
                canManage={canManage}
              />
            </TabsContent>
            <TabsContent value="payments" className="mt-6">
              <PaymentTable
                organizationId={currentOrganization.id}
                canManage={canManage}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Management — Customers */}
        <TabsContent value="management">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="customers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customers
              </TabsTrigger>
            </TabsList>
            <TabsContent value="customers" className="mt-6">
              <CustomersTab />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Operations — Plan Management + Billing Ops + Promo Codes */}
        <TabsContent value="operations">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="plan-management" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Plan Management
              </TabsTrigger>
              <TabsTrigger value="operations" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Billing Ops
              </TabsTrigger>
              <TabsTrigger value="promo-codes" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Promo Codes
              </TabsTrigger>
            </TabsList>
            <TabsContent value="plan-management" className="mt-6">
              <PlanManagementTab />
            </TabsContent>
            <TabsContent value="operations" className="mt-6">
              <BillingOperationsTab />
            </TabsContent>
            <TabsContent value="promo-codes" className="mt-6">
              <PromoCodesTab />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  )
}
