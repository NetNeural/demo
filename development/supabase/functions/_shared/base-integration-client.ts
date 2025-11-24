// ===========================================================================
// Base Integration Client - Abstract Base Class
// ===========================================================================
// All integration clients MUST extend this base class to ensure consistency
// across all integrations (Golioth, AWS IoT, Azure IoT, Google IoT, MQTT, etc.)
//
// Key Features:
// - Standardized interface (test, import, export, bidirectionalSync)
// - Built-in activity logging via withActivityLog()
// - Structured logging for debugging and monitoring
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
import { createIntegrationLogger, StructuredLogger, PerformanceTimer } from './structured-logger.ts'
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
  logs?: string[] // Detailed log messages for UI display
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
  updated_at?: string
  // Integration-specific fields
  external_id?: string // ID in external system (Golioth, AWS, Azure, etc.)
  external_metadata?: Record<string, unknown>
}

export interface DeviceConflict {
  deviceId: string
  conflictType: 'data_mismatch' | 'timestamp_conflict' | 'status_conflict'
  fieldName: string
  localValue: unknown
  remoteValue: unknown
  localUpdatedAt?: string
  remoteUpdatedAt?: string
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
  protected logger: StructuredLogger
  protected requestId: string

  constructor(config: IntegrationConfig) {
    this.config = config
    this.requestId = crypto.randomUUID()
    
    // Initialize structured logger
    this.logger = createIntegrationLogger(
      config.type,
      config.integrationId,
      config.organizationId,
      { requestId: this.requestId }
    )
    
    this.logger.info('client_initialized', {
      type: config.type,
      hasSettings: !!config.settings,
    })
    
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
        this.logger.debug('retry_attempt', {
          attempt: attempt + 1,
          maxRetries,
        })
        
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        this.logger.warn('retry_failed', {
          attempt: attempt + 1,
          maxRetries,
          error: (error as Error).message,
        })
        
        // Don't retry on authentication errors (4xx)
        if (error instanceof IntegrationError && error.status && error.status >= 400 && error.status < 500) {
          this.logger.error('retry_aborted_auth_error', error as Error, {
            status: error.status,
          })
          throw error
        }
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt)
          this.logger.debug('retry_backoff', { delay_ms: delay })
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    this.logger.error('retry_exhausted', lastError!, {
      maxRetries,
    })
    throw lastError
  }

  /**
   * Wrap an async operation with activity logging
   * Automatically logs start, success, and failure to integration_activity_log
   * ALSO logs structured logs for debugging and monitoring
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
    
    // Start performance timer
    const timer = new PerformanceTimer(this.logger, action)
    
    // Log to activity log table
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
          requestId: this.requestId,
        }
      }
    )
    
    this.activityLogId = logId || undefined
    
    // Log structured event
    this.logger.info(`${action}_started`, {
      activityType,
      activityLogId: this.activityLogId,
    })
    
    const startTime = Date.now()
    try {
      const result = await fn()
      const responseTimeMs = Date.now() - startTime
      
      // Complete activity log
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
      
      // Log structured success
      this.logger.info(`${action}_completed`, {
        duration_ms: timer.end(),
        activityLogId: this.activityLogId,
      })
      
      return result
    } catch (error) {
      const responseTimeMs = Date.now() - startTime
      const errorData = error instanceof IntegrationError 
        ? error.toJSON()
        : { message: (error as Error).message }
      
      // Complete activity log
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
      
      // Log structured error
      this.logger.error(`${action}_failed`, error as Error, {
        duration_ms: timer.endWithError(error as Error),
        activityLogId: this.activityLogId,
      })
      
      throw error
    }
  }

  /**
   * Make HTTP request with standardized error handling
   * Automatically converts HTTP errors to IntegrationError
   * Adds correlation headers and structured logging
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
    // Add correlation header
    const headers = new Headers(options.headers)
    headers.set('X-Request-ID', this.requestId)
    headers.set('X-Integration-ID', this.config.integrationId)
    headers.set('X-Organization-ID', this.config.organizationId)
    
    const method = (options.method || 'GET').toUpperCase()
    
    // Log request
    this.logger.info('http_request', {
      requestId: this.requestId,
      method,
      url,
      hasBody: !!options.body,
    })
    
    try {
      const response = await fetch(url, { ...options, headers })
      
      // Log response
      this.logger.info('http_response', {
        requestId: this.requestId,
        status: response.status,
        statusText: response.statusText,
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: response.statusText
        }))
        
        const error = new IntegrationError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData.code || 'HTTP_ERROR',
          response.status,
          errorData
        )
        
        this.logger.error('http_error', error, {
          requestId: this.requestId,
          url,
          method,
          status: response.status,
        })
        
        throw error
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
      const networkError = new IntegrationError(
        `Request failed: ${(error as Error).message}`,
        'NETWORK_ERROR',
        undefined,
        { url, error: (error as Error).message }
      )
      
      this.logger.error('network_error', networkError, {
        requestId: this.requestId,
        url,
        method,
      })
      
      throw networkError
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

  // ===========================================================================
  // Telemetry Recording (Universal for All Integrations)
  // ===========================================================================

  /**
   * Record telemetry data during sync operations
   * This ensures ALL integrations (Golioth, AWS IoT, Azure IoT, MQTT, etc.)
   * consistently record telemetry to device_telemetry_history
   * 
   * Use this whenever you sync devices that have telemetry data (temperature,
   * battery, signal strength, custom sensor data, etc.)
   * 
   * @param deviceId - NetNeural device UUID
   * @param telemetry - Telemetry data as JSON object
   * @param deviceTimestamp - Optional device-reported timestamp
   * @returns UUID of created telemetry record, or null if failed
   * 
   * @example
   * // In Golioth sync:
   * const goliothTelemetry = await this.getDeviceTelemetry(goliothDeviceId)
   * await this.recordTelemetry(localDeviceId, goliothTelemetry, goliothTelemetry.timestamp)
   * 
   * @example
   * // In AWS IoT sync:
   * const shadow = await this.getThingShadow(thingName)
   * if (shadow?.state?.reported) {
   *   await this.recordTelemetry(localDeviceId, shadow.state.reported, shadow.metadata?.timestamp)
   * }
   */
  protected async recordTelemetry(
    deviceId: string,
    telemetry: Record<string, unknown>,
    deviceTimestamp?: string
  ): Promise<string | null> {
    try {
      // Skip if telemetry is empty
      if (!telemetry || Object.keys(telemetry).length === 0) {
        return null
      }

      const { data, error } = await this.config.supabase.rpc('record_device_telemetry', {
        p_device_id: deviceId,
        p_organization_id: this.config.organizationId,
        p_telemetry: telemetry,
        p_device_timestamp: deviceTimestamp || new Date().toISOString(),
        p_activity_log_id: this.activityLogId || null,
        p_integration_id: this.config.integrationId,
      })

      if (error) {
        console.error('[BaseIntegrationClient] Failed to record telemetry:', error)
        return null
      }

      return data as string
    } catch (error) {
      console.error('[BaseIntegrationClient] recordTelemetry exception:', error)
      return null
    }
  }

  /**
   * Record multiple telemetry points in batch
   * More efficient for syncing historical telemetry data
   * 
   * @param records - Array of telemetry records
   * @returns Number of successfully recorded entries
   * 
   * @example
   * const goliothHistory = await this.getDeviceTelemetryHistory(deviceId, { since: last24Hours })
   * await this.recordTelemetryBatch(goliothHistory.map(point => ({
   *   deviceId: localDeviceId,
   *   telemetry: point.data,
   *   timestamp: point.timestamp
   * })))
   */
  protected async recordTelemetryBatch(
    records: Array<{
      deviceId: string
      telemetry: Record<string, unknown>
      timestamp?: string
    }>
  ): Promise<number> {
    let successCount = 0

    // Insert in batches of 50 to avoid overwhelming database
    const batchSize = 50
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      
      const promises = batch.map(record =>
        this.recordTelemetry(record.deviceId, record.telemetry, record.timestamp)
      )
      
      const results = await Promise.allSettled(promises)
      successCount += results.filter(r => r.status === 'fulfilled' && r.value !== null).length
    }

    return successCount
  }

  /**
   * Extract telemetry from device metadata
   * Helper function to pull telemetry fields from device metadata JSON
   * 
   * Common fields across all integrations:
   * - battery_level, battery, battery_percentage
   * - temperature, temp
   * - humidity
   * - rssi, signal_strength
   * - firmware_version
   * - uptime, uptime_seconds
   * 
   * @param metadata - Device metadata JSON
   * @returns Extracted telemetry fields
   */
  protected extractTelemetryFromMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    const telemetry: Record<string, unknown> = {}

    // Battery (check multiple field names)
    if ('battery_level' in metadata) telemetry.battery = metadata.battery_level
    else if ('battery' in metadata) telemetry.battery = metadata.battery
    else if ('battery_percentage' in metadata) telemetry.battery = metadata.battery_percentage

    // Temperature
    if ('temperature' in metadata) telemetry.temperature = metadata.temperature
    else if ('temp' in metadata) telemetry.temperature = metadata.temp

    // Humidity
    if ('humidity' in metadata) telemetry.humidity = metadata.humidity

    // Signal strength
    if ('rssi' in metadata) telemetry.rssi = metadata.rssi
    else if ('signal_strength' in metadata) telemetry.rssi = metadata.signal_strength

    // Firmware version
    if ('firmware_version' in metadata) telemetry.firmware_version = metadata.firmware_version
    else if ('firmware' in metadata) telemetry.firmware_version = metadata.firmware

    // Uptime
    if ('uptime' in metadata) telemetry.uptime = metadata.uptime
    else if ('uptime_seconds' in metadata) telemetry.uptime = metadata.uptime_seconds

    return telemetry
  }
}

// ===========================================================================
// Conflict Detection Helpers
// ===========================================================================

/**
 * Detect conflicts between local and remote device data
 * Compares timestamps and values to determine if a conflict exists
 * 
 * @param localDevice - Device from NetNeural database
 * @param remoteDevice - Device from external integration
 * @param strategy - Resolution strategy to apply
 * @returns DeviceConflict if conflict detected, null otherwise
 */
export function detectConflict(
  localDevice: Device,
  remoteDevice: Device,
  strategy: 'manual' | 'local_wins' | 'remote_wins' | 'newest_wins'
): DeviceConflict[] {
  const conflicts: DeviceConflict[] = []
  
  // Fields to check for conflicts
  const fieldsToCompare = ['name', 'status', 'hardware_id', 'location']
  
  for (const field of fieldsToCompare) {
    const localValue = (localDevice as Record<string, unknown>)[field]
    const remoteValue = (remoteDevice as Record<string, unknown>)[field]
    
    // Skip if both values are the same or both undefined
    if (localValue === remoteValue) continue
    if (localValue === undefined && remoteValue === undefined) continue
    
    // For manual strategy, create conflict if values differ
    if (strategy === 'manual') {
      conflicts.push({
        deviceId: localDevice.id,
        conflictType: field === 'status' ? 'status_conflict' : 'data_mismatch',
        fieldName: field,
        localValue,
        remoteValue,
        localUpdatedAt: localDevice.updated_at,
        remoteUpdatedAt: remoteDevice.updated_at,
      })
      continue
    }
    
    // For automatic strategies, only create conflict if we can't auto-resolve
    if (strategy === 'newest_wins') {
      // Need timestamps to auto-resolve
      if (!localDevice.updated_at || !remoteDevice.updated_at) {
        conflicts.push({
          deviceId: localDevice.id,
          conflictType: 'timestamp_conflict',
          fieldName: field,
          localValue,
          remoteValue,
          localUpdatedAt: localDevice.updated_at,
          remoteUpdatedAt: remoteDevice.updated_at,
        })
      }
      // If timestamps exist, newest_wins will auto-resolve (no conflict record needed)
    }
    // local_wins and remote_wins always auto-resolve (no conflict record needed)
  }
  
  return conflicts
}

/**
 * Resolve conflict automatically based on strategy
 * Returns the value to use based on the resolution strategy
 * 
 * @param localValue - Value from NetNeural
 * @param remoteValue - Value from external integration
 * @param localTimestamp - When local was updated
 * @param remoteTimestamp - When remote was updated
 * @param strategy - How to resolve the conflict
 * @returns Resolved value
 */
export function autoResolveConflict(
  localValue: unknown,
  remoteValue: unknown,
  localTimestamp: string | undefined,
  remoteTimestamp: string | undefined,
  strategy: 'local_wins' | 'remote_wins' | 'newest_wins'
): unknown {
  switch (strategy) {
    case 'local_wins':
      return localValue
    
    case 'remote_wins':
      return remoteValue
    
    case 'newest_wins':
      if (!localTimestamp || !remoteTimestamp) {
        // Fall back to remote if timestamps missing
        return remoteValue
      }
      const localTime = new Date(localTimestamp).getTime()
      const remoteTime = new Date(remoteTimestamp).getTime()
      return remoteTime > localTime ? remoteValue : localValue
    
    default:
      return remoteValue
  }
}

/**
 * Log conflict to database
 * Creates a record in device_conflicts table for manual review
 * 
 * @param supabase - Supabase client
 * @param syncLogId - ID of the sync operation
 * @param conflict - Conflict details
 */
export async function logConflict(
  supabase: ReturnType<typeof createClient>,
  syncLogId: string | undefined,
  conflict: DeviceConflict
): Promise<void> {
  const { error } = await supabase
    .from('device_conflicts')
    .insert({
      device_id: conflict.deviceId,
      sync_log_id: syncLogId || null,
      conflict_type: conflict.conflictType,
      field_name: conflict.fieldName,
      local_value: conflict.localValue,
      remote_value: conflict.remoteValue,
      local_updated_at: conflict.localUpdatedAt,
      remote_updated_at: conflict.remoteUpdatedAt,
      resolution_status: 'pending',
    })
  
  if (error) {
    console.error('[Conflict Detection] Failed to log conflict:', error)
  }
}
