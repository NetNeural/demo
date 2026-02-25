/**
 * Device Types Configuration Page
 *
 * Admin page for managing device types with normal ranges,
 * alert thresholds, and measurement metadata.
 *
 * @see Issue #118
 */
'use client'

import { useState } from 'react'
import { Suspense } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Button } from '@/components/ui/button'
import { DeviceTypesList } from '@/components/device-types/DeviceTypesList'
import { DeviceTypeFormDialog } from '@/components/device-types/DeviceTypeFormDialog'
import { Plus } from 'lucide-react'

export default function DeviceTypesPage() {
  const { currentOrganization, isLoading } = useOrganization()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization from the sidebar to manage device
              types
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={currentOrganization?.name || 'NetNeural'}
            size="xl"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {currentOrganization?.name
                ? `${currentOrganization.name} Device Types`
                : 'Device Types'}
            </h2>
            <p className="text-muted-foreground">
              Manage device type configurations, normal operating ranges, and
              alert thresholds
            </p>
          </div>
        </div>

        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Device Type
        </Button>
      </div>

      <Suspense fallback={<LoadingSpinner />}>
        <DeviceTypesList />
      </Suspense>

      <DeviceTypeFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  )
}
