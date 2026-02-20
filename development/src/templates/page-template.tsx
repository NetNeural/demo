/**
 * Template for creating new pages with built-in Sentry error handling
 *
 * INSTRUCTIONS FOR NEW PAGES:
 * 1. Copy this file to your new page location: src/app/[your-route]/page.tsx
 * 2. Rename the component function (e.g., YourFeaturePage)
 * 3. Replace the content with your actual page implementation
 * 4. For API calls, ALWAYS use handleApiError from '@/lib/sentry-utils'
 * 5. For wrapping risky components, use <ErrorBoundaryWrapper>
 *
 * This template ensures:
 * - ✅ All unhandled errors are automatically sent to Sentry
 * - ✅ API errors show user feedback dialogs in production
 * - ✅ Component errors are caught and reported
 * - ✅ Consistent error handling across the entire app
 */

'use client'

import { useState } from 'react'
import { handleApiError, reportError } from '@/lib/sentry-utils'
import { ErrorBoundaryWrapper } from '@/lib/error-boundary-wrapper'
// import your components and dependencies here

export default function NewPageTemplate() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // EXAMPLE: API call with automatic Sentry error handling
  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/your-endpoint', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error = new Error(errorData.error || `HTTP ${response.status}`)

        // ✅ This automatically:
        // - Sends error to Sentry with context
        // - Shows feedback dialog to user (in production)
        // - Uses appropriate error message based on status
        handleApiError(error, {
          endpoint: '/api/your-endpoint',
          method: 'GET',
          status: response.status,
          errorData,
          context: {
            userId: 'user-123', // Add relevant context
          },
        })

        throw error
      }

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error('Failed to fetch data:', error)
      // Error already sent to Sentry by handleApiError
    } finally {
      setLoading(false)
    }
  }

  // EXAMPLE: Manual error reporting (for non-API errors)
  const handleCustomAction = () => {
    try {
      // Your custom logic here
      throw new Error('Custom error')
    } catch (error) {
      // ✅ Manually report to Sentry with context
      reportError(error as Error, {
        tags: { feature: 'custom-action' },
        extra: { action: 'button-click' },
      })
    }
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Your Page Title</h1>

      {/* EXAMPLE: Wrap risky components in error boundary */}
      <ErrorBoundaryWrapper>
        <div>
          <p>Your page content here...</p>

          {data && <pre>{JSON.stringify(data, null, 2)}</pre>}

          <button onClick={fetchData} disabled={loading}>
            {loading ? 'Loading...' : 'Fetch Data'}
          </button>

          <button onClick={handleCustomAction}>Test Custom Action</button>
        </div>
      </ErrorBoundaryWrapper>
    </div>
  )
}
