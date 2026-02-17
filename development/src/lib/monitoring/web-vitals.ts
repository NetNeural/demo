/**
 * Web Vitals Monitoring
 * 
 * Reports Core Web Vitals to Sentry for performance monitoring.
 * Tracks:
 * - LCP (Largest Contentful Paint) - Loading performance
 * - FID (First Input Delay) - Interactivity
 * - CLS (Cumulative Layout Shift) - Visual stability
 * - FCP (First Contentful Paint) - Initial render
 * - TTFB (Time to First Byte) - Server response time
 * - INP (Interaction to Next Paint) - Responsiveness
 * 
 * @see https://web.dev/vitals/
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/analytics
 */

import { onCLS, onINP, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals'
import * as Sentry from '@sentry/nextjs'

/**
 * Web Vitals Thresholds (Good, Needs Improvement, Poor)
 * 
 * Based on Web Vitals recommendations:
 * - Good: 75th percentile
 * - Needs Improvement: 75th-90th percentile
 * - Poor: >90th percentile
 */
const VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },  // Largest Contentful Paint (ms)
  FID: { good: 100, needsImprovement: 300 },    // First Input Delay (ms)
  CLS: { good: 0.1, needsImprovement: 0.25 },   // Cumulative Layout Shift (score)
  FCP: { good: 1800, needsImprovement: 3000 },  // First Contentful Paint (ms)
  TTFB: { good: 800, needsImprovement: 1800 },  // Time to First Byte (ms)
  INP: { good: 200, needsImprovement: 500 },    // Interaction to Next Paint (ms)
} as const

/**
 * Get rating based on metric value and threshold
 */
function getRating(
  name: Metric['name'],
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = VITALS_THRESHOLDS[name as keyof typeof VITALS_THRESHOLDS]
  if (!threshold) return 'good'

  if (value <= threshold.good) return 'good'
  if (value <= threshold.needsImprovement) return 'needs-improvement'
  return 'poor'
}

/**
 * Send Web Vital to Sentry as a measurement
 */
function sendToSentry(metric: Metric) {
  const { name, value, id } = metric
  
  // Convert to milliseconds for Sentry (most metrics are in ms already)
  const valueInMs = name === 'CLS' ? value * 1000 : value
  
  // Get custom rating based on thresholds
  const customRating = getRating(name, value)

  // Send to Sentry with context
  Sentry.getCurrentScope().setContext('webVitals', {
    [name]: valueInMs,
    rating: customRating
  })
  
  // Add as breadcrumb for debugging
  Sentry.addBreadcrumb({
    type: 'metric',
    category: 'web-vitals',
    message: `${name}: ${value.toFixed(2)}`,
    level: customRating === 'poor' ? 'warning' : 'info',
    data: {
      name,
      value,
      rating: customRating,
      id,
      navigationType: metric.navigationType,
    },
  })

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    const emoji = customRating === 'good' ? '✅' : customRating === 'needs-improvement' ? '⚠️' : '❌'
    console.log(
      `[Web Vitals] ${emoji} ${name}:`,
      value.toFixed(2),
      `(${customRating})`,
      metric
    )
  }

  // Send custom event for poor vitals
  if (customRating === 'poor') {
    Sentry.captureMessage(`Poor ${name} detected: ${value.toFixed(2)}`, {
      level: 'warning',
      tags: {
        vital: name,
        rating: customRating,
      },
      extra: {
        value,
        threshold: VITALS_THRESHOLDS[name as keyof typeof VITALS_THRESHOLDS],
        metric,
      },
    })
  }
}

/**
 * Initialize Web Vitals reporting
 * 
 * Call this once in your app root or _app.tsx
 */
export function reportWebVitals() {
  try {
    // Core Web Vitals
    onLCP(sendToSentry)  // Largest Contentful Paint
    // onFID has been replaced by onINP in web-vitals v4+
    onCLS(sendToSentry)  // Cumulative Layout Shift

    // Additional metrics
    onFCP(sendToSentry)  // First Contentful Paint
    onTTFB(sendToSentry) // Time to First Byte
    onINP(sendToSentry)  // Interaction to Next Paint (replaces FID)

    // Log initialization
    if (process.env.NODE_ENV === 'development') {
      console.log('[Web Vitals] Monitoring initialized ✅')
    }
  } catch (error) {
    console.error('[Web Vitals] Failed to initialize:', error)
  }
}

/**
 * Manual Web Vital reporting (for custom page transitions)
 * 
 * @example
 * ```tsx
 * import { reportCustomVital } from '@/lib/monitoring/web-vitals'
 * 
 * // Measure custom operation
 * const start = performance.now()
 * await heavyOperation()
 * const duration = performance.now() - start
 * 
 * reportCustomVital('heavyOperation', duration)
 * ```
 */
export function reportCustomVital(name: string, value: number) {
  Sentry.getCurrentScope().setContext('customVitals', {
    [name]: value
  })
  
  Sentry.addBreadcrumb({
    type: 'metric',
    category: 'custom-vitals',
    message: `${name}: ${value.toFixed(2)}ms`,
    level: 'info',
    data: { name, value },
  })

  if (process.env.NODE_ENV === 'development') {
    console.log(`[Custom Vital] ${name}:`, value.toFixed(2), 'ms')
  }
}

/**
 * Performance mark helper
 * 
 * @example
 * ```tsx
 * import { perfMark, perfMeasure } from '@/lib/monitoring/web-vitals'
 * 
 * perfMark('data-fetch-start')
 * const data = await fetchData()
 * perfMark('data-fetch-end')
 * 
 * const duration = perfMeasure('data-fetch', 'data-fetch-start', 'data-fetch-end')
 * ```
 */
export function perfMark(name: string) {
  try {
    performance.mark(name)
  } catch (error) {
    console.warn('[Performance] Failed to mark:', name, error)
  }
}

/**
 * Performance measure helper
 * 
 * @returns Duration in milliseconds
 */
export function perfMeasure(
  name: string,
  startMark: string,
  endMark: string
): number | null {
  try {
    const measure = performance.measure(name, startMark, endMark)
    const duration = measure.duration

    // Report to Sentry
    reportCustomVital(name, duration)

    // Clean up marks
    performance.clearMarks(startMark)
    performance.clearMarks(endMark)
    performance.clearMeasures(name)

    return duration
  } catch (error) {
    console.warn('[Performance] Failed to measure:', name, error)
    return null
  }
}

/**
 * Hook: Monitor component render performance
 * 
 * @example
 * ```tsx
 * import { usePerformanceMonitor } from '@/lib/monitoring/web-vitals'
 * 
 * function MyComponent() {
 *   usePerformanceMonitor('MyComponent')
 *   // ... rest of component
 * }
 * ```
 */
export function usePerformanceMonitor(componentName: string) {
  // Mark component mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    
    perfMark(`${componentName}-mount`)
    
    return () => {
      perfMark(`${componentName}-unmount`)
      perfMeasure(
        `${componentName}-lifetime`,
        `${componentName}-mount`,
        `${componentName}-unmount`
      )
    }
  }, [componentName])
}

// For Next.js App Router, export for instrumentation.ts
export default reportWebVitals

/**
 * Usage in Next.js App Router:
 * 
 * Create `instrumentation.ts` in project root:
 * 
 * ```typescript
 * export function register() {
 *   if (process.env.NEXT_RUNTIME === 'nodejs') {
 *     // Server-side instrumentation
 *     console.log('[Instrumentation] Server registered')
 *   }
 * 
 *   if (process.env.NEXT_RUNTIME === 'edge') {
 *     // Edge runtime instrumentation
 *     console.log('[Instrumentation] Edge registered')
 *   }
 * }
 * 
 * export function onRequestError(err: Error, request: Request) {
 *   console.error('[Request Error]', err, request.url)
 * }
 * ```
 * 
 * Then in app/layout.tsx, add:
 * 
 * ```typescript
 * import { reportWebVitals } from '@/lib/monitoring/web-vitals'
 * 
 * export default function RootLayout({ children }) {
 *   useEffect(() => {
 *     reportWebVitals()
 *   }, [])
 *   
 *   return (
 *     <html>
 *       <body>{children}</body>
 *     </html>
 *   )
 * }
 * ```
 */

// React import for usePerformanceMonitor
import * as React from 'react'
