'use client'

import { useState } from 'react'
import { Suspense } from 'react'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { FeedbackForm } from '@/components/feedback/FeedbackForm'
import { FeedbackHistory } from '@/components/feedback/FeedbackHistory'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { BackButton } from '@/components/ui/back-button'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function FeedbackPage() {
  const { currentOrganization, isLoading } = useOrganization()
  const [refreshKey, setRefreshKey] = useState(0)

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization from the sidebar to submit feedback
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <BackButton href="/dashboard" label="Back to Dashboard" />
      <div className="flex items-center gap-3">
        <OrganizationLogo
          settings={currentOrganization?.settings}
          name={currentOrganization?.name || 'NetNeural'}
          size="xl"
        />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {currentOrganization.name} Feedback
          </h2>
          <p className="text-muted-foreground">
            Submit bug reports and feature requests for{' '}
            {currentOrganization.name}. Each submission creates a tracked GitHub
            issue.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Submit form */}
        <FeedbackForm
          key={currentOrganization.id}
          onSubmitted={() => setRefreshKey((k) => k + 1)}
        />

        {/* Right: History */}
        <Suspense fallback={<LoadingSpinner />}>
          <FeedbackHistory
            key={currentOrganization.id}
            refreshKey={refreshKey}
          />
        </Suspense>
      </div>
    </div>
  )
}
