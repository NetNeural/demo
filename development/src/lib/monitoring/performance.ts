/**
 * Performance Monitoring Utilities
 * 
 * Custom Sentry spans for tracking critical operations:
 * - Database queries
 * - API calls
 * - Edge Function invocations
 * - Heavy computations
 * 
 * Story 3.4: Real-time Performance Monitoring
 */

import * as Sentry from '@sentry/nextjs'

/**
 * Monitor database query performance
 * 
 * Creates a Sentry span for the query and tracks duration
 * 
 * @example
 * ```tsx
 * const devices = await monitorDatabaseQuery(
 *   'fetch_devices',
 *   async () => {
 *     const { data } = await supabase.from('devices').select('*')
 *     return data
 *   },
 *   { table: 'devices', operation: 'select' }
 * )
 * ```
 */
export async function monitorDatabaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  metadata?: {
    table?: string
    operation?: 'select' | 'insert' | 'update' | 'delete' | 'rpc'
    filters?: string[]
  }
): Promise<T> {
  return await Sentry.startSpan(
    {
      op: 'db.query',
      name: queryName,
      attributes: {
        'db.system': 'postgresql',
        'db.name': 'supabase',
        'db.table': metadata?.table,
        'db.operation': metadata?.operation,
        'db.filters': metadata?.filters?.join(', '),
      },
    },
    async (span) => {
      const startTime = performance.now()
      
      try {
        const result = await queryFn()
        const duration = performance.now() - startTime
        
        // Log slow queries (>1 second)
        if (duration > 1000) {
          Sentry.captureMessage(`Slow database query: ${queryName}`, {
            level: 'warning',
            tags: {
              query: queryName,
              table: metadata?.table || 'unknown',
              operation: metadata?.operation || 'unknown',
            },
            extra: {
              duration: `${duration}ms`,
              filters: metadata?.filters,
            },
          })
        }

        // Add breadcrumb for debugging
        Sentry.addBreadcrumb({
          category: 'database',
          message: `${queryName} completed in ${duration.toFixed(2)}ms`,
          level: duration > 1000 ? 'warning' : 'info',
          data: {
            duration,
            table: metadata?.table,
            operation: metadata?.operation,
          },
        })

        span.setStatus({ code: 1 }) // OK
        return result
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }) // ERROR
        
        // Capture database errors
        Sentry.captureException(error, {
          tags: {
            query: queryName,
            table: metadata?.table || 'unknown',
          },
          extra: {
            operation: metadata?.operation,
            filters: metadata?.filters,
          },
        })
        
        throw error
      }
    }
  )
}

/**
 * Monitor API call performance
 * 
 * Tracks external API calls (Golioth, OpenAI, etc.)
 * 
 * @example
 * ```tsx
 * const response = await monitorApiCall(
 *   'golioth_fetch_devices',
 *   async () => {
 *     return await fetch(`${GOLIOTH_API}/devices`, {
 *       headers: { 'Authorization': `Bearer ${token}` }
 *     })
 *   },
 *   { service: 'golioth', endpoint: '/devices', method: 'GET' }
 * )
 * ```
 */
export async function monitorApiCall<T>(
  callName: string,
  apiFn: () => Promise<T>,
  metadata?: {
    service?: string
    endpoint?: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  }
): Promise<T> {
  return await Sentry.startSpan(
    {
      op: 'http.client',
      name: callName,
      attributes: {
        'http.method': metadata?.method || 'GET',
        'http.url': metadata?.endpoint,
        'service.name': metadata?.service,
      },
    },
    async (span) => {
      const startTime = performance.now()
      
      try {
        const result = await apiFn()
        const duration = performance.now() - startTime
        
        // Log slow API calls (>2 seconds)
        if (duration > 2000) {
          Sentry.captureMessage(`Slow API call: ${callName}`, {
            level: 'warning',
            tags: {
              api: callName,
              service: metadata?.service || 'unknown',
              endpoint: metadata?.endpoint || 'unknown',
            },
            extra: {
              duration: `${duration}ms`,
              method: metadata?.method,
            },
          })
        }

        // Breadcrumb
        Sentry.addBreadcrumb({
          category: 'api',
          message: `${callName} completed in ${duration.toFixed(2)}ms`,
          level: duration > 2000 ? 'warning' : 'info',
          data: {
            duration,
            service: metadata?.service,
            endpoint: metadata?.endpoint,
          },
        })

        span.setStatus({ code: 1 }) // OK
        return result
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }) // ERROR
        
        Sentry.captureException(error, {
          tags: {
            api: callName,
            service: metadata?.service || 'unknown',
          },
          extra: {
            endpoint: metadata?.endpoint,
            method: metadata?.method,
          },
        })
        
        throw error
      }
    }
  )
}

/**
 * Monitor Edge Function invocation
 * 
 * @example
 * ```tsx
 * const result = await monitorEdgeFunction(
 *   'sensor-threshold-evaluator',
 *   async () => {
 *     return await edgeFunctions.invoke('sensor-threshold-evaluator', { deviceId })
 *   }
 * )
 * ```
 */
export async function monitorEdgeFunction<T>(
  functionName: string,
  invokeFn: () => Promise<T>
): Promise<T> {
  return await Sentry.startSpan(
    {
      op: 'function.invoke',
      name: `edge-function.${functionName}`,
      attributes: {
        'faas.trigger': 'http',
        'faas.name': functionName,
      },
    },
    async (span) => {
      const startTime = performance.now()
      
      try {
        const result = await invokeFn()
        const duration = performance.now() - startTime
        
        // Log slow Edge Functions (>5 seconds)
        if (duration > 5000) {
          Sentry.captureMessage(`Slow Edge Function: ${functionName}`, {
            level: 'warning',
            tags: {
              function: functionName,
            },
            extra: {
              duration: `${duration}ms`,
            },
          })
        }

        Sentry.addBreadcrumb({
          category: 'edge-function',
          message: `${functionName} completed in ${duration.toFixed(2)}ms`,
          level: duration > 5000 ? 'warning' : 'info',
          data: { duration, function: functionName },
        })

        span.setStatus({ code: 1 }) // OK
        return result
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }) // ERROR
        
        Sentry.captureException(error, {
          tags: {
            function: functionName,
          },
        })
        
        throw error
      }
    }
  )
}

/**
 * Monitor heavy computation performance
 * 
 * Use for CPU-intensive operations
 * 
 * @example
 * ```tsx
 * const processed = await monitorComputation(
 *   'process_telemetry_batch',
 *   async () => {
 *     return telemetry.map(d => heavyTransform(d))
 *   },
 *   { itemCount: telemetry.length }
 * )
 * ```
 */
export async function monitorComputation<T>(
  computationName: string,
  computeFn: () => Promise<T> | T,
  metadata?: {
    itemCount?: number
    dataSize?: number
  }
): Promise<T> {
  return await Sentry.startSpan(
    {
      op: 'computation',
      name: computationName,
      attributes: {
        'computation.items': metadata?.itemCount,
        'computation.size': metadata?.dataSize,
      },
    },
    async (span) => {
      const startTime = performance.now()
      
      try {
        const result = await computeFn()
        const duration = performance.now() - startTime
        
        // Log slow computations (>3 seconds)
        if (duration > 3000) {
          Sentry.captureMessage(`Slow computation: ${computationName}`, {
            level: 'warning',
            tags: {
              computation: computationName,
            },
            extra: {
              duration: `${duration}ms`,
              itemCount: metadata?.itemCount,
              dataSize: metadata?.dataSize,
            },
          })
        }

        Sentry.addBreadcrumb({
          category: 'computation',
          message: `${computationName} completed in ${duration.toFixed(2)}ms`,
          level: duration > 3000 ? 'warning' : 'info',
          data: {
            duration,
            itemCount: metadata?.itemCount,
            dataSize: metadata?.dataSize,
          },
        })

        span.setStatus({ code: 1 }) // OK
        return result
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }) // ERROR
        
        Sentry.captureException(error, {
          tags: {
            computation: computationName,
          },
          extra: metadata,
        })
        
        throw error
      }
    }
  )
}

/**
 * Track user action performance
 * 
 * For user-initiated actions like button clicks, form submissions
 * 
 * @example
 * ```tsx
 * const handleSubmit = async () => {
 *   await trackUserAction('update_device', async () => {
 *     await updateDevice(data)
 *   }, { deviceId: 'abc123' })
 * }
 * ```
 */
export async function trackUserAction<T>(
  actionName: string,
  actionFn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  return await Sentry.startSpan(
    {
      op: 'user.action',
      name: actionName,
      attributes: metadata,
    },
    async (span) => {
      const startTime = performance.now()
      
      try {
        const result = await actionFn()
        const duration = performance.now() - startTime
        
        // Log slow user actions (>2 seconds - feels laggy to user)
        if (duration > 2000) {
          Sentry.captureMessage(`Slow user action: ${actionName}`, {
            level: 'warning',
            tags: {
              action: actionName,
            },
            extra: {
              duration: `${duration}ms`,
              ...metadata,
            },
          })
        }

        Sentry.addBreadcrumb({
          category: 'user-action',
          message: `${actionName} completed in ${duration.toFixed(2)}ms`,
          level: duration > 2000 ? 'warning' : 'info',
          data: {
            duration,
            ...metadata,
          },
        })

        span.setStatus({ code: 1 }) // OK
        return result
      } catch (error) {
        span.setStatus({ code: 2, message: String(error) }) // ERROR
        
        Sentry.captureException(error, {
          tags: {
            action: actionName,
          },
          extra: metadata,
        })
        
        throw error
      }
    }
  )
}

/**
 * Create custom transaction for complex operations
 * 
 * @example
 * ```tsx
 * const transaction = startTransaction('device_sync', 'background.job')
 * 
 * try {
 *   await fetchDevices()
 *   await updateDatabase()
 *   await notifyUsers()
 *   
 *   transaction.finish()
 * } catch (error) {
 *   transaction.setStatus('internal_error')
 *   transaction.finish()
 * }
 * ```
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startInactiveSpan({
    name,
    op,
    forceTransaction: true,
  })
}

/**
 * Performance alert helper
 * 
 * Send alert to Sentry if performance metric exceeds threshold
 * 
 * @example
 * ```tsx
 * const duration = performance.now() - start
 * 
 * alertIfSlow('page_load', duration, 3000, {
 *   page: '/dashboard',
 *   user: userId,
 * })
 * ```
 */
export function alertIfSlow(
  operation: string,
  duration: number,
  threshold: number,
  metadata?: Record<string, unknown>
) {
  if (duration > threshold) {
    Sentry.captureMessage(`Performance degradation: ${operation}`, {
      level: 'warning',
      tags: {
        operation,
        performance_issue: 'slow_operation',
      },
      extra: {
        duration: `${duration}ms`,
        threshold: `${threshold}ms`,
        exceededBy: `${(duration - threshold).toFixed(2)}ms`,
        ...metadata,
      },
    })
  }
}
