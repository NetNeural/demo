'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { InvoiceTable } from '@/components/billing/InvoiceTable'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  ArrowLeft,
  FileText,
  ShieldAlert,
  Building2,
} from 'lucide-react'

export default function InvoicesPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <InvoicesPageContent />
    </Suspense>
  )
}

function InvoicesPageContent() {
  const router = useRouter()
  const {
    currentOrganization,
    isLoading,
    permissions,
  } = useOrganization()
  const { user } = useUser()
  const isSuperAdmin = user?.isSuperAdmin || false

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center p-12">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Loading billing data...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // No organization selected
  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
          <p className="text-muted-foreground">
            Select an organization to view invoices
          </p>
        </div>
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">No organization selected</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Use the organization dropdown in the sidebar to select an
              organization, then return here to view invoices.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Permission check — canViewBilling required (owner + admin), super admins always pass
  if (!isSuperAdmin && !permissions.canViewBilling) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
          <p className="text-muted-foreground">
            Invoice history for {currentOrganization.name}
          </p>
        </div>
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Access Restricted</p>
            <p className="max-w-md text-sm text-muted-foreground">
              You don&apos;t have permission to view billing information. Contact
              your organization owner or admin for access.
            </p>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
            >
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
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/organizations?tab=billing')}
            title="Back to Billing Overview"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-7 w-7" />
              Invoices
            </h2>
            <p className="text-muted-foreground">
              Billing history for {currentOrganization.name}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice table with all filters & pagination */}
      <InvoiceTable
        organizationId={currentOrganization.id}
        canManage={canManage}
      />
    </div>
  )
}
