/**
 * Web Vitals Reporter Component
 * 
 * Client-side component that initializes Web Vitals monitoring
 * for Core Web Vitals (LCP, FID, CLS) and additional metrics.
 */

'use client'

import { useEffect } from 'react'
import { reportWebVitals } from '@/lib/monitoring/web-vitals'

export function WebVitalsReporter() {
  useEffect(() => {
    // Initialize Web Vitals reporting
    reportWebVitals()
  }, [])

  // This component doesn't render anything
  return null
}
