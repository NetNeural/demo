// ===========================================================================
// Base Integration Client - Abstract Base Class
// ===========================================================================
// All integration clients MUST extend this base class to ensure consistency
// across all integrations (Golioth, AWS IoT, Azure IoT, Google IoT, MQTT, etc.)
//
// Key Features:
// - Standardized interface (test, import, export, bidirectionalSync)
// - Built-in activity logging via withActivityLog()
// - Common error handling with IntegrationError
// - Retry logic with exponential backoff
// - Type-safe configuration validation
//
// Usage:
//   export class MyClient extends BaseIntegrationClient {
//     protected validateConfig(): void { ... }
//     public async test(): Promise<TestResult> { ... }
//     public async import(): Promise<SyncResult> { ... }
//     public async export(devices: Device[]): Promise<SyncResult> { ... }
//   }
// ===========================================================================

import { logActivityStart, logActivityComplete } from './activity-logger.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ===========================================================================
// Core Types
// ===========================================================================

export type IntegrationType = 
  | 'golioth' 
  | 'aws-iot' 
  | 'azure-iot' 
  | 'google-iot' 
  | 'mqtt' 
  | 'slack' 
  | 'webhook'

export interface IntegrationConfig {
  type: IntegrationType
  settings: Record<string, unknown>
  organizationId: string
  integrationId: string
  supabase: ReturnType<typeof createClient>
}

export interface TestResult {
  success: boolean
  message: string
  details: Record<string, unknown>
}

export interface SyncResult {
  devices_processed: number
  devices_succeeded: number
  devices_failed: number
  errors: string[]
  details?: Record<string, unknown>
}

export interface Device {
  id: string
  name: string
  hardware_id?: string
  status: 'online' | 'offline' | 'unknown' | 'maintenance'
  last_seen?: string
  location?: string
  metadata?: Record<string, unknown>
  tags?: string[]
  // Integration-specific fields
  external_id?: string // ID in external system (Golioth, AWS, Azure, etc.)
  external_metadata?: Record<string, unknown>
}

// ===========================================================================
// Custom Error Class
// ===========================================================================

export class IntegrationError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'IntegrationError'
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      details: this.details,
    }
  }
}

// ===========================================================================
// Abstract Base Client
// ===========================================================================

export abstract class BaseIntegrationClient {
  protected config: IntegrationConfig
  protected activityLogId?: string

  constructor(config: IntegrationConfig) {
    this.config = config
    this.validateConfig()
  }

  // ===========================================================================
  // Abstract Methods (MUST be implemented by subclasses)
  // ===========================================================================

  /**
   * Validate that the configuration contains all required fields
   * Should throw an error if validation fails
   */
  protected abstract validateConfig(): void

  /**
   * Test connectivity to the external integration
   * Should verify credentials are valid and endpoints are reachable
   */
  public abstract test(): Promise<TestResult>

  /**
   * Import devices from external system to NetNeural
   * Should fetch devices from external API and return sync results
   */
  public abstract import(): Promise<SyncResult>

  /**
   * Export devices from NetNeural to external system
   * Should push devices to external API and return sync results
   */
  public abstract export(devices: Device[]): Promise<SyncResult>

  // ===========================================================================
  // Optional Methods (Can be overridden by subclasses)
  // ===========================================================================

  /**
   * Bidirectional sync: Import from external, then export to external
   * Default implementation: runs import() then export()
   * Override if your integration has a more efficient bidirectional sync
   */
  public async bidirectionalSync(devices: Device[]): Promise<SyncResult> {
    const importResult = await this.import()
    const exportResult = await this.export(devices)
    
    return {
      devices_processed: importResult.devices_processed + exportResult.devices_processed,
      devices_succeeded: importResult.devices_succeeded + exportResult.devices_succeeded,
      devices_failed: importResult.devices_failed + exportResult.devices_failed,
      errors: [...importResult.errors, ...exportResult.errors],
      details: {
        import: importResult.details,
        export: exportResult.details,
      },
    }
  }

  // ===========================================================================
  // Utility Methods (Available to all subclasses)
  // ===========================================================================

  /**
   * Retry a function with exponential backoff
   * Useful for handling transient network errors
   * 
   * @param fn - Function to retry
   * @param maxRetries - Maximum number of retry attempts (default: 3)
   * @param baseDelay - Base delay in milliseconds (default: 1000)
   * @returns Result of the function
   * @throws Last error if all retries fail
   */
  protected async retryRequest<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on authentication errors (4xx)
        if (error instanceof IntegrationError && error.status && error.status >= 400 && error.status < 500) {
          throw error
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError
  }

  /**
   * Wrap an async operation with activity logging
   * Automatically logs start, success, and failure to integration_activity_log
   * 
   * @param action - Action name (e.g., 'test', 'import', 'export')
   * @param fn - Async function to execute
   * @returns Result of the function
   */
  protected async withActivityLog<T>(
    action: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const supabase = this.config.supabase
    const activityType = action === 'test' ? 'test_connection' :
      action === 'import' ? 'sync_import' :
      action === 'export' ? 'sync_export' :
      action === 'bidirectionalSync' ? 'sync_bidirectional' : 'other'
    
    const logId = await logActivityStart(
      supabase,
      {
        organizationId: this.config.organizationId,
        integrationId: this.config.integrationId,
        direction: 'outgoing',
        activityType,
        metadata: { 
          type: this.config.type,
          timestamp: new Date().toISOString(),
        }
      }
    )
    
    this.activityLogId = logId || undefined
    const startTime = Date.now()
    try {
      const result = await fn()
      const responseTimeMs = Date.now() - startTime
      
      if (this.activityLogId) {
        await logActivityComplete(
          supabase,
          this.activityLogId, 
          { 
            status: 'success',
            responseTimeMs,
            responseBody: typeof result === 'object' ? result as Record<string, unknown> : { value: result },
          }
        )
      }
      return result
    } catch (error) {
      const responseTimeMs = Date.now() - startTime
      const errorData = error instanceof IntegrationError 
        ? error.toJSON()
        : { message: (error as Error).message }
      
      if (this.activityLogId) {
        await logActivityComplete(
          supabase,
          this.activityLogId, 
          { 
            status: 'failed',
            responseTimeMs,
            errorMessage: errorData.message,
          }
        )
      }
      throw error
    }
  }

  /**
   * Make HTTP request with standardized error handling
   * Automatically converts HTTP errors to IntegrationError
   * 
   * @param url - Request URL
   * @param options - Fetch options
   * @returns Parsed JSON response
   * @throws IntegrationError if request fails
   */
  protected async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const response = await fetch(url, options)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: response.statusText
        }))
        
        throw new IntegrationError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData.code || 'HTTP_ERROR',
          response.status,
          errorData
        )
      }
      
      // Some endpoints return empty responses (204 No Content)
      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {} as T
      }
      
      return await response.json()
    } catch (error) {
      if (error instanceof IntegrationError) {
        throw error
      }
      
      // Network errors, timeout errors, etc.
      throw new IntegrationError(
        `Request failed: ${(error as Error).message}`,
        'NETWORK_ERROR',
        undefined,
        { url, error: (error as Error).message }
      )
    }
  }

  /**
   * Validate required settings exist
   * Helper for validateConfig() implementation
   * 
   * @param requiredFields - Array of required field names
   * @throws Error if any required field is missing
   */
  protected validateRequiredSettings(requiredFields: string[]): void {
    const missing = requiredFields.filter(field => {
      const value = this.config.settings[field]
      return value === undefined || value === null || value === ''
    })
    
    if (missing.length > 0) {
      throw new Error(
        `${this.config.type} integration requires the following settings: ${missing.join(', ')}`
      )
    }
  }

  /**
   * Get typed settings (cast settings to specific type)
   * Useful for accessing integration-specific settings with type safety
   * 
   * @returns Settings cast to type T
   */
  protected getSettings<T>(): T {
    return this.config.settings as T
  }

  /**
   * Create a standardized error result
   * Helper for consistent error responses in test(), import(), export()
   */
  protected createErrorResult(message: string, details?: Record<string, unknown>): TestResult {
    return {
      success: false,
      message,
      details: details || {}
    }
  }

  /**
   * Create a standardized success result
   * Helper for consistent success responses in test(), import(), export()
   */
  protected createSuccessResult(message: string, details?: Record<string, unknown>): TestResult {
    return {
      success: true,
      message,
      details: details || {}
    }
  }

  /**
   * Create an empty sync result
   * Helper for initializing SyncResult objects
   */
  protected createSyncResult(): SyncResult {
    return {
      devices_processed: 0,
      devices_succeeded: 0,
      devices_failed: 0,
      errors: [],
    }
  }
}
