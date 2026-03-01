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
    if (
      !this.connectionString.includes('HostName=') ||
      !this.connectionString.includes('SharedAccessKeyName=') ||
      !this.connectionString.includes('SharedAccessKey=')
    ) {
      throw new Error('Invalid Azure IoT Hub connection string format')
    }
  }

  public async test(): Promise<TestResult> {
    return this.withActivityLog('test', async () => {
      try {
        // Authenticate with SAS token and query devices (top 1) to verify credentials
        const devices = await this.requestAzure<AzureDevice[]>(
          '/devices?top=1&api-version=2021-04-12',
          'GET'
        )

        const deviceCount = Array.isArray(devices) ? devices.length : 0
        return this.createSuccessResult(
          `Connected to Azure IoT Hub '${this.hubName}' (${deviceCount} device${deviceCount !== 1 ? 's' : ''} found)`,
          { hubName: this.hubName, hostname: this.parsedConfig.hostName, devicesFound: deviceCount }
        )
      } catch (error) {
        if (error instanceof IntegrationError) {
          return this.createErrorResult(error.message, {
            hubName: this.hubName,
            hostname: this.parsedConfig.hostName,
            code: error.code,
            statusCode: error.statusCode,
          })
        }

        const msg = (error as Error).message || 'Unknown error'
        // Network-level failures (DNS, timeout, connection refused)
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
          return this.createErrorResult(
            `Cannot reach Azure IoT Hub '${this.hubName}'. Check hub name and connection string hostname.`,
            { hubName: this.hubName, hostname: this.parsedConfig.hostName }
          )
        }

        return this.createErrorResult(
          `Azure IoT Hub connection failed: ${msg}`,
          { hubName: this.hubName, hostname: this.parsedConfig.hostName }
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
            const twin = await this.getDeviceTwin(azureDevice.deviceId).catch(
              () => null
            )

            // First, upsert the device to get/create NetNeural device ID
            const { data: existingDevice } = await this.config.supabase
              .from('devices')
              .select('id')
              .eq('organization_id', this.config.organizationId)
              .or(
                `hardware_id.eq.${azureDevice.deviceId},external_id.eq.${azureDevice.deviceId}`
              )
              .single()

            let localDeviceId = existingDevice?.id

            // If device doesn't exist, create it
            if (!localDeviceId) {
              const { data: newDevice, error: createError } =
                await this.config.supabase
                  .from('devices')
                  .insert({
                    id: crypto.randomUUID(), // Explicitly generate UUID to avoid Supabase client caching bug
                    organization_id: this.config.organizationId,
                    name: azureDevice.deviceId,
                    hardware_id: azureDevice.deviceId,
                    status:
                      azureDevice.connectionState === 'Connected'
                        ? 'online'
                        : 'offline',
                    last_seen: azureDevice.lastActivityTime,
                    metadata: {
                      device_type: twin?.tags?.deviceType || 'unknown',
                      azure_status: azureDevice.status,
                      azure_status_reason: azureDevice.statusReason,
                      azure_pending_messages:
                        azureDevice.cloudToDeviceMessageCount,
                    },
                    external_id: azureDevice.deviceId,
                  })
                  .select('id')
                  .single()

              if (createError || !newDevice) {
                throw new Error(
                  `Failed to create device: ${createError?.message}`
                )
              }
              localDeviceId = newDevice.id
            } else {
              // Update existing device
              await this.config.supabase
                .from('devices')
                .update({
                  name: azureDevice.deviceId,
                  status:
                    azureDevice.connectionState === 'Connected'
                      ? 'online'
                      : 'offline',
                  last_seen: azureDevice.lastActivityTime,
                  metadata: {
                    device_type: twin?.tags?.deviceType || 'unknown',
                    azure_status: azureDevice.status,
                    azure_status_reason: azureDevice.statusReason,
                    azure_pending_messages:
                      azureDevice.cloudToDeviceMessageCount,
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
                console.warn(
                  `Failed to record Twin telemetry for ${azureDevice.deviceId}:`,
                  telemetryError
                )
              }
            }

            const device: Device = {
              id: localDeviceId,
              name: azureDevice.deviceId,
              hardware_id: azureDevice.deviceId,
              status:
                azureDevice.connectionState === 'Connected'
                  ? 'online'
                  : 'offline',
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
            ;(result.details as Record<string, unknown>).devices =
              (result.details as Record<string, Device[]>).devices || []
            ;(result.details as Record<string, Device[]>).devices.push(device)
          } catch (error) {
            result.devices_failed++
            result.errors.push(
              `${azureDevice.deviceId}: ${(error as Error).message}`
            )
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
          const deviceId =
            device.external_id || device.hardware_id || device.name

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
  private parseConnectionString(
    connectionString: string
  ): ParsedConnectionString {
    const parts = connectionString.split(';')
    const config: Record<string, string> = {}

    parts.forEach((part) => {
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
   * Decode a Base64 string to a Uint8Array.
   * Azure IoT Hub connection strings store the SharedAccessKey in Base64.
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryStr = atob(base64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    return bytes
  }

  /**
   * Generate SAS Token for Azure IoT Hub authentication.
   * The SharedAccessKey from the connection string is Base64-encoded;
   * it must be decoded before use as the HMAC-SHA256 signing key.
   * Reference: https://learn.microsoft.com/en-us/azure/iot-hub/iot-hub-dev-guide-sas
   */
  private async generateSasToken(
    expiryInMinutes: number = 60
  ): Promise<string> {
    const resourceUri = this.parsedConfig.hostName
    const expiry = Math.floor(Date.now() / 1000) + expiryInMinutes * 60
    const stringToSign = `${encodeURIComponent(resourceUri)}\n${expiry}`

    // Decode the Base64-encoded shared access key to raw bytes
    const keyData = this.base64ToUint8Array(this.parsedConfig.sharedAccessKey)
    const data = new TextEncoder().encode(stringToSign)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, data)
    const base64Signature = btoa(
      String.fromCharCode(...new Uint8Array(signature))
    )

    return `SharedAccessSignature sr=${encodeURIComponent(resourceUri)}&sig=${encodeURIComponent(base64Signature)}&se=${expiry}&skn=${this.parsedConfig.sharedAccessKeyName}`
  }

  /**
   * Categorize Azure IoT Hub error responses into specific error codes
   */
  private categorizeAzureError(
    status: number,
    errorBody: string
  ): { message: string; code: string } {
    // Try to parse JSON error response from Azure
    let azureMessage = errorBody
    try {
      const parsed = JSON.parse(errorBody)
      azureMessage = parsed.Message || parsed.message || parsed.ExceptionMessage || errorBody
    } catch {
      // Use raw text
    }

    switch (status) {
      case 401:
        return {
          message: `Azure IoT Hub authentication failed: Invalid connection string or SAS key. ${azureMessage}`,
          code: 'AZURE_INVALID_CREDENTIALS',
        }
      case 403:
        return {
          message: `Azure IoT Hub access denied: Insufficient permissions in shared access policy. ${azureMessage}`,
          code: 'AZURE_ACCESS_DENIED',
        }
      case 404:
        if (azureMessage.includes('IotHubNotFound') || azureMessage.includes('not found')) {
          return {
            message: `Azure IoT Hub not found. Check the hub name in your connection string.`,
            code: 'AZURE_HUB_NOT_FOUND',
          }
        }
        return {
          message: `Azure IoT Hub resource not found: ${azureMessage}`,
          code: 'AZURE_NOT_FOUND',
        }
      case 429:
        return {
          message: `Azure IoT Hub throttling: Too many requests. Retry after a brief delay.`,
          code: 'AZURE_THROTTLED',
        }
      default:
        return {
          message: azureMessage || `Azure IoT Hub API error (HTTP ${status})`,
          code: 'AZURE_API_ERROR',
        }
    }
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
        Authorization: sasToken,
        'Content-Type': 'application/json',
        'User-Agent': 'NetNeural-Azure-IoT/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorText = await response.text()
      const categorized = this.categorizeAzureError(response.status, errorText)

      throw new IntegrationError(
        categorized.message,
        categorized.code,
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
    twin: {
      tags?: Record<string, unknown>
      properties?: { desired?: Record<string, unknown> }
    }
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
