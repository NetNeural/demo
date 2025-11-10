// ===========================================================================
// Golioth Integration Client
// ===========================================================================
// Extends BaseIntegrationClient to follow unified integration pattern
// Provides device management, telemetry access, and bidirectional sync
// ===========================================================================

import {
  BaseIntegrationClient,
  IntegrationConfig,
  TestResult,
  SyncResult,
  Device,
  IntegrationError,
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
  hardwareId?: string
  projectId: string
  status: 'online' | 'offline' | 'unknown' | 'maintenance'
  lastSeen?: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
  tags?: string[]
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

  constructor(config: IntegrationConfig) {
    super(config)
    const settings = this.getSettings<GoliothSettings>()
    this.apiKey = settings.apiKey
    this.projectId = settings.projectId
    this.baseUrl = settings.baseUrl || 'https://api.golioth.io/v1'
  }

  // ===========================================================================
  // Required Methods (BaseIntegrationClient)
  // ===========================================================================

  protected validateConfig(): void {
    this.validateRequiredSettings(['apiKey', 'projectId'])
  }

  public async test(): Promise<TestResult> {
    return this.withActivityLog('test', async () => {
      try {
        // Test by fetching project info
        const url = `${this.baseUrl}/projects/${this.projectId}`
        await this.requestGolioth(url, { method: 'GET' })
        
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
      let telemetryRecorded = 0
      
      try {
        // Fetch all devices from Golioth
        const goliothDevices = await this.getDevices()
        result.devices_processed = goliothDevices.length
        
        // Convert to NetNeural device format
        for (const goliothDevice of goliothDevices) {
          try {
            // First, upsert the device to get/create NetNeural device ID
            const { data: existingDevice } = await this.config.supabase
              .from('devices')
              .select('id')
              .eq('organization_id', this.config.organizationId)
              .or(`hardware_id.eq.${goliothDevice.hardwareId},external_id.eq.${goliothDevice.id}`)
              .single()

            let localDeviceId = existingDevice?.id

            // If device doesn't exist, create it
            if (!localDeviceId) {
              const { data: newDevice, error: createError } = await this.config.supabase
                .from('devices')
                .insert({
                  organization_id: this.config.organizationId,
                  name: goliothDevice.name,
                  hardware_id: goliothDevice.hardwareId,
                  status: goliothDevice.status,
                  last_seen: goliothDevice.lastSeen,
                  metadata: goliothDevice.metadata,
                  tags: goliothDevice.tags,
                  external_id: goliothDevice.id,
                })
                .select('id')
                .single()

              if (createError || !newDevice) {
                throw new Error(`Failed to create device: ${createError?.message}`)
              }
              localDeviceId = newDevice.id
            } else {
              // Update existing device
              await this.config.supabase
                .from('devices')
                .update({
                  name: goliothDevice.name,
                  hardware_id: goliothDevice.hardwareId,
                  status: goliothDevice.status,
                  last_seen: goliothDevice.lastSeen,
                  metadata: goliothDevice.metadata,
                  tags: goliothDevice.tags,
                  external_id: goliothDevice.id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', localDeviceId)
            }

            // NEW: Fetch and record telemetry from Golioth
            try {
              // Get last 24 hours of telemetry
              const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
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
              }
            } catch (telemetryError) {
              // Don't fail device import if telemetry fetch fails
              console.warn(`Failed to fetch telemetry for ${goliothDevice.name}:`, telemetryError)
            }

            const device: Device = {
              id: localDeviceId,
              name: goliothDevice.name,
              hardware_id: goliothDevice.hardwareId,
              status: goliothDevice.status,
              last_seen: goliothDevice.lastSeen,
              metadata: goliothDevice.metadata,
              tags: goliothDevice.tags,
              external_id: goliothDevice.id,
              external_metadata: {
                projectId: goliothDevice.projectId,
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

        // Add telemetry stats to result
        if (telemetryRecorded > 0) {
          const details = result.details as { telemetry_points?: number }
          details.telemetry_points = telemetryRecorded
        }
        
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
            hardwareId: device.hardware_id,
            status: device.status,
            metadata: device.metadata,
            tags: device.tags,
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
   * Make HTTP request to Golioth API with proper authentication
   */
  private async requestGolioth<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText
      }))
      
      throw new IntegrationError(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        errorData.code || 'GOLIOTH_API_ERROR',
        response.status,
        errorData
      )
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return {} as T
    }

    return await response.json()
  }

  /**
   * Fetch all devices from Golioth project
   */
  async getDevices(): Promise<GoliothDevice[]> {
    const url = `${this.baseUrl}/projects/${this.projectId}/devices`
    const result = await this.requestGolioth<{ data?: GoliothDevice[] }>(url, {
      method: 'GET'
    })
    return result.data || []
  }

  /**
   * Get a specific device by ID
   */
  async getDeviceById(deviceId: string): Promise<GoliothDevice> {
    const url = `${this.baseUrl}/projects/${this.projectId}/devices/${deviceId}`
    return await this.requestGolioth<GoliothDevice>(url, { method: 'GET' })
  }

  /**
   * Get device telemetry data
   */
  async getDeviceTelemetry(
    deviceId: string,
    since?: string
  ): Promise<GoliothTelemetry[]> {
    const params = new URLSearchParams()
    if (since) params.append('since', since)
    
    const url = `${this.baseUrl}/projects/${this.projectId}/devices/${deviceId}/telemetry?${params}`
    const result = await this.requestGolioth<{ data?: GoliothTelemetry[] }>(url, {
      method: 'GET'
    })
    return result.data || []
  }

  /**
   * Create a new device in Golioth
   */
  async createDevice(deviceData: Partial<GoliothDevice>): Promise<GoliothDevice> {
    const url = `${this.baseUrl}/projects/${this.projectId}/devices`
    return await this.requestGolioth<GoliothDevice>(url, {
      method: 'POST',
      body: JSON.stringify(deviceData),
    })
  }

  /**
   * Update an existing device in Golioth
   */
  async updateDevice(
    deviceId: string,
    deviceData: Partial<GoliothDevice>
  ): Promise<GoliothDevice> {
    const url = `${this.baseUrl}/projects/${this.projectId}/devices/${deviceId}`
    return await this.requestGolioth<GoliothDevice>(url, {
      method: 'PUT',
      body: JSON.stringify(deviceData),
    })
  }

  /**
   * Delete a device from Golioth
   */
  async deleteDevice(deviceId: string): Promise<void> {
    const url = `${this.baseUrl}/projects/${this.projectId}/devices/${deviceId}`
    await this.requestGolioth<void>(url, { method: 'DELETE' })
  }
}
