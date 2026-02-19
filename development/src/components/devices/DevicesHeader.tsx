'use client'

import { useOrganization } from '@/contexts/OrganizationContext'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'

export function DevicesHeader() {
  const { currentOrganization } = useOrganization()
  const orgName = currentOrganization?.name

  return (
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
    </div>
  )
}