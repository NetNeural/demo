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

  // ── Stripe Customer Portal ────────────────────────────────────────
  const [portalLoading, setPortalLoading] = useState(false)

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
