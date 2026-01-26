// ===========================================================================
// Edge Function Client - Type-Safe Frontend SDK (Modular Architecture)
// ===========================================================================
// Centralized client for calling Supabase Edge Functions
// Features: Auto-authentication, type safety, consistent error handling
// Modular: Each API is in its own file for maintainability
// ===========================================================================

import { createClient } from '@/lib/supabase/client'
import type { EdgeFunctionResponse, EdgeFunctionOptions } from './types'

// Import API module creators
import { createDevicesAPI, type DevicesAPI } from './api/devices'
import { createAlertsAPI, type AlertsAPI } from './api/alerts'
import { createOrganizationsAPI, type OrganizationsAPI } from './api/organizations'
import { createMembersAPI, type MembersAPI } from './api/members'
import { createUsersAPI, type UsersAPI } from './api/users'
import { createLocationsAPI, type LocationsAPI } from './api/locations'
import { createIntegrationsAPI, type IntegrationsAPI } from './api/integrations'

// Re-export types for convenience
export type { EdgeFunctionResponse, EdgeFunctionOptions }
export type {
  DevicesAPI,
  AlertsAPI,
  OrganizationsAPI,
  MembersAPI,
  UsersAPI,
  LocationsAPI,
  IntegrationsAPI,
}

/**
 * Centralized Edge Function Client
 * Handles authentication, request formatting, error handling
 */
export class EdgeFunctionClient {
  private baseUrl: string
  private supabase = createClient()

  // API modules
  public devices: DevicesAPI
  public alerts: AlertsAPI
  public organizations: OrganizationsAPI
  public members: MembersAPI
  public users: UsersAPI
  public locations: LocationsAPI
  public integrations: IntegrationsAPI

  constructor() {
    const supabaseUrl = getSupabaseUrl()
    this.baseUrl = `${supabaseUrl}/functions/v1`

    // Initialize all API modules with the call method
    const callBound = this.call.bind(this)
    this.devices = createDevicesAPI(callBound)
    this.alerts = createAlertsAPI(callBound)
    this.organizations = createOrganizationsAPI(callBound)
    this.members = createMembersAPI(callBound)
    this.users = createUsersAPI(callBound)
    this.locations = createLocationsAPI(callBound)
    this.integrations = createIntegrationsAPI(callBound)
  }

  /**
   * Get authentication headers for requests
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await this.supabase.auth.getSession()
    
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
   * This is the core method used by all API modules
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
        console.log(`[EdgeFunction ${requestId}] ← ${response.status} (${duration}ms)`, {
          success: rawData.success,
          hasData: !!rawData.data,
          hasError: !!rawData.error,
        })
      }

      // Track metrics
      this.trackMetrics(functionName, method, duration, response.status)

      // CRITICAL FIX: Backend returns { success, data: {...}, timestamp }
      // But frontend expects { success, data, timestamp }
      // So we extract the nested data layer automatically
      return {
        success: rawData.success,
        data: rawData.data,  // ← Automatic unwrap
        error: rawData.error,
        message: rawData.message,
        meta: rawData.meta,
        timestamp: rawData.timestamp,
      } as EdgeFunctionResponse<T>
    } catch (error) {
      const endTime = performance.now()
      const duration = Math.round(endTime - startTime)

      console.error(`[EdgeFunction ${requestId}] ✖ Error (${duration}ms)`, error)

      // Track failed metrics
      this.trackMetrics(functionName, method, duration, 0)

      // Return structured error response
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Network request failed',
          status: 0,
        },
        timestamp: new Date().toISOString(),
      } as EdgeFunctionResponse<T>
    }
  }

  /**
   * Track performance metrics (stored in sessionStorage)
   */
  private trackMetrics(
    functionName: string,
    method: string,
    duration: number,
    status: number
  ): void {
    if (typeof window === 'undefined') return
    
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
}

/**
 * Singleton instance for use across the application
 */
export const edgeFunctions = new EdgeFunctionClient()
