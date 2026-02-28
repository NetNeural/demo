import { Suspense } from 'react'
import { AuditLogReport } from '@/components/reports/AuditLogReport'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { BackButton } from '@/components/ui/back-button'

export const metadata = {
  title: 'User Activity Audit Log | NetNeural',
  description:
    'View and track all user actions in the system for compliance and troubleshooting',
}

export default function AuditLogPage() {
  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <BackButton href="/dashboard/reports" label="Back to Reports" />
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-12">
            <LoadingSpinner />
          </div>
        }
      >
        <AuditLogReport />
      </Suspense>
    </div>
  )
}
