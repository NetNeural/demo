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
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center p-12 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">Please select an organization from the sidebar to view alerts</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Organization context: {currentOrganization.name} */}
      <AlertsHeader />
      
      <Suspense fallback={<LoadingSpinner />}>
        <AlertsList />
      </Suspense>
    </div>
  )
}