// ===========================================================================
// Edge Function Client - Type-Safe Frontend SDK
// ===========================================================================
// Centralized client for calling Supabase Edge Functions
// Features: Auto-authentication, type safety, consistent error handling
// ===========================================================================

import { createClient } from '@/lib/supabase/client'

/**
 * Standard edge function response format
 */
export interface EdgeFunctionResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    status: number
    [key: string]: unknown
  }
  message?: string
  meta?: Record<string, unknown>
  timestamp: string
}

/**
 * Edge function call options
 */
export interface EdgeFunctionOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
}

/**
 * Centralized Edge Function Client
 * Handles authentication, request formatting, error handling
 */
export class EdgeFunctionClient {
  private baseUrl: string
  private supabase = createClient()

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
    }
    this.baseUrl = `${supabaseUrl}/functions/v1`
  }

  /**
   * Get authentication headers for requests
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession()

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }

    return headers
  }

  /**
   * Make a request to an edge function
   */
  async call<T>(
    functionName: string,
    options: EdgeFunctionOptions = {}
  ): Promise<EdgeFunctionResponse<T>> {
    const { method = 'GET', body, params, headers: customHeaders } = options

    // Build URL with query params
    const url = new URL(`${this.baseUrl}/${functionName}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value))
        }
      })
    }

    // Get auth headers
    const authHeaders = await this.getAuthHeaders()
    const headers = { ...authHeaders, ...customHeaders }

    // Performance monitoring
    const startTime = performance.now()
    const requestId = `${functionName}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
      }

      if (body) {
        fetchOptions.body = JSON.stringify(body)
      }

      // Log request start (in development only)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[EdgeFunction ${requestId}] → ${method} ${functionName}`, {
          params,
          hasBody: !!fetchOptions.body,
        })
      }

      const response = await fetch(url.toString(), fetchOptions)
      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      // Parse response
      const rawData = await response.json()

      // Log response (in development only)
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `[EdgeFunction ${requestId}] ← ${response.status} (${duration}ms)`,
          {
            success: rawData.success,
            hasError: !!rawData.error,
          }
        )
      }

      // Track performance metrics
      this.trackMetrics(
        functionName,
        method,
        duration,
        rawData.success ? 200 : rawData.error?.status || 500
      )

      // CRITICAL FIX: Backend returns { success, data: {...}, timestamp }
      // Extract the nested 'data' field so consumers get flat structure
      // This aligns with backend refactor using createSuccessResponse()
      return {
        success: rawData.success,
        data: rawData.data, // Extract nested data
        error: rawData.error,
        message: rawData.message,
        meta: rawData.meta,
        timestamp: rawData.timestamp,
      } as EdgeFunctionResponse<T>
    } catch (error) {
      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      console.error(
        `[EdgeFunction ${requestId}] ✗ Error (${duration}ms):`,
        error
      )

      // Track error metrics
      this.trackMetrics(functionName, method, duration, 500)

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          status: 500,
        },
        timestamp: new Date().toISOString(),
      }
    }
  }

  /**
   * Track performance metrics (can be extended to send to analytics service)
   */
  private trackMetrics(
    functionName: string,
    method: string,
    duration: number,
    status: number
  ): void {
    // In production, this could send to DataDog, New Relic, etc.
    if (process.env.NODE_ENV === 'development') {
      const key = `${method}:${functionName}`
      console.debug(`[Metrics] ${key} - ${duration}ms - ${status}`)
    }

    // Store metrics in sessionStorage for debugging
    try {
      const metricsKey = 'edge-function-metrics'
      const existing = JSON.parse(sessionStorage.getItem(metricsKey) || '[]')
      existing.push({
        functionName,
        method,
        duration,
        status,
        timestamp: new Date().toISOString(),
      })
      // Keep only last 100 metrics
      if (existing.length > 100) existing.shift()
      sessionStorage.setItem(metricsKey, JSON.stringify(existing))
    } catch {
      // Ignore storage errors
    }
  }

  // =========================================================================
  // ORGANIZATIONS API
  // =========================================================================

  organizations = {
    /**
     * List all organizations for the current user
     */
    list: () =>
      this.call<{ organizations: unknown[]; isSuperAdmin: boolean }>(
        'organizations'
      ),

    /**
     * Get dashboard stats for an organization
     */
    stats: (organizationId: string) =>
      this.call('dashboard-stats', {
        params: { organization_id: organizationId },
      }),

    /**
     * Create a new organization
     */
    create: (data: {
      name: string
      slug?: string
      description?: string
      subscriptionTier?: 'free' | 'starter' | 'professional' | 'enterprise'
    }) =>
      this.call('organizations', {
        method: 'POST',
        body: data,
      }),

    /**
     * Update an existing organization
     */
    update: (
      organizationId: string,
      data: {
        name?: string
        description?: string
        subscriptionTier?: 'free' | 'starter' | 'professional' | 'enterprise'
        isActive?: boolean
      }
    ) =>
      this.call(`organizations/${organizationId}`, {
        method: 'PUT',
        body: data,
      }),

    /**
     * Delete an organization
     */
    delete: (organizationId: string) =>
      this.call(`organizations/${organizationId}`, {
        method: 'DELETE',
      }),
  }

  // =========================================================================
  // MEMBERS API
  // =========================================================================

  members = {
    /**
     * List members for an organization
     */
    list: (organizationId: string) =>
      this.call('members', {
        params: { organization_id: organizationId },
      }),

    /**
     * Add a member to an organization
     */
    add: (
      organizationId: string,
      data: {
        userId: string
        role: string
      }
    ) =>
      this.call('members', {
        method: 'POST',
        params: { organization_id: organizationId },
        body: data,
      }),

    /**
     * Update a member's role
     */
    updateRole: (organizationId: string, userId: string, role: string) =>
      this.call('members', {
        method: 'PUT',
        params: { organization_id: organizationId },
        body: { userId, role },
      }),

    /**
     * Remove a member from an organization
     */
    remove: (organizationId: string, userId: string) =>
      this.call('members', {
        method: 'DELETE',
        params: { organization_id: organizationId },
        body: { userId },
      }),
  }

  // =========================================================================
  // USER MANAGEMENT API
  // =========================================================================

  users = {
    /**
     * Create a new user
     */
    create: (data: {
      email: string
      password: string
      name: string
      role?: string
    }) =>
      this.call('create-user', {
        method: 'POST',
        body: data,
      }),
  }

  // =========================================================================
  // INTEGRATIONS API
  // =========================================================================

  integrations = {
    /**
     * List integrations for an organization
     */
    list: (organizationId: string) =>
      this.call('integrations', {
        params: { organization_id: organizationId },
      }),

    /**
     * Create a new integration
     */
    create: (data: {
      organizationId: string
      integrationType: string
      name: string
      config: Record<string, unknown>
    }) =>
      this.call('integrations', {
        method: 'POST',
        body: data,
      }),

    /**
     * Update an integration
     */
    update: (
      integrationId: string,
      data: {
        name?: string
        config?: Record<string, unknown>
        status?: string
      }
    ) =>
      this.call(`integrations/${integrationId}`, {
        method: 'PUT',
        body: data,
      }),

    /**
     * Delete an integration
     */
    delete: (integrationId: string) =>
      this.call(`integrations/${integrationId}`, {
        method: 'DELETE',
      }),

    /**
     * Test an integration configuration
     */
    test: (integrationId: string) =>
      this.call(`integration-test`, {
        method: 'POST',
        body: { integrationId },
      }),

    /**
     * Trigger device sync
     */
    sync: (data: {
      integrationId: string
      organizationId: string
      operation: 'test' | 'import' | 'export' | 'bidirectional'
      deviceIds?: string[]
    }) =>
      this.call('device-sync', {
        method: 'POST',
        body: data,
      }),
  }

  // =========================================================================
  // DEVICES API (keeping existing, placed after new APIs)
  // =========================================================================

  devices = {
    /**
     * List all devices for an organization
     */
    list: (organizationId: string, options?: { limit?: number }) =>
      this.call<{ devices: unknown[]; count: number }>('devices', {
        params: {
          organization_id: organizationId,
          ...options,
        },
      }),

    /**
     * Get a specific device by ID
     */
    get: (deviceId: string) => this.call(`devices/${deviceId}`),

    /**
     * Create a new device
     */
    create: (data: unknown) =>
      this.call('devices', {
        method: 'POST',
        body: data,
      }),

    /**
     * Update an existing device
     */
    update: (deviceId: string, data: unknown) =>
      this.call(`devices/${deviceId}`, {
        method: 'PUT',
        body: data,
      }),

    /**
     * Delete a device
     */
    delete: (deviceId: string) =>
      this.call(`devices/${deviceId}`, {
        method: 'DELETE',
      }),
  }

  // =========================================================================
  // ALERTS API
  // =========================================================================

  alerts = {
    /**
     * List alerts for an organization
     */
    list: (
      organizationId: string,
      options?: {
        limit?: number
        severity?: 'info' | 'warning' | 'error' | 'critical'
        resolved?: boolean
      }
    ) =>
      this.call<{ alerts: unknown[]; count: number }>('alerts', {
        params: {
          organization_id: organizationId,
          ...(options?.limit && { limit: options.limit }),
          ...(options?.severity && { severity: options.severity }),
          ...(options?.resolved !== undefined && {
            resolved: options.resolved,
          }),
        },
      }),

    /**
     * Acknowledge an alert
     */
    acknowledge: (alertId: string) =>
      this.call(`alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
      }),

    /**
     * Resolve an alert
     */
    resolve: (alertId: string) =>
      this.call(`alerts/${alertId}/resolve`, {
        method: 'PATCH',
      }),
  }

  // =========================================================================
  // LOCATIONS API
  // =========================================================================

  locations = {
    /**
     * List all locations for an organization
     */
    list: (organizationId: string) =>
      this.call<Location[]>('locations', {
        params: { organization_id: organizationId },
      }),

    /**
     * Create a new location
     */
    create: (data: {
      organization_id: string
      name: string
      description?: string
      address?: string
      city?: string
      state?: string
      country?: string
      postal_code?: string
    }) =>
      this.call('locations', {
        method: 'POST',
        body: data,
      }),

    /**
     * Update an existing location
     */
    update: (
      locationId: string,
      data: {
        name?: string
        description?: string
        address?: string
        city?: string
        state?: string
        country?: string
        postal_code?: string
      }
    ) =>
      this.call('locations', {
        method: 'PATCH',
        params: { id: locationId },
        body: data,
      }),

    /**
     * Delete a location
     */
    delete: (locationId: string) =>
      this.call('locations', {
        method: 'DELETE',
        params: { id: locationId },
      }),
  }

  // =========================================================================
  // DASHBOARD STATS API
  // =========================================================================

  dashboardStats = {
    /**
     * Get dashboard statistics
     */
    get: (organizationId: string) =>
      this.call<{
        devices: { total: number; online: number; offline: number }
        alerts: {
          total: number
          unresolved: number
          bySeverity: Record<string, number>
        }
        integrations: { total: number; active: number }
      }>('dashboard-stats', {
        params: { organization_id: organizationId },
      }),
  }

  // =========================================================================
  // NOTIFICATIONS API
  // =========================================================================

  notifications = {
    /**
     * Send a notification
     */
    send: (data: {
      organization_id: string
      integration_id: string
      message: string
      severity?: string
      metadata?: Record<string, unknown>
    }) =>
      this.call('send-notification', {
        method: 'POST',
        body: data,
      }),

    /**
     * Test notification configuration
     */
    test: (integrationId: string) =>
      this.call('send-notification', {
        method: 'POST',
        params: { test: 'true' },
        body: { integration_id: integrationId },
      }),
  }

  // =========================================================================
  // MQTT BROKER API
  // =========================================================================

  mqttBroker = {
    /**
     * Connect to MQTT broker
     */
    connect: (data: {
      organization_id: string
      integration_id: string
      action: 'connect' | 'disconnect' | 'publish' | 'subscribe'
      topic?: string
      message?: string
    }) =>
      this.call('mqtt-broker', {
        method: 'POST',
        body: data,
      }),
  }
}

/**
 * Singleton instance for use across the application
 */
export const edgeFunctions = new EdgeFunctionClient()

/**
 * Hook for use in React components
 */
export function useEdgeFunctions() {
  return edgeFunctions
}
