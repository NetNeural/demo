import { Suspense } from 'react'
import { UsersList } from '@/components/users/UsersList'
import { UsersHeader } from '@/components/users/UsersHeader'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function UsersPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <UsersHeader />

      <Suspense fallback={<LoadingSpinner />}>
        <UsersList />
      </Suspense>
    </div>
  )
}
