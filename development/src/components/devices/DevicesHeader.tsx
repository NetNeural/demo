'use client'

import { useState } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { AddDeviceDialog } from './AddDeviceDialog'

export function DevicesHeader() {
  const { currentOrganization, canManageDevices } = useOrganization()
  const orgName = currentOrganization?.name
  const [addDeviceDialogOpen, setAddDeviceDialogOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={orgName || 'NetNeural'}
            size="xl"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{orgName ? `${orgName} Devices` : 'Devices'}</h2>
            <p className="text-muted-foreground">Monitor your IoT devices and their status</p>
          </div>
        </div>
        
        {canManageDevices && (
          <Button onClick={() => setAddDeviceDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        )}
      </div>

      <AddDeviceDialog
        open={addDeviceDialogOpen}
        onOpenChange={setAddDeviceDialogOpen}
        onSuccess={() => {
          // Dispatch custom event to notify DevicesList to refresh
          window.dispatchEvent(new CustomEvent('device-added'))
        }}
      />
    </>
  )
}