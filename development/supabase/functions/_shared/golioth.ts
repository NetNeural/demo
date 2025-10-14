// Golioth API client for Edge Functions
export interface GoliothDevice {
  id: string
  name: string
  projectId: string
  status: 'online' | 'offline' | 'maintenance'
  lastSeen: string
  metadata: Record<string, any>
}

export interface GoliothTelemetry {
  deviceId: string
  timestamp: string
  data: Record<string, any>
}

export class GoliothClient {
  private apiKey: string
  private baseUrl = 'https://api.golioth.io/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Fetch all devices from Golioth
   */
  async getDevices(projectId: string): Promise<GoliothDevice[]> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/devices`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
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
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
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
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
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
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
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
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
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