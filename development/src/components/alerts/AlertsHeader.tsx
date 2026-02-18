'use client'

import { useOrganization } from '@/contexts/OrganizationContext'

export function AlertsHeader() {
  const { currentOrganization } = useOrganization()
  const orgName = currentOrganization?.name

  return (
    <div className="flex items-center justify-between space-y-2">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">{orgName ? `${orgName} Alert Management` : 'Alert Management'}</h2>
        <p className="text-muted-foreground">
          Monitor and respond to active alerts{orgName ? ` from ${orgName}` : ' from your organization'}
        </p>
      </div>
    </div>
  )
}