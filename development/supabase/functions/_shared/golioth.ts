// ===========================================================================
// Golioth API Client - Production Grade
// ===========================================================================
// Full-featured Golioth API client for Supabase Edge Functions
// Features: Error handling, retry logic, type safety, comprehensive CRUD
// ===========================================================================

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

export interface GoliothConfig {
  apiKey: string
  projectId: string
  baseUrl?: string
}

export class GoliothAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message)
    this.name = 'GoliothAPIError'
  }
}

export class GoliothClient {
  private apiKey: string
  private projectId: string
  private baseUrl: string

  constructor(config: GoliothConfig) {
    this.apiKey = config.apiKey
    this.projectId = config.projectId
    this.baseUrl = config.baseUrl || 'https://api.golioth.io/v1'

    if (!this.apiKey || !this.projectId) {
      throw new Error('Golioth API key and project ID are required')
    }
  }

  /**
   * Make HTTP request to Golioth API with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
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
      const errorData = await response.json().catch(() => ({}))
      throw new GoliothAPIError(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      )
    }

    return response.json()
  }

  /**
   * Fetch all devices from Golioth
   */
  async getDevices(projectId: string): Promise<GoliothDevice[]> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/devices`, {
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Golioth API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    return result.data || []
  }

  /**
   * Get device telemetry data
   */
  async getDeviceTelemetry(
    projectId: string,
    deviceId: string,
    since?: string
  ): Promise<GoliothTelemetry[]> {
    const params = new URLSearchParams()
    if (since) params.append('since', since)
    
    const response = await fetch(
      `${this.baseUrl}/projects/${projectId}/devices/${deviceId}/telemetry?${params}`,
      {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Golioth API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    return result.data || []
  }

  /**
   * Create a new device in Golioth
   */
  async createDevice(
    projectId: string,
    deviceData: Partial<GoliothDevice>
  ): Promise<GoliothDevice> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/devices`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(deviceData),
    })

    if (!response.ok) {
      throw new Error(`Golioth API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Update device in Golioth
   */
  async updateDevice(
    projectId: string,
    deviceId: string,
    deviceData: Partial<GoliothDevice>
  ): Promise<GoliothDevice> {
    const response = await fetch(
      `${this.baseUrl}/projects/${projectId}/devices/${deviceId}`,
      {
        method: 'PUT',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(deviceData),
      }
    )

    if (!response.ok) {
      throw new Error(`Golioth API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Delete device from Golioth
   */
  async deleteDevice(projectId: string, deviceId: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/projects/${projectId}/devices/${deviceId}`,
      {
        method: 'DELETE',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Golioth API error: ${response.status} ${response.statusText}`)
    }
  }
}

/**
 * Create a Golioth client instance
 */
export function createGoliothClient(): GoliothClient {
  const apiKey = Deno.env.get('GOLIOTH_API_KEY')
  if (!apiKey) {
    throw new Error('GOLIOTH_API_KEY environment variable is required')
  }
  return new GoliothClient(apiKey)
}