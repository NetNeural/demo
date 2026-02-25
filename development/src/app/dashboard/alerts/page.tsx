'use client'

import { Suspense } from 'react'
import { AlertsList } from '@/components/alerts/AlertsList'
import { AlertsHeader } from '@/components/alerts/AlertsHeader'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function AlertsPage() {
  const { currentOrganization, isLoading } = useOrganization()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization from the sidebar to view alerts
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Organization context: {currentOrganization.name} */}
      <AlertsHeader />

      {/* Bug #232 fix: key forces full remount on org switch */}
      <Suspense fallback={<LoadingSpinner />}>
        <AlertsList key={currentOrganization.id} />
      </Suspense>
    </div>
  )
}
