'use client'

import { Suspense } from 'react'
import { DevicesList } from '@/components/devices/DevicesList'
import { DevicesHeader } from '@/components/devices/DevicesHeader'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useOrganization } from '@/contexts/OrganizationContext'
import { FacilityMapView } from '@/components/facility-map'

export default function DevicesPage() {
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
              Please select an organization from the sidebar to view devices
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Organization context: {currentOrganization.name} */}
      <DevicesHeader />

      {/* Facility Map — embedded at top of devices page */}
      <Suspense fallback={<LoadingSpinner />}>
        <FacilityMapView
          key={`map-${currentOrganization.id}`}
          organizationId={currentOrganization.id}
        />
      </Suspense>

      {/* Bug #232 fix: key forces full remount on org switch, preventing
          stale device data from the previous org being displayed. */}
      <Suspense fallback={<LoadingSpinner />}>
        <DevicesList key={currentOrganization.id} />
      </Suspense>
    </div>
  )
}
