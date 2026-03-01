'use client'

import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { InvoiceTable } from '@/components/billing/InvoiceTable'
import { PaymentTable } from '@/components/billing/PaymentTable'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  ArrowLeft,
  FileBarChart,
  TrendingUp,
  CreditCard,
  FileText,
  ShieldAlert,
  Building2,
  DollarSign,
} from 'lucide-react'

// Revenue tab — lazy loaded
import dynamic from 'next/dynamic'
const RevenueTabContent = dynamic(
  () => import('./components/RevenueTab').then((m) => ({ default: m.RevenueTab })),
  { loading: () => <LoadingSpinner />, ssr: false }
)
const FinancialReportsTabContent = dynamic(
  () => import('./components/FinancialReportsTab').then((m) => ({ default: m.FinancialReportsTab })),
  { loading: () => <LoadingSpinner />, ssr: false }
)

const NETNEURAL_ROOT_ORG_ID = '00000000-0000-0000-0000-000000000001'

export default function BillingAdministrationPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <BillingAdminContent />
    </Suspense>
  )
}

function BillingAdminContent() {
  const router = useRouter()
  const { currentOrganization, isLoading, userRole, permissions } = useOrganization()
  const { user } = useUser()
  const isSuperAdmin = user?.isSuperAdmin || false
  const [activeTab, setActiveTab] = useState('financial-reports')

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center p-12">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading billing administration...</p>
          </div>
        </div>
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

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <DollarSign className="h-7 w-7" />
            Billing Administration
          </h2>
          <p className="text-muted-foreground">
            Financial management for the NetNeural platform
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="financial-reports" className="flex items-center gap-2">
            <FileBarChart className="h-4 w-4" />
            <span className="hidden sm:inline">Financial Reports</span>
            <span className="sm:hidden">Reports</span>
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span>Revenue</span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Payments</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Invoices</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financial-reports" className="space-y-4">
          <FinancialReportsTabContent />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <RevenueTabContent />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PaymentTable
            organizationId={currentOrganization.id}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <InvoiceTable
            organizationId={currentOrganization.id}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
