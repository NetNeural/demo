'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { CustomerTable } from '@/components/admin/CustomerTable'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  ArrowLeft,
  ShieldAlert,
  Users,
} from 'lucide-react'

export default function CustomersAdminPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CustomersPageContent />
    </Suspense>
  )
}

function CustomersPageContent() {
  const router = useRouter()
  const { user, loading } = useUser()
  const { userRole } = useOrganization()
  const isSuperAdmin = user?.isSuperAdmin || false
  const hasAccess = isSuperAdmin || userRole === 'owner'

  // Loading state
  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center p-12">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Owner or super admin only
  if (!hasAccess) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Customers</h2>
          <p className="text-muted-foreground">
            Platform customer management
          </p>
        </div>
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">Access Restricted</p>
            <p className="max-w-md text-sm text-muted-foreground">
              The customer overview page is available to organization owners and super admins.
              Contact the platform administrator if you need access.
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

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard')}
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-7 w-7" />
              Customer Overview
            </h2>
            <p className="text-muted-foreground">
              Platform-wide CRM — all organizations, health scores, and engagement metrics
            </p>
          </div>
        </div>
      </div>

      {/* Customer table with summary cards, filters, and pagination */}
      <CustomerTable />
    </div>
  )
}
