// ===========================================================================
// Golioth Integration Client
// ===========================================================================
// Extends BaseIntegrationClient to follow unified integration pattern
// Provides device management, telemetry access, and bidirectional sync
// Uses axios for reliable HTTP requests to Golioth API
// ===========================================================================

import axios, { type AxiosInstance } from 'npm:axios@1'
import {
  BaseIntegrationClient,
  IntegrationConfig,
  TestResult,
  SyncResult,
  Device,
  IntegrationError,
  detectConflict,
  logConflict,
  autoResolveConflict,
} from './base-integration-client.ts'

// ===========================================================================
// Golioth-Specific Types
// ===========================================================================

export interface GoliothSettings {
  apiKey: string
  projectId: string
  baseUrl?: string
}

export interface GoliothDevice {
  id: string
  name: string
  hardwareIds?: string[]  // Golioth uses plural array
  blueprintId?: string
  cohortId?: string
  enabled: boolean
  status: string  // Golioth uses "-" for unknown, we normalize to offline
  lastReport?: string  // Most recent activity timestamp
  createdAt: string
  updatedAt: string
  metadata?: {
    lastReport?: string
    lastSeenOnline?: string
    lastSeenOffline?: string
    status?: string
    lastSettingsStatus?: unknown
    update?: Record<string, unknown>
    [key: string]: unknown
  }
  tagIds?: string[]
  data?: Record<string, unknown>
}

export interface GoliothTelemetry {
  deviceId: string
  timestamp: string
  data: Record<string, unknown>
}

// ===========================================================================
// Golioth Client Implementation
// ===========================================================================

export class GoliothClient extends BaseIntegrationClient {
  private apiKey: string
  private projectId: string
  private baseUrl: string
  private httpClient: AxiosInstance

  constructor(config: IntegrationConfig) {
    super(config)
    const settings = this.getSettings<GoliothSettings>()
    this.apiKey = settings.apiKey
    this.projectId = settings.projectId
    this.baseUrl = settings.baseUrl || 'https://api.golioth.io/v1'
    
    // Create axios instance with proper configuration
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    })
  }

  // ===========================================================================
  // Required Methods (BaseIntegrationClient)
  // ===========================================================================

  protected validateConfig(): void {
    this.validateRequiredSettings(['apiKey', 'projectId'])
  }

  /**
   * Normalize Golioth device status to match our database enum
   * Database accepts: 'online' | 'offline' | 'warning' | 'error'
   * Base Device interface expects: 'online' | 'offline' | 'unknown' | 'maintenance'
   * We map to database enum for storage, 'unknown' for the interface
   */
  private normalizeDeviceStatus(status: string | undefined): 'online' | 'offline' | 'warning' | 'error' {
    if (!status || status === '-' || status === '') return 'offline'
    const normalized = status.toLowerCase()
    if (normalized === 'online' || normalized === 'connected') return 'online'
    if (normalized === 'offline' || normalized === 'disconnected') return 'offline'
    if (normalized === 'warning' || normalized === 'maintenance') return 'warning'
    if (normalized === 'error' || normalized === 'critical') return 'error'
    return 'offline'
  }
  
  /**
   * Map database status to base Device interface status
   */
  private mapToDeviceInterfaceStatus(status: string): 'online' | 'offline' | 'unknown' | 'maintenance' {
    if (status === 'online') return 'online'
    if (status === 'offline') return 'offline'
    if (status === 'warning') return 'maintenance'
    if (status === 'error') return 'unknown'
    return 'unknown'
  }

  /**
   * Determine device type from Golioth metadata only
   * Priority: 1) metadata.deviceType 2) cohortId 3) blueprintId
   * Does NOT use device name patterns (unreliable - users can name devices anything)
   */
  private determineDeviceType(device: GoliothDevice): string {
    // Check explicit deviceType in metadata first
    if (device.metadata?.deviceType) {
      return device.metadata.deviceType as string
    }

    // Check cohort ID for type hints
    if (device.cohortId) {
      const cohort = device.cohortId.toLowerCase()
      if (cohort.includes('gateway')) return 'cellular-gateway'
      if (cohort.includes('sensor')) return 'iot-sensor'
      if (cohort.includes('meter')) return 'iot-meter'
      if (cohort.includes('monitor')) return 'iot-monitor'
    }

    // Check blueprint ID for type hints
    if (device.blueprintId) {
      const blueprint = device.blueprintId.toLowerCase()
      if (blueprint.includes('gateway')) return 'cellular-gateway'
      if (blueprint.includes('sensor')) return 'iot-sensor'
      if (blueprint.includes('meter')) return 'iot-meter'
      if (blueprint.includes('monitor')) return 'iot-monitor'
    }

    // Default fallback - generic IoT device
    return 'iot-device'
  }

  /**
   * Compute a deterministic key for an alert originating from Golioth.
   * Includes timestamp to allow multiple instances of the same alert type over time.
   * Format: golioth:{projectId}:{deviceId}:{alertType}:{hash(trigger_conditions)}:{timestamp}
   */
  private computeGoliothAlertKey(projectId: string, deviceId: string, alertType: string, triggerConditions: Record<string, unknown>, timestamp?: string): string {
    const payload = JSON.stringify(triggerConditions || {})
    // Simple, deterministic djb2 hash
    let hash = 5381
    for (let i = 0; i < payload.length; i++) {
      // charCodeAt is safe for JSON-stringified ASCII/UTF-8
      hash = ((hash << 5) + hash) + payload.charCodeAt(i) // hash * 33 + c
      hash = hash & 0xffffffff
    }
    const hex = (hash >>> 0).toString(16)
    const ts = timestamp || new Date().toISOString()
    return `golioth:${projectId}:${deviceId}:${alertType}:${hex}:${ts}`
  }

  public async test(): Promise<TestResult> {
    return this.withActivityLog('test', async () => {
      try {
        await this.httpClient.get(`/projects/${this.projectId}`)
        
        return this.createSuccessResult(
          `Golioth project '${this.projectId}' is accessible`,
          { projectId: this.projectId }
        )
      } catch (error) {
        return this.createErrorResult(
          `Golioth API error: ${(error as Error).message}`,
          { projectId: this.projectId }
        )
      }
    })
  }

  public async import(): Promise<SyncResult> {
    return this.withActivityLog('import', async () => {
      const result = this.createSyncResult()
      const logs: string[] = []
      let telemetryRecorded = 0
      let alertsCreated = 0
      
      try {
        // Log configuration for debugging
        logs.push(`[GoliothClient] Import starting with config: baseUrl=${this.baseUrl}, projectId=${this.projectId}`)
        console.log('[GoliothClient] Import starting with config:', {
          baseUrl: this.baseUrl,
          projectId: this.projectId,
          hasApiKey: !!this.apiKey,
          apiKeyLength: this.apiKey?.length
        })
        
        // Fetch all devices from Golioth
        const goliothDevices = await this.getDevices()
        logs.push(`[GoliothClient] Fetched ${goliothDevices.length} devices from Golioth`)
        console.log('[GoliothClient] Fetched devices from Golioth:', goliothDevices.length)
        result.devices_processed = goliothDevices.length
        
        // Fetch project metadata for additional context
        let projectMetadata: { name?: string; id?: string } | null = null
        try {
          projectMetadata = await this.getProjectInfo()
        } catch (err) {
          console.warn('Could not fetch project metadata:', err)
        }
        
        // Convert to NetNeural device format
        for (const goliothDevice of goliothDevices) {
          try {
            // First check for hardware ID match, then external ID
            const hardwareIdMatch = goliothDevice.hardwareIds?.[0]
            const query = hardwareIdMatch 
              ? `hardware_ids.cs.{${hardwareIdMatch}},external_device_id.eq.${goliothDevice.id}`
              : `external_device_id.eq.${goliothDevice.id}`
            
            // First, upsert the device to get/create NetNeural device ID
            const { data: existingDevice } = await this.config.supabase
              .from('devices')
              .select('id, device_type, metadata')
              .eq('organization_id', this.config.organizationId)
              .or(query)
              .single()

            let localDeviceId = existingDevice?.id

            // Determine last_seen timestamp from available fields
            const lastSeen = goliothDevice.lastReport || 
                           goliothDevice.metadata?.lastSeenOnline || 
                           goliothDevice.metadata?.lastReport ||
                           goliothDevice.updatedAt

            // If device doesn't exist, create it
            if (!localDeviceId) {
              const logMsg = `📝 Creating device: ${goliothDevice.name} (status: ${goliothDevice.status} → ${this.normalizeDeviceStatus(goliothDevice.status)})`
              logs.push(logMsg)
              console.log(logMsg)
              
              const devicePayload = {
                id: crypto.randomUUID(), // Explicitly generate UUID to avoid Supabase client caching bug
                organization_id: this.config.organizationId,
                integration_id: this.config.integrationId,
                name: goliothDevice.name,
                device_type: this.determineDeviceType(goliothDevice),
                hardware_ids: goliothDevice.hardwareIds || [],
                status: this.normalizeDeviceStatus(goliothDevice.status),
                last_seen: lastSeen,
                metadata: {
                  ...goliothDevice.metadata,
                  golioth_project_id: this.projectId,
                  golioth_project_name: projectMetadata?.name,
                  golioth_original_status: goliothDevice.status,
                  golioth_blueprint_id: goliothDevice.blueprintId,
                  golioth_cohort_id: goliothDevice.cohortId,
                  golioth_enabled: goliothDevice.enabled,
                  golioth_tag_ids: goliothDevice.tagIds || [],
                  imported_at: new Date().toISOString(),
                },
                external_device_id: goliothDevice.id,
              }
              
              console.log('[GoliothClient] *** ATTEMPTING INSERT with payload:', JSON.stringify(devicePayload, null, 2))
              
              const { data: newDevice, error: createError } = await this.config.supabase
                .from('devices')
                .insert(devicePayload)
                .select('id')
                .single()

              console.log('[GoliothClient] *** INSERT RESULT:', { 
                success: !!newDevice, 
                error: createError ? { message: createError.message, code: createError.code, details: createError.details, hint: createError.hint } : null,
                deviceId: newDevice?.id 
              })
              
              if (createError || !newDevice) {
                const errorMsg = `Failed to create device: ${createError?.message} (code: ${createError?.code}, details: ${JSON.stringify(createError?.details)})`
                console.error('[GoliothClient] *** INSERT FAILED:', errorMsg)
                throw new Error(errorMsg)
              }
              localDeviceId = newDevice.id
              const successMsg = `✅ Device created: ${goliothDevice.name}`
              logs.push(successMsg)
              console.log(successMsg)
            } else {
              const updateMsg = `🔄 Updating device: ${goliothDevice.name} (status: ${goliothDevice.status} → ${this.normalizeDeviceStatus(goliothDevice.status)})`
              logs.push(updateMsg)
              console.log(updateMsg)
              
              // Get conflict resolution strategy from settings
              const settings = this.getSettings<GoliothSettings & { conflictResolution?: string }>()
              const conflictStrategy = (settings.conflictResolution || 'remote_wins') as 'manual' | 'local_wins' | 'remote_wins' | 'newest_wins'
              
              // Prepare local and remote device data for conflict detection
              const localDevice: Device = {
                id: localDeviceId!,
                name: existingDevice.metadata?.name || 'Unknown',
                hardware_id: existingDevice.metadata?.hardware_ids?.[0],
                status: existingDevice.metadata?.status || 'offline',
                updated_at: existingDevice.metadata?.updated_at,
                metadata: existingDevice.metadata,
              }
              
              const remoteDevice: Device = {
                id: localDeviceId!,
                name: goliothDevice.name,
                hardware_id: goliothDevice.hardwareIds?.[0],
                status: this.normalizeDeviceStatus(goliothDevice.status),
                updated_at: goliothDevice.updatedAt,
                metadata: goliothDevice.metadata,
              }
              
              // Detect conflicts
              const conflicts = detectConflict(localDevice, remoteDevice, conflictStrategy)
              
              if (conflicts.length > 0) {
                console.log(`[GoliothClient] Detected ${conflicts.length} conflicts for device ${goliothDevice.name}`)
                logs.push(`⚠️  Detected ${conflicts.length} conflicts for ${goliothDevice.name}`)
                
                // Log conflicts to database if strategy is manual
                if (conflictStrategy === 'manual') {
                  for (const conflict of conflicts) {
                    await logConflict(this.config.supabase, undefined, conflict)
                  }
                  // Skip update for manual resolution
                  result.devices_failed++
                  errors.push(`${goliothDevice.name}: Conflicts require manual resolution`)
                  continue
                }
              }
              
              // For automatic strategies, resolve conflicts and update
              const resolvedName = conflicts.find(c => c.fieldName === 'name')
                ? autoResolveConflict(localDevice.name, remoteDevice.name, localDevice.updated_at, remoteDevice.updated_at, conflictStrategy as any)
                : goliothDevice.name
              
              const resolvedStatus = conflicts.find(c => c.fieldName === 'status')
                ? autoResolveConflict(localDevice.status, remoteDevice.status, localDevice.updated_at, remoteDevice.updated_at, conflictStrategy as any)
                : this.normalizeDeviceStatus(goliothDevice.status)
              
              // Check if device_type was manually changed (not auto-detected)
              const autoDetectedType = this.determineDeviceType(goliothDevice)
              const wasManuallySet = existingDevice.metadata?.device_type_manually_set === true
              const shouldPreserveType = wasManuallySet || 
                (existingDevice.device_type && existingDevice.device_type !== autoDetectedType && existingDevice.device_type !== 'iot-device')
              
              // Update existing device with latest data
              await this.config.supabase
                .from('devices')
                .update({
                  name: String(resolvedName),
                  // Only update device_type if it wasn't manually set
                  ...(shouldPreserveType ? {} : { device_type: autoDetectedType }),
                  hardware_ids: goliothDevice.hardwareIds || [],
                  status: String(resolvedStatus),
                  last_seen: lastSeen,
                  metadata: {
                    ...goliothDevice.metadata,
                    golioth_project_id: this.projectId,
                    golioth_project_name: projectMetadata?.name,
                    golioth_original_status: goliothDevice.status,
                    golioth_blueprint_id: goliothDevice.blueprintId,
                    golioth_cohort_id: goliothDevice.cohortId,
                    golioth_enabled: goliothDevice.enabled,
                    golioth_tag_ids: goliothDevice.tagIds || [],
                    last_synced_at: new Date().toISOString(),
                    ...(conflicts.length > 0 && { 
                      last_conflict_resolution: conflictStrategy,
                      last_conflict_count: conflicts.length 
                    }),
                  },
                  external_device_id: goliothDevice.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', localDeviceId)
              
              const updatedMsg = `✅ Device updated: ${goliothDevice.name}${conflicts.length > 0 ? ` (${conflicts.length} conflicts auto-resolved: ${conflictStrategy})` : ''}`
              logs.push(updatedMsg)
              console.log(updatedMsg)
            }

            // Create default alerts for new/synced devices based on device type
            if (localDeviceId) {
              try {
                const deviceType = String(goliothDevice.metadata?.deviceType || goliothDevice.metadata?.type || 'sensor')
                const alertsToCreate = this.generateDefaultAlertsForDevice(goliothDevice.name, deviceType)
                
                const alertCheckMsg = `🔔 Checking alerts for ${goliothDevice.name}: ${alertsToCreate.length} potential alerts`
                logs.push(alertCheckMsg)
                console.log(alertCheckMsg)
                
                for (const alertData of alertsToCreate) {
                  // Compute a unique key for this alert instance (includes timestamp)
                  const goliothKey = this.computeGoliothAlertKey(this.projectId, goliothDevice.id, alertData.alert_type, alertData.trigger_conditions)

                  // Insert new alert with unique golioth_key (timestamp makes each instance unique)
                  const toInsert = {
                    id: crypto.randomUUID(), // Explicitly generate UUID to avoid Supabase client caching bug
                    organization_id: this.config.organizationId,
                    device_id: localDeviceId,
                    title: alertData.title,
                    message: alertData.message,
                    alert_type: alertData.alert_type,
                    severity: alertData.severity,
                    metadata: {
                      ...alertData.trigger_conditions && { trigger_conditions: alertData.trigger_conditions },
                      golioth_key: goliothKey,
                      golioth_device_id: goliothDevice.id,
                      golioth_project_id: this.projectId,
                    },
                    is_resolved: false,
                  }

                  const { error: alertError } = await this.config.supabase
                    .from('alerts')
                    .insert(toInsert)

                  if (!alertError) {
                    alertsCreated++
                    const alertCreatedMsg = `  ✅ Created alert: ${alertData.title}`
                    logs.push(alertCreatedMsg)
                    console.log(alertCreatedMsg)
                  } else {
                    const alertErrMsg = `  ✗ Failed to create alert ${alertData.title}: ${alertError.message}`
                    logs.push(alertErrMsg)
                    console.warn(alertErrMsg)
                  }
                }
              } catch (alertErr) {
                const alertErrMsg = `Could not create alerts for device ${goliothDevice.name}: ${alertErr}`
                logs.push(alertErrMsg)
                console.warn(alertErrMsg)
              }
            }

            // Fetch and record telemetry from Golioth
            try {
              // Get last 24 hours of telemetry
              const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
              const telemetryMsg = `📊 Fetching telemetry for ${goliothDevice.name} (last 24h)...`
              logs.push(telemetryMsg)
              console.log(telemetryMsg)
              const telemetryData = await this.getDeviceTelemetry(goliothDevice.id, since)

              // Record each telemetry point
              if (telemetryData && telemetryData.length > 0) {
                const recordCount = await this.recordTelemetryBatch(
                  telemetryData.map(point => ({
                    deviceId: localDeviceId!,
                    telemetry: point.data,
                    timestamp: point.timestamp,
                  }))
                )
                telemetryRecorded += recordCount
                const telemetrySuccessMsg = `  ✅ Recorded ${recordCount} telemetry points for ${goliothDevice.name}`
                logs.push(telemetrySuccessMsg)
                console.log(telemetrySuccessMsg)
              } else {
                const noTelemetryMsg = `  ℹ️  No telemetry data available for ${goliothDevice.name}`
                logs.push(noTelemetryMsg)
                console.log(noTelemetryMsg)
              }
            } catch (telemetryError) {
              // Don't fail device import if telemetry fetch fails
              const telemetryErrMsg = `⚠️  Failed to fetch telemetry for ${goliothDevice.name}: ${telemetryError}`
              logs.push(telemetryErrMsg)
              console.warn(telemetryErrMsg)
            }

            const device: Device = {
              id: localDeviceId,
              name: goliothDevice.name,
              hardware_id: goliothDevice.hardwareIds?.[0] || '',
              status: this.mapToDeviceInterfaceStatus(this.normalizeDeviceStatus(goliothDevice.status)),
              last_seen: lastSeen,
              metadata: goliothDevice.metadata,
              tags: goliothDevice.tagIds || [],
              external_id: goliothDevice.id,
              external_metadata: {
                blueprintId: goliothDevice.blueprintId,
                cohortId: goliothDevice.cohortId,
                enabled: goliothDevice.enabled,
                createdAt: goliothDevice.createdAt,
                updatedAt: goliothDevice.updatedAt,
              },
            }
            
            result.devices_succeeded++
            result.details = result.details || {}
            const details = result.details as { devices?: Device[]; telemetry_points?: number }
            details.devices = details.devices || []
            details.devices.push(device)
          } catch (error) {
            result.devices_failed++
            result.errors.push(`${goliothDevice.name}: ${(error as Error).message}`)
          }
        }

        // Add telemetry and alerts stats to result
        if (telemetryRecorded > 0 || alertsCreated > 0) {
          const details = result.details as { telemetry_points?: number; alerts_created?: number }
          if (telemetryRecorded > 0) {
            details.telemetry_points = telemetryRecorded
          }
          if (alertsCreated > 0) {
            details.alerts_created = alertsCreated
          }
        }
        
        // Add logs to result
        result.logs = logs
        
        return result
      } catch (error) {
        result.errors.push(`Import failed: ${(error as Error).message}`)
        return result
      }
    })
  }

  public async export(devices: Device[]): Promise<SyncResult> {
    return this.withActivityLog('export', async () => {
      const result = this.createSyncResult()
      result.devices_processed = devices.length
      
      for (const device of devices) {
        try {
          // Check if device exists in Golioth
          const existingDevice = await this.getDeviceById(device.external_id || device.id).catch(() => null)
          
          const goliothDevice: Partial<GoliothDevice> = {
            name: device.name,
            hardwareIds: device.hardware_id ? [device.hardware_id] : [],
            metadata: device.metadata,
            tagIds: device.tags,
          }
          
          if (existingDevice) {
            // Update existing device
            await this.updateDevice(existingDevice.id, goliothDevice)
          } else {
            // Create new device
            await this.createDevice(goliothDevice)
          }
          
          result.devices_succeeded++
        } catch (error) {
          result.devices_failed++
          result.errors.push(`${device.name}: ${(error as Error).message}`)
        }
      }
      
      return result
    })
  }

  // ===========================================================================
  // Golioth-Specific Methods
  // ===========================================================================

  /**
   * Fetch all devices from Golioth project
   */
  async getDevices(): Promise<GoliothDevice[]> {
    try {
      console.log('[GoliothClient] Fetching devices for project:', this.projectId)
      
      const response = await this.httpClient.get(`/projects/${this.projectId}/devices`)
      
      // Golioth API returns {list: [], page, perPage, total}
      const data = response.data as { list: GoliothDevice[]; page: number; perPage: number; total: number }
      
      console.log('[GoliothClient] Fetched devices:', {
        count: data.list.length,
        page: data.page,
        total: data.total
      })
      
      return data.list
    } catch (error) {
      console.error('[GoliothClient] Error fetching devices:', error)
      throw new IntegrationError(
        `Failed to fetch devices: ${(error as Error).message}`,
        'GOLIOTH_FETCH_ERROR'
      )
    }
  }

  /**
   * Get a specific device by ID
   */
  async getDeviceById(deviceId: string): Promise<GoliothDevice> {
    const response = await this.httpClient.get(`/projects/${this.projectId}/devices/${deviceId}`)
    const data = response.data as { data: GoliothDevice }
    return data.data
  }

  /**
   * Get device telemetry data
   * Note: Golioth uses LightDB Stream for telemetry data
   * This may require additional configuration or may not be available for all devices
   */
  async getDeviceTelemetry(
    deviceId: string,
    since?: string
  ): Promise<GoliothTelemetry[]> {
    try {
      // Fetch from LightDB Stream endpoint - correct path from OpenAPI spec
      const params: Record<string, string> = {}
      if (since) {
        params.start = since
        params.end = new Date().toISOString()
      }
      
      const response = await this.httpClient.get(
        `/projects/${this.projectId}/devices/${deviceId}/stream`,
        { 
          params,
          validateStatus: (status: number) => status === 200 || status === 404
        }
      )
      
      if (response.status === 404) {
        // Telemetry endpoint not available for this device
        return []
      }
      
      const data = response.data as { list: GoliothTelemetry[]; page: number; perPage: number; total: number }
      return data.list || []
    } catch (error) {
      // Telemetry fetching is optional - don't throw
      console.warn(`[GoliothClient] Telemetry not available for device ${deviceId}:`, error)
      return []
    }
  }

  /**
   * Create a new device in Golioth
   */
  async createDevice(deviceData: Partial<GoliothDevice>): Promise<GoliothDevice> {
    const response = await this.httpClient.post(`/projects/${this.projectId}/devices`, deviceData)
    const data = response.data as { data: GoliothDevice }
    return data.data
  }

  /**
   * Update an existing device in Golioth
   */
  async updateDevice(
    deviceId: string,
    deviceData: Partial<GoliothDevice>
  ): Promise<GoliothDevice> {
    const response = await this.httpClient.put(`/projects/${this.projectId}/devices/${deviceId}`, deviceData)
    const data = response.data as { data: GoliothDevice }
    return data.data
  }

  /**
   * Delete a device from Golioth
   */
  async deleteDevice(deviceId: string): Promise<void> {
    await this.httpClient.delete(`/projects/${this.projectId}/devices/${deviceId}`)
  }

  /**
   * Get project information from Golioth
   */
  async getProjectInfo(): Promise<{ id: string; name: string; [key: string]: unknown }> {
    const response = await this.httpClient.get(`/projects/${this.projectId}`)
    const data = response.data as { data: { id: string; name: string; [key: string]: unknown } }
    return data.data
  }

  /**
   * Generate default alerts for a device based on its type
   */
  private generateDefaultAlertsForDevice(deviceName: string, deviceType: string): Array<{
    title: string
    message: string
    alert_type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    trigger_conditions: Record<string, unknown>
    is_active: boolean
  }> {
    const alerts: Array<{
      title: string
      message: string
      alert_type: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      trigger_conditions: Record<string, unknown>
      is_active: boolean
    }> = []

    // Generic offline alert for all devices
    alerts.push({
      title: `${deviceName} - Device Offline`,
      message: `Device ${deviceName} has been offline for more than 15 minutes`,
      alert_type: 'device_offline',
      severity: 'medium',
      trigger_conditions: {
        offline_duration_minutes: 15
      },
      is_active: true
    })

    // Type-specific alerts
    const lowerType = deviceType.toLowerCase()
    const lowerName = deviceName.toLowerCase()
    
    if (lowerType.includes('temperature') || lowerType.includes('temp') || lowerName.includes('temperature') || lowerName.includes('temp')) {
      alerts.push({
        title: `${deviceName} - High Temperature`,
        message: `Temperature reading exceeds 80°F threshold`,
        alert_type: 'threshold',
        severity: 'high',
        trigger_conditions: {
          metric: 'temperature',
          operator: '>',
          threshold: 80,
          unit: '°F'
        },
        is_active: true
      })
    }

    if (lowerType.includes('humidity') || lowerName.includes('humidity')) {
      alerts.push({
        title: `${deviceName} - High Humidity`,
        message: `Humidity level exceeds 85% threshold`,
        alert_type: 'threshold',
        severity: 'medium',
        trigger_conditions: {
          metric: 'humidity',
          operator: '>',
          threshold: 85,
          unit: '%'
        },
        is_active: true
      })
    }

    if (lowerType.includes('pressure') || lowerName.includes('pressure')) {
      alerts.push({
        title: `${deviceName} - Abnormal Pressure`,
        message: `Pressure reading outside normal range (980-1050 hPa)`,
        alert_type: 'threshold',
        severity: 'medium',
        trigger_conditions: {
          metric: 'pressure',
          operator: 'outside_range',
          min_threshold: 980,
          max_threshold: 1050,
          unit: 'hPa'
        },
        is_active: true
      })
    }

    if (lowerType.includes('battery') || lowerName.includes('battery')) {
      alerts.push({
        title: `${deviceName} - Low Battery`,
        message: `Battery level is below 20% - device may shut down soon`,
        alert_type: 'threshold',
        severity: 'critical',
        trigger_conditions: {
          metric: 'battery_level',
          operator: '<',
          threshold: 20,
          unit: '%'
        },
        is_active: true
      })
    }

    if (lowerType.includes('motion') || lowerType.includes('door') || lowerType.includes('security') || lowerName.includes('motion') || lowerName.includes('door') || lowerName.includes('security') || lowerName.includes('detector')) {
      alerts.push({
        title: `${deviceName} - Motion Detected`,
        message: `Motion or activity detected by ${deviceName}`,
        alert_type: 'event',
        severity: 'low',
        trigger_conditions: {
          event_type: 'motion_detected'
        },
        is_active: true
      })
    }

    if (lowerType.includes('smoke') || lowerType.includes('fire') || lowerType.includes('co2') || lowerName.includes('smoke') || lowerName.includes('fire') || lowerName.includes('co2')) {
      alerts.push({
        title: `${deviceName} - Safety Alert`,
        message: lowerType.includes('co2') ? `CO2 level exceeds safe threshold of 1000 ppm` : `Smoke or fire detected`,
        alert_type: 'threshold',
        severity: 'critical',
        trigger_conditions: {
          metric: lowerType.includes('co2') ? 'co2_level' : 'smoke_level',
          operator: '>',
          threshold: lowerType.includes('co2') ? 1000 : 50,
          unit: lowerType.includes('co2') ? 'ppm' : 'level'
        },
        is_active: true
      })
    }

    return alerts
  }
}
