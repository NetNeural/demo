'use client'

import { Suspense } from 'react'
import { AlertHistoryReport } from '@/components/reports/AlertHistoryReport'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { BackButton } from '@/components/ui/back-button'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function AlertHistoryReportPage() {
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
              Please select an organization from the sidebar to view alert
              history reports
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <BackButton href="/dashboard/reports" label="Back to Reports" />
      <Suspense fallback={<LoadingSpinner />}>
        <AlertHistoryReport key={currentOrganization.id} />
      </Suspense>
    </div>
  )
}
