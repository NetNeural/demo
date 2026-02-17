import { Suspense } from 'react'
import { AuditLogReport } from '@/components/reports/AuditLogReport'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export const metadata = {
  title: 'User Activity Audit Log | NetNeural',
  description: 'View and track all user actions in the system for compliance and troubleshooting'
}

export default function AuditLogPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner />
      </div>
    }>
      <AuditLogReport />
    </Suspense>
  )
}
