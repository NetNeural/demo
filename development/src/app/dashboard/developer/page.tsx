'use client'

import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { DeveloperTab } from '@/app/dashboard/settings/components/DeveloperTab'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function DeveloperPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <PageHeader
          title="Developer"
          description="Manage personal API keys, webhooks, and developer tools"
        />
        <DeveloperTab />
      </div>
    </Suspense>
  )
}
