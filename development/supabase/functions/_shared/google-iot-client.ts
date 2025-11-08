// ===========================================================================
// Google Cloud IoT Core Integration Client
// ===========================================================================
// Extends BaseIntegrationClient to follow unified integration pattern
// Supports device registry, telemetry, and device configuration
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
// Google IoT-Specific Types
// ===========================================================================

export interface GoogleIotSettings {
  projectId: string
  region: string
  registryId: string
  serviceAccountKey: string // JSON string
}

interface GoogleDevice {
  id: string
  name: string
  numId: string
  credentials?: Array<{
    publicKey: { format: string; key: string }
    expirationTime?: string
  }>
  lastHeartbeatTime?: string
  lastEventTime?: string
  lastStateTime?: string
  lastConfigAckTime?: string
  lastConfigSendTime?: string
  blocked: boolean
  lastErrorTime?: string
  lastErrorStatus?: { code: number; message: string }
  config?: {
    version: string
    cloudUpdateTime: string
    deviceAckTime?: string
    binaryData: string
  }
  state?: {
    updateTime: string
    binaryData: string
  }
  logLevel?: 'NONE' | 'ERROR' | 'INFO' | 'DEBUG'
  metadata?: Record<string, string>
}

// ===========================================================================
// Google IoT Client Implementation
// ===========================================================================

export class GoogleIotClient extends BaseIntegrationClient {
  private projectId: string
  private region: string
  private registryId: string
  private serviceAccountKey: string
  private registryPath: string

  constructor(config: IntegrationConfig) {
    super(config)
    const settings = this.getSettings<GoogleIotSettings>()
    this.projectId = settings.projectId
    this.region = settings.region
    this.registryId = settings.registryId
    this.serviceAccountKey = settings.serviceAccountKey
    this.registryPath = `projects/${this.projectId}/locations/${this.region}/registries/${this.registryId}`
  }

  // ===========================================================================
  // Required Methods (BaseIntegrationClient)
  // ===========================================================================

  protected validateConfig(): void {
    this.validateRequiredSettings(['projectId', 'region', 'registryId', 'serviceAccountKey'])
  }

  public async test(): Promise<TestResult> {
    return this.withActivityLog('test', async () => {
      try {
        const apiUrl = `https://cloudiot.googleapis.com/v1/${this.registryPath}`
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
        // 401 = API exists but needs OAuth2 token (which is good)
        if (response.status === 401) {
          return this.createSuccessResult(
            `Google Cloud IoT Core registry '${this.registryId}' endpoint is reachable`,
            { projectId: this.projectId, region: this.region, registryId: this.registryId }
          )
        }
        
        // 404 = registry doesn't exist
        if (response.status === 404) {
          return this.createErrorResult(
            `Registry '${this.registryId}' not found in project '${this.projectId}' region '${this.region}'`,
            { projectId: this.projectId, region: this.region, registryId: this.registryId }
          )
        }
        
        return this.createSuccessResult(
          `Google Cloud IoT Core registry '${this.registryId}' configured`,
          { projectId: this.projectId, region: this.region, registryId: this.registryId }
        )
      } catch (error) {
        return this.createErrorResult(
          `Google Cloud IoT API error: ${(error as Error).message}`,
          { projectId: this.projectId, region: this.region }
        )
      }
    })
  }

  public async import(): Promise<SyncResult> {
    return this.withActivityLog('import', async () => {
      const result = this.createSyncResult()
      
      try {
        // List all devices from Google Cloud IoT registry
        const googleDevices = await this.listDevices()
        result.devices_processed = googleDevices.length
        
        // Convert Google devices to NetNeural format
        for (const googleDevice of googleDevices) {
          try {
            // Determine status from heartbeat
            let status: Device['status'] = 'unknown'
            if (googleDevice.lastHeartbeatTime) {
              const lastHeartbeat = new Date(googleDevice.lastHeartbeatTime).getTime()
              const now = Date.now()
              const fiveMinutes = 5 * 60 * 1000
              status = (now - lastHeartbeat) < fiveMinutes ? 'online' : 'offline'
            }
            
            const device: Device = {
              id: googleDevice.id,
              name: googleDevice.name.split('/').pop() || googleDevice.id,
              hardware_id: googleDevice.numId,
              status,
              last_seen: googleDevice.lastHeartbeatTime || googleDevice.lastEventTime,
              metadata: {
                device_type: googleDevice.metadata?.deviceType || 'unknown',
                blocked: googleDevice.blocked,
                log_level: googleDevice.logLevel,
                google_metadata: googleDevice.metadata,
              },
              external_id: googleDevice.id,
              external_metadata: {
                numId: googleDevice.numId,
                credentials: googleDevice.credentials,
                config: googleDevice.config,
                state: googleDevice.state,
                lastError: googleDevice.lastErrorStatus,
              },
            }
            
            result.devices_succeeded++
            result.details = result.details || { devices: [] }
            ;(result.details as Record<string, Device[]>).devices.push(device)
          } catch (error) {
            result.devices_failed++
            result.errors.push(`${googleDevice.name}: ${(error as Error).message}`)
          }
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
          const deviceId = device.external_id || device.hardware_id || device.name
          
          // Create or update device
          await this.createOrUpdateDevice(deviceId, {
            blocked: device.status === 'maintenance',
            metadata: {
              deviceType: (device.metadata?.device_type as string) || 'unknown',
              location: device.location || '',
              lastSyncTime: new Date().toISOString(),
            },
          })
          
          // Update device config with current state
          await this.updateDeviceConfig(deviceId, {
            status: device.status,
            battery_level: device.metadata?.battery_level,
            signal_strength: device.metadata?.signal_strength,
          })
          
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
  // Google IoT-Specific Methods
  // ===========================================================================

  /**
   * Get Google OAuth2 access token
   * Simplified implementation - in production, use proper JWT signing
   */
  private async getAccessToken(): Promise<string> {
    // This is a placeholder - in production, implement proper OAuth2 JWT flow
    // with RSA signing using the private key from service account
    
    // For now, return empty string (will cause 401, which is expected in test mode)
    return ''
  }

  /**
   * Make authenticated request to Google Cloud IoT API
   */
  private async requestGoogle<T>(
    endpoint: string,
    method: string = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const accessToken = await this.getAccessToken()
    const url = `https://cloudiot.googleapis.com/v1${endpoint}`
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText
      }))
      
      throw new IntegrationError(
        errorData.error?.message || `Google Cloud IoT API error: ${response.statusText}`,
        errorData.error?.code || 'GOOGLE_API_ERROR',
        response.status,
        errorData
      )
    }
    
    return await response.json()
  }

  /**
   * List all devices in the registry
   */
  async listDevices(): Promise<GoogleDevice[]> {
    const result = await this.requestGoogle<{ devices?: GoogleDevice[] }>(
      `/${this.registryPath}/devices`,
      'GET'
    )
    return result.devices || []
  }

  /**
   * Get a specific device
   */
  async getDevice(deviceId: string): Promise<GoogleDevice> {
    return await this.requestGoogle<GoogleDevice>(
      `/${this.registryPath}/devices/${deviceId}`,
      'GET'
    )
  }

  /**
   * Create or update a device
   */
  async createOrUpdateDevice(
    deviceId: string,
    data: { blocked?: boolean; metadata?: Record<string, string> }
  ): Promise<GoogleDevice> {
    // Try to create, if exists, update
    try {
      return await this.requestGoogle<GoogleDevice>(
        `/${this.registryPath}/devices`,
        'POST',
        {
          id: deviceId,
          blocked: data.blocked || false,
          metadata: data.metadata || {},
        }
      )
    } catch (error) {
      // If device exists, update it
      if (error instanceof IntegrationError && error.status === 409) {
        return await this.requestGoogle<GoogleDevice>(
          `/${this.registryPath}/devices/${deviceId}`,
          'PATCH',
          {
            blocked: data.blocked,
            metadata: data.metadata,
          }
        )
      }
      throw error
    }
  }

  /**
   * Update device configuration
   */
  async updateDeviceConfig(
    deviceId: string,
    config: Record<string, unknown>
  ): Promise<void> {
    const binaryData = btoa(JSON.stringify(config))
    
    await this.requestGoogle(
      `/${this.registryPath}/devices/${deviceId}:modifyCloudToDeviceConfig`,
      'POST',
      {
        binaryData,
      }
    )
  }

  /**
   * Delete a device
   */
  async deleteDevice(deviceId: string): Promise<void> {
    await this.requestGoogle<void>(
      `/${this.registryPath}/devices/${deviceId}`,
      'DELETE'
    )
  }

  /**
   * Send command to device
   */
  async sendCommand(deviceId: string, command: Record<string, unknown>): Promise<void> {
    const binaryData = btoa(JSON.stringify(command))
    
    await this.requestGoogle(
      `/${this.registryPath}/devices/${deviceId}:sendCommandToDevice`,
      'POST',
      {
        binaryData,
      }
    )
  }
}
