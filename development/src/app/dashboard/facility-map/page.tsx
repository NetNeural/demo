'use client'

import { Suspense } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { FacilityMapView } from '@/components/facility-map'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Map, Building2 } from 'lucide-react'

export default function FacilityMapPage() {
  const { currentOrganization, isLoading } = useOrganization()

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!currentOrganization) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center text-center">
        <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Organization Selected</h2>
        <p className="mt-2 text-muted-foreground">
          Select an organization to view and manage facility maps.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex items-center gap-3">
        <OrganizationLogo
          settings={currentOrganization.settings}
          name={currentOrganization.name || 'NetNeural'}
          size="xl"
        />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {currentOrganization.name
              ? `${currentOrganization.name} Facility Maps`
              : 'Facility Maps'}
          </h2>
          <p className="text-muted-foreground">
            Upload floor plans and place devices to visualize their real-time status
          </p>
        </div>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <FacilityMapView
          key={currentOrganization.id}
          organizationId={currentOrganization.id}
        />
      </Suspense>
    </div>
  )
}
