// ===========================================================================
// AWS IoT Core Integration Client
// ===========================================================================
// Extends BaseIntegrationClient to follow unified integration pattern
// Supports device shadows, fleet management, and device lifecycle
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
// AWS IoT-Specific Types
// ===========================================================================

export interface AwsIotSettings {
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
}

interface AwsThing {
  thingName: string
  thingTypeName?: string
  thingArn: string
  attributes?: Record<string, string>
  version: number
  connectivity?: {
    connected: boolean
    timestamp: number
  }
}

interface AwsThingShadow {
  state?: {
    reported?: Record<string, unknown>
    desired?: Record<string, unknown>
  }
  metadata?: Record<string, unknown>
  version?: number
  timestamp?: number
}

// ===========================================================================
// AWS IoT Client Implementation
// ===========================================================================

export class AwsIotClient extends BaseIntegrationClient {
  private region: string
  private accessKeyId: string
  private secretAccessKey: string
  private endpoint: string

  constructor(config: IntegrationConfig) {
    super(config)
    const settings = this.getSettings<AwsIotSettings>()
    this.region = settings.region
    this.accessKeyId = settings.accessKeyId
    this.secretAccessKey = settings.secretAccessKey
    this.endpoint =
      settings.endpoint || `https://iot.${settings.region}.amazonaws.com`
  }

  // ===========================================================================
  // Required Methods (BaseIntegrationClient)
  // ===========================================================================

  protected validateConfig(): void {
    this.validateRequiredSettings(['region', 'accessKeyId', 'secretAccessKey'])
  }

  public async test(): Promise<TestResult> {
    return this.withActivityLog('test', async () => {
      try {
        // Authenticate and list up to 1 thing to verify credentials + permissions
        const url = `${this.endpoint}/things?maxResults=1`
        const things = await this.requestAws<{ things?: AwsThing[] }>(url, 'GET')

        const thingCount = things.things?.length ?? 0
        return this.createSuccessResult(
          `Connected to AWS IoT Core in ${this.region} (${thingCount} thing${thingCount !== 1 ? 's' : ''} found)`,
          { region: this.region, endpoint: this.endpoint, thingsFound: thingCount }
        )
      } catch (error) {
        if (error instanceof IntegrationError) {
          return this.createErrorResult(error.message, {
            region: this.region,
            endpoint: this.endpoint,
            code: error.code,
            statusCode: error.statusCode,
          })
        }

        const msg = (error as Error).message || 'Unknown error'
        // Network-level failures (DNS, timeout, connection refused)
        if (msg.includes('fetch') || msg.includes('network') || msg.includes('ENOTFOUND')) {
          return this.createErrorResult(
            `Cannot reach AWS IoT endpoint. Check region (${this.region}) and endpoint URL.`,
            { region: this.region, endpoint: this.endpoint }
          )
        }

        return this.createErrorResult(
          `AWS IoT connection failed: ${msg}`,
          { region: this.region, endpoint: this.endpoint }
        )
      }
    })
  }

  public async import(): Promise<SyncResult> {
    return this.withActivityLog('import', async () => {
      const result = this.createSyncResult()
      let telemetryRecorded = 0

      try {
        // List all things (devices) from AWS IoT
        const things = await this.listThings()
        result.devices_processed = things.length

        // Convert AWS Things to NetNeural devices
        for (const thing of things) {
          try {
            // Get thing shadow for detailed state
            const shadow = await this.getThingShadow(thing.thingName).catch(
              () => null
            )

            // First, upsert the device to get/create NetNeural device ID
            const { data: existingDevice } = await this.config.supabase
              .from('devices')
              .select('id')
              .eq('organization_id', this.config.organizationId)
              .or(
                `hardware_id.eq.${thing.thingName},external_id.eq.${thing.thingName}`
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
                    name: thing.thingName,
                    hardware_id: thing.thingName,
                    status: thing.connectivity?.connected
                      ? 'online'
                      : 'offline',
                    last_seen: thing.connectivity?.timestamp
                      ? new Date(thing.connectivity.timestamp).toISOString()
                      : undefined,
                    metadata: {
                      device_type: thing.thingTypeName || 'unknown',
                      aws_attributes: thing.attributes,
                    },
                    external_id: thing.thingName,
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
                  name: thing.thingName,
                  status: thing.connectivity?.connected ? 'online' : 'offline',
                  last_seen: thing.connectivity?.timestamp
                    ? new Date(thing.connectivity.timestamp).toISOString()
                    : undefined,
                  metadata: {
                    device_type: thing.thingTypeName || 'unknown',
                    aws_attributes: thing.attributes,
                  },
                  updated_at: new Date().toISOString(),
                })
                .eq('id', localDeviceId)
            }

            // NEW: Extract and record telemetry from Thing Shadow
            if (shadow?.state?.reported) {
              try {
                const telemetryId = await this.recordTelemetry(
                  localDeviceId,
                  shadow.state.reported,
                  shadow.metadata?.timestamp
                    ? new Date(shadow.metadata.timestamp * 1000).toISOString()
                    : undefined
                )
                if (telemetryId) telemetryRecorded++
              } catch (telemetryError) {
                // Don't fail device import if telemetry recording fails
                console.warn(
                  `Failed to record Shadow telemetry for ${thing.thingName}:`,
                  telemetryError
                )
              }
            }

            const device: Device = {
              id: localDeviceId,
              name: thing.thingName,
              hardware_id: thing.thingName,
              status: thing.connectivity?.connected ? 'online' : 'offline',
              last_seen: thing.connectivity?.timestamp
                ? new Date(thing.connectivity.timestamp).toISOString()
                : undefined,
              metadata: {
                device_type: thing.thingTypeName || 'unknown',
                aws_attributes: thing.attributes,
              },
              external_id: thing.thingName,
              external_metadata: {
                thingArn: thing.thingArn,
                version: thing.version,
                shadow: shadow,
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
              `${thing.thingName}: ${(error as Error).message}`
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
          const thingName =
            device.external_id || device.hardware_id || device.name

          // Create or update thing
          await this.createOrUpdateThing(thingName, {
            thingTypeName:
              (device.metadata?.device_type as string) || 'unknown',
            attributes: {
              serial_number: device.hardware_id || '',
              model: (device.metadata?.model as string) || '',
              firmware_version:
                (device.metadata?.firmware_version as string) || '',
            },
          })

          // Update thing shadow with current state
          await this.updateThingShadow(thingName, {
            state: {
              reported: {
                status: device.status,
                battery_level: device.metadata?.battery_level,
                signal_strength: device.metadata?.signal_strength,
                last_seen: device.last_seen,
                location: device.location,
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
  // AWS IoT-Specific Methods
  // ===========================================================================

  /**
   * Compute HMAC-SHA256 using Web Crypto API (Deno-compatible)
   */
  private async hmacSha256(
    key: ArrayBuffer | Uint8Array,
    message: string
  ): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  }

  /**
   * Compute SHA-256 hash and return hex string
   */
  private async sha256Hex(message: string): Promise<string> {
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(message)
    )
    return this.toHex(hash)
  }

  /**
   * Convert ArrayBuffer to lowercase hex string
   */
  private toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Derive the AWS SigV4 signing key
   * signingKey = HMAC(HMAC(HMAC(HMAC("AWS4"+secret, date), region), service), "aws4_request")
   */
  private async deriveSigningKey(
    dateStamp: string,
    service: string
  ): Promise<ArrayBuffer> {
    const kDate = await this.hmacSha256(
      new TextEncoder().encode('AWS4' + this.secretAccessKey),
      dateStamp
    )
    const kRegion = await this.hmacSha256(kDate, this.region)
    const kService = await this.hmacSha256(kRegion, service)
    return this.hmacSha256(kService, 'aws4_request')
  }

  /**
   * Sign AWS request using full AWS Signature Version 4
   * Implements the complete signing algorithm using Web Crypto API.
   * Reference: https://docs.aws.amazon.com/IAM/latest/UserGuide/create-signed-request.html
   */
  private async signAwsRequest(
    method: string,
    url: string,
    body?: string | null
  ): Promise<Record<string, string>> {
    const parsedUrl = new URL(url)
    const date = new Date()
    const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '')
    const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '')

    // Determine the correct AWS service from the URL
    // IoT data-plane uses "iotdata", control-plane uses "iot"
    // Custom endpoints (*.iot.*.amazonaws.com) use "iotdata"
    const host = parsedUrl.host
    let service = 'iot'
    if (host.includes('.iot.') && host.includes('.amazonaws.com')) {
      // Custom data-plane endpoint: <id>.iot.<region>.amazonaws.com
      service = 'iotdata'
    } else if (host === `iot.${this.region}.amazonaws.com`) {
      // Control-plane endpoint
      service = 'iot'
    }

    // Payload hash (empty string for GET/DELETE, body for POST/PUT)
    const payloadHash = await this.sha256Hex(body || '')

    // Canonical headers (must be sorted by lowercase header name)
    const canonicalHeaders =
      `content-type:application/json\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`

    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date'

    // Canonical URI (path-encoded)
    const canonicalUri = parsedUrl.pathname || '/'

    // Canonical query string (sorted by parameter name)
    const params = Array.from(parsedUrl.searchParams.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    )
    const canonicalQueryString = params
      .map(
        ([k, v]) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
      )
      .join('&')

    // Canonical request
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')

    // Credential scope
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`

    // String to sign
    const canonicalRequestHash = await this.sha256Hex(canonicalRequest)
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      canonicalRequestHash,
    ].join('\n')

    // Calculate signature
    const signingKey = await this.deriveSigningKey(dateStamp, service)
    const signatureBuffer = await this.hmacSha256(signingKey, stringToSign)
    const signature = this.toHex(signatureBuffer)

    // Build Authorization header
    const authorization =
      `AWS4-HMAC-SHA256 ` +
      `Credential=${this.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, ` +
      `Signature=${signature}`

    return {
      'Content-Type': 'application/json',
      Host: host,
      'X-Amz-Date': amzDate,
      'X-Amz-Content-Sha256': payloadHash,
      Authorization: authorization,
    }
  }

  /**
   * Categorize AWS error responses into specific error codes
   */
  private categorizeAwsError(
    status: number,
    errorData: Record<string, unknown>
  ): { message: string; code: string } {
    const awsCode = (errorData.__type as string) || (errorData.code as string) || ''
    const awsMessage = (errorData.message as string) || (errorData.Message as string) || ''

    switch (status) {
      case 401:
        return {
          message: `AWS authentication failed: Invalid access key or secret key. ${awsMessage}`,
          code: 'AWS_INVALID_CREDENTIALS',
        }
      case 403:
        if (awsCode === 'ExpiredTokenException' || awsMessage.includes('expired')) {
          return {
            message: `AWS credentials have expired. Rotate your access keys in the AWS IAM console. ${awsMessage}`,
            code: 'AWS_EXPIRED_CREDENTIALS',
          }
        }
        if (awsCode === 'AccessDeniedException' || awsCode === 'UnauthorizedAccess') {
          return {
            message: `AWS IAM permissions insufficient. Ensure the IAM user/role has iot:* permissions. ${awsMessage}`,
            code: 'AWS_ACCESS_DENIED',
          }
        }
        return {
          message: `AWS authorization failed: ${awsMessage || 'Check IAM permissions and credentials'}`,
          code: 'AWS_FORBIDDEN',
        }
      case 404:
        return {
          message: `AWS IoT resource not found: ${awsMessage || 'Check region and endpoint configuration'}`,
          code: 'AWS_NOT_FOUND',
        }
      default:
        return {
          message: awsMessage || `AWS IoT API error (HTTP ${status})`,
          code: awsCode || 'AWS_API_ERROR',
        }
    }
  }

  /**
   * Make authenticated request to AWS IoT API
   */
  private async requestAws<T>(
    url: string,
    method: string = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> {
    const bodyString = body ? JSON.stringify(body) : null
    const headers = await this.signAwsRequest(method, url, bodyString)

    const response = await fetch(url, {
      method,
      headers,
      body: bodyString,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        message: response.statusText,
      }))

      const categorized = this.categorizeAwsError(response.status, errorData)

      throw new IntegrationError(
        categorized.message,
        categorized.code,
        response.status,
        errorData
      )
    }

    // Handle empty responses
    if (
      response.status === 204 ||
      response.headers.get('content-length') === '0'
    ) {
      return {} as T
    }

    return await response.json()
  }

  /**
   * List all things (devices) in AWS IoT
   */
  async listThings(): Promise<AwsThing[]> {
    const url = `${this.endpoint}/things`
    const result = await this.requestAws<{ things?: AwsThing[] }>(url, 'GET')
    return result.things || []
  }

  /**
   * Get thing shadow (device state)
   */
  async getThingShadow(thingName: string): Promise<AwsThingShadow> {
    const url = `${this.endpoint}/things/${thingName}/shadow`
    return await this.requestAws<AwsThingShadow>(url, 'GET')
  }

  /**
   * Create or update a thing in AWS IoT
   */
  async createOrUpdateThing(
    thingName: string,
    data: { thingTypeName?: string; attributes?: Record<string, string> }
  ): Promise<void> {
    const url = `${this.endpoint}/things/${thingName}`
    await this.requestAws(url, 'PUT', {
      thingName,
      thingTypeName: data.thingTypeName,
      attributePayload: {
        attributes: data.attributes || {},
      },
    })
  }

  /**
   * Update thing shadow with device state
   */
  async updateThingShadow(
    thingName: string,
    shadow: {
      state: {
        reported?: Record<string, unknown>
        desired?: Record<string, unknown>
      }
    }
  ): Promise<void> {
    const url = `${this.endpoint}/things/${thingName}/shadow`
    await this.requestAws(url, 'POST', shadow)
  }

  /**
   * Delete a thing from AWS IoT
   */
  async deleteThing(thingName: string): Promise<void> {
    const url = `${this.endpoint}/things/${thingName}`
    await this.requestAws(url, 'DELETE')
  }
}
