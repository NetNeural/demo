'use client'

import { useOrganization } from '@/contexts/OrganizationContext'

export function DevicesHeader() {
  const { currentOrganization } = useOrganization()
  const orgName = currentOrganization?.name

  return (
    <div className="flex items-center justify-between space-y-2">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{orgName ? `${orgName} Devices` : 'Devices'}</h2>
        <p className="text-muted-foreground">Monitor your IoT devices and their status</p>
      </div>
    </div>
  )
}