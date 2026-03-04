'use client'

import { Suspense } from 'react'
import { UsersList } from '@/components/users/UsersList'
import { UsersHeader } from '@/components/users/UsersHeader'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function UsersPage() {
  const { currentOrganization } = useOrganization()

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <UsersHeader />

      {/* key forces full remount on org switch, preventing stale user data */}
      <Suspense fallback={<LoadingSpinner />}>
        <UsersList key={currentOrganization?.id || 'no-org'} />
      </Suspense>
    </div>
  )
}
