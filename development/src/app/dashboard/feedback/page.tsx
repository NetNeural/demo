'use client'

import { useState } from 'react'
import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { FeedbackForm } from '@/components/feedback/FeedbackForm'
import { FeedbackHistory } from '@/components/feedback/FeedbackHistory'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function FeedbackPage() {
  const { currentOrganization, isLoading } = useOrganization()
  const [refreshKey, setRefreshKey] = useState(0)

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center p-12 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">Please select an organization from the sidebar to submit feedback</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader
        title="Feedback"
        description={`Submit bug reports and feature requests for ${currentOrganization.name}. Each submission creates a tracked GitHub issue.`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Submit form */}
        <FeedbackForm onSubmitted={() => setRefreshKey((k) => k + 1)} />

        {/* Right: History */}
        <Suspense fallback={<LoadingSpinner />}>
          <FeedbackHistory refreshKey={refreshKey} />
        </Suspense>
      </div>
    </div>
  )
}
