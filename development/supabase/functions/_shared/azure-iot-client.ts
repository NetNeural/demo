// ===========================================================================
// Azure IoT Hub Integration Client
// ===========================================================================
// Extends BaseIntegrationClient to follow unified integration pattern
// Supports device twins, direct methods, and device lifecycle
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
// Azure IoT-Specific Types
// ===========================================================================

export interface AzureIotSettings {
  connectionString: string
  hubName: string
}

interface AzureDevice {
  deviceId: string
  status: 'enabled' | 'disabled'
  statusReason?: string
  connectionState: 'Connected' | 'Disconnected'
  lastActivityTime: string
  cloudToDeviceMessageCount: number
  authentication?: {
    symmetricKey?: { primaryKey: string; secondaryKey: string }
    x509Thumbprint?: { primaryThumbprint: string; secondaryThumbprint: string }
  }
}

interface DeviceTwin {
  deviceId: string
  etag: string
  version: number
  properties: {
    desired: Record<string, unknown>
    reported: Record<string, unknown>
  }
  tags: Record<string, unknown>
}

interface ParsedConnectionString {
  hostName: string
  sharedAccessKeyName: string
  sharedAccessKey: string
}

// ===========================================================================
// Azure IoT Client Implementation
// ===========================================================================

export class AzureIotClient extends BaseIntegrationClient {
  private connectionString: string
  private hubName: string
  private parsedConfig: ParsedConnectionString

  constructor(config: IntegrationConfig) {
    super(config)
    const settings = this.getSettings<AzureIotSettings>()
    this.connectionString = settings.connectionString
    this.hubName = settings.hubName
    this.parsedConfig = this.parseConnectionString(settings.connectionString)
  }

  // ===========================================================================
  // Required Methods (BaseIntegrationClient)
  // ===========================================================================

  protected validateConfig(): void {
    this.validateRequiredSettings(['connectionString', 'hubName'])
    
    // Validate connection string format
    if (!this.connectionString.includes('HostName=') || 
        !this.connectionString.includes('SharedAccessKeyName=') || 
        !this.connectionString.includes('SharedAccessKey=')) {
      throw new Error('Invalid Azure IoT Hub connection string format')
    }
  }

  public async test(): Promise<TestResult> {
    return this.withActivityLog('test', async () => {
      try {
        const deviceListUrl = `/devices?api-version=2021-04-12`
        const response = await fetch(`https://${this.parsedConfig.hostName}${deviceListUrl}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
        
        // 401 = hub exists but needs SAS token (which is good)
        if (response.status === 401) {
          return this.createSuccessResult(
            `Azure IoT Hub '${this.hubName}' endpoint is reachable`,
            { hubName: this.hubName, hostname: this.parsedConfig.hostName }
          )
        }
        
        return this.createSuccessResult(
          `Azure IoT Hub '${this.hubName}' configured`,
          { hubName: this.hubName, hostname: this.parsedConfig.hostName }
        )
      } catch (error) {
        return this.createErrorResult(
          `Azure IoT Hub API error: ${(error as Error).message}`,
          { hubName: this.hubName }
        )
      }
    })
  }

  public async import(): Promise<SyncResult> {
    return this.withActivityLog('import', async () => {
      const result = this.createSyncResult()
      let telemetryRecorded = 0
      
      try {
        // List all devices from Azure IoT Hub
        const azureDevices = await this.listDevices()
        result.devices_processed = azureDevices.length
        
        // Convert Azure devices to NetNeural format
        for (const azureDevice of azureDevices) {
          try {
            // Get device twin for detailed state
            const twin = await this.getDeviceTwin(azureDevice.deviceId).catch(() => null)

            // First, upsert the device to get/create NetNeural device ID
            const { data: existingDevice } = await this.config.supabase
              .from('devices')
              .select('id')
              .eq('organization_id', this.config.organizationId)
              .or(`hardware_id.eq.${azureDevice.deviceId},external_id.eq.${azureDevice.deviceId}`)
              .single()

            let localDeviceId = existingDevice?.id

            // If device doesn't exist, create it
            if (!localDeviceId) {
              const { data: newDevice, error: createError } = await this.config.supabase
                .from('devices')
                .insert({
                  id: crypto.randomUUID(), // Explicitly generate UUID to avoid Supabase client caching bug
                  organization_id: this.config.organizationId,
                  name: azureDevice.deviceId,
                  hardware_id: azureDevice.deviceId,
                  status: azureDevice.connectionState === 'Connected' ? 'online' : 'offline',
                  last_seen: azureDevice.lastActivityTime,
                  metadata: {
                    device_type: twin?.tags?.deviceType || 'unknown',
                    azure_status: azureDevice.status,
                    azure_status_reason: azureDevice.statusReason,
                    azure_pending_messages: azureDevice.cloudToDeviceMessageCount,
                  },
                  external_id: azureDevice.deviceId,
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
                  name: azureDevice.deviceId,
                  status: azureDevice.connectionState === 'Connected' ? 'online' : 'offline',
                  last_seen: azureDevice.lastActivityTime,
                  metadata: {
                    device_type: twin?.tags?.deviceType || 'unknown',
                    azure_status: azureDevice.status,
                    azure_status_reason: azureDevice.statusReason,
                    azure_pending_messages: azureDevice.cloudToDeviceMessageCount,
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', localDeviceId)
            }

            // NEW: Extract and record telemetry from Device Twin reported properties
            if (twin?.properties?.reported) {
              try {
                const telemetryId = await this.recordTelemetry(
                  localDeviceId,
                  twin.properties.reported,
                  twin.lastActivityTime
                )
                if (telemetryId) telemetryRecorded++
              } catch (telemetryError) {
                // Don't fail device import if telemetry recording fails
                console.warn(`Failed to record Twin telemetry for ${azureDevice.deviceId}:`, telemetryError)
              }
            }
            
            const device: Device = {
              id: localDeviceId,
              name: azureDevice.deviceId,
              hardware_id: azureDevice.deviceId,
              status: azureDevice.connectionState === 'Connected' ? 'online' : 'offline',
              last_seen: azureDevice.lastActivityTime,
              metadata: {
                device_type: twin?.tags?.deviceType || 'unknown',
                azure_status: azureDevice.status,
                azure_status_reason: azureDevice.statusReason,
                azure_pending_messages: azureDevice.cloudToDeviceMessageCount,
              },
              external_id: azureDevice.deviceId,
              external_metadata: {
                twin: twin,
                authentication: azureDevice.authentication,
              },
            }
            
            result.devices_succeeded++
            result.details = result.details || { devices: [] }
            ;(result.details as Record<string, unknown>).devices = (result.details as Record<string, Device[]>).devices || []
            ;(result.details as Record<string, Device[]>).devices.push(device)
          } catch (error) {
            result.devices_failed++
            result.errors.push(`${azureDevice.deviceId}: ${(error as Error).message}`)
          }
        }

        // Add telemetry stats to result
        if (telemetryRecorded > 0) {
          const details = result.details as Record<string, unknown>
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
          const deviceId = device.external_id || device.hardware_id || device.name
          
          // Create or update device
          await this.createOrUpdateDevice(deviceId, {
            status: device.status === 'offline' ? 'disabled' : 'enabled',
            statusReason: `Synced from NetNeural at ${new Date().toISOString()}`,
          })
          
          // Update device twin with current state
          await this.updateDeviceTwin(deviceId, {
            tags: {
              deviceType: device.metadata?.device_type || 'unknown',
              location: device.location,
            },
            properties: {
              desired: {
                status: device.status,
                battery_level: device.metadata?.battery_level,
                signal_strength: device.metadata?.signal_strength,
              },
            },
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
  // Azure IoT-Specific Methods
  // ===========================================================================

  /**
   * Parse Azure IoT Hub connection string
   */
  private parseConnectionString(connectionString: string): ParsedConnectionString {
    const parts = connectionString.split(';')
    const config: Record<string, string> = {}
    
    parts.forEach(part => {
      const [key, ...valueParts] = part.split('=')
      config[key] = valueParts.join('=')
    })
    
    return {
      hostName: config.HostName,
      sharedAccessKeyName: config.SharedAccessKeyName,
      sharedAccessKey: config.SharedAccessKey,
    }
  }

  /**
   * Generate SAS Token for Azure IoT Hub authentication
   */
  private async generateSasToken(expiryInMinutes: number = 60): Promise<string> {
    const resourceUri = this.parsedConfig.hostName
    const expiry = Math.floor(Date.now() / 1000) + (expiryInMinutes * 60)
    const stringToSign = `${encodeURIComponent(resourceUri)}\n${expiry}`
    
    const encoder = new TextEncoder()
    const keyData = encoder.encode(this.parsedConfig.sharedAccessKey)
    const data = encoder.encode(stringToSign)
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    
    return `SharedAccessSignature sr=${encodeURIComponent(resourceUri)}&sig=${encodeURIComponent(base64Signature)}&se=${expiry}&skn=${this.parsedConfig.sharedAccessKeyName}`
  }

  /**
   * Make authenticated request to Azure IoT Hub API
   */
  private async requestAzure<T>(
    endpoint: string,
    method: string = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const sasToken = await this.generateSasToken()
    const url = `https://${this.parsedConfig.hostName}${endpoint}`
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': sasToken,
        'Content-Type': 'application/json',
        'User-Agent': 'NetNeural-Azure-IoT/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new IntegrationError(
        `Azure IoT Hub API error: ${errorText}`,
        'AZURE_API_ERROR',
        response.status,
        { errorText }
      )
    }
    
    // Handle empty responses
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return {} as T
    }
    
    return await response.json()
  }

  /**
   * List all devices in Azure IoT Hub
   */
  async listDevices(): Promise<AzureDevice[]> {
    return await this.requestAzure<AzureDevice[]>(
      '/devices?api-version=2021-04-12',
      'GET'
    )
  }

  /**
   * Get device twin (device state and metadata)
   */
  async getDeviceTwin(deviceId: string): Promise<DeviceTwin> {
    return await this.requestAzure<DeviceTwin>(
      `/twins/${deviceId}?api-version=2021-04-12`,
      'GET'
    )
  }

  /**
   * Create or update a device in Azure IoT Hub
   */
  async createOrUpdateDevice(
    deviceId: string,
    data: { status?: 'enabled' | 'disabled'; statusReason?: string }
  ): Promise<AzureDevice> {
    return await this.requestAzure<AzureDevice>(
      `/devices/${deviceId}?api-version=2021-04-12`,
      'PUT',
      {
        deviceId,
        status: data.status || 'enabled',
        statusReason: data.statusReason,
      }
    )
  }

  /**
   * Update device twin with tags and desired properties
   */
  async updateDeviceTwin(
    deviceId: string,
    twin: { tags?: Record<string, unknown>; properties?: { desired?: Record<string, unknown> } }
  ): Promise<DeviceTwin> {
    return await this.requestAzure<DeviceTwin>(
      `/twins/${deviceId}?api-version=2021-04-12`,
      'PATCH',
      twin
    )
  }

  /**
   * Delete a device from Azure IoT Hub
   */
  async deleteDevice(deviceId: string): Promise<void> {
    await this.requestAzure<void>(
      `/devices/${deviceId}?api-version=2021-04-12`,
      'DELETE'
    )
  }

  /**
   * Invoke direct method on device
   */
  async invokeDeviceMethod(
    deviceId: string,
    methodName: string,
    payload: Record<string, unknown>,
    timeoutInSeconds: number = 30
  ): Promise<unknown> {
    return await this.requestAzure(
      `/twins/${deviceId}/methods?api-version=2021-04-12`,
      'POST',
      {
        methodName,
        payload,
        responseTimeoutInSeconds: timeoutInSeconds,
        connectTimeoutInSeconds: timeoutInSeconds,
      }
    )
  }
}
