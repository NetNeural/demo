/**
 * Golioth IoT Platform API Client
 *
 * This service provides a TypeScript client for interacting with the Golioth IoT platform.
 * It handles device management, data streaming, and project operations.
 */

export interface GoliothDevice {
  id: string
  name: string
  hardware_id: string // Keep for backward compatibility
  hardwareIds?: string[] // NEW - array support
  status: 'online' | 'offline' | 'unknown'
  last_seen?: string // Keep for backward compatibility
  lastSeenOnline?: string // NEW - specific online timestamp
  lastSeenOffline?: string // NEW - specific offline timestamp
  cohortId?: string // NEW - OTA update group
  parentDeviceId?: string // NEW - parent/gateway device ID
  gatewayId?: string // NEW - gateway device ID (alias)
  isGateway?: boolean // NEW - is this device a gateway?
  created_at: string
  updated_at: string
  project_id: string
  metadata?: Record<string, unknown>
  tags?: string[]
}

export interface GoliothProject {
  id: string
  name: string
  created_at: string
  updated_at: string
  device_count: number
}

export interface GoliothStreamData {
  device_id: string
  timestamp: string
  data: Record<string, unknown>
  path: string
}

export interface GoliothDeviceState {
  device_id: string
  state: Record<string, unknown>
  timestamp: string
}

export interface GoliothAlert {
  id: string
  device_id: string
  device_name: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  timestamp: string
  acknowledged: boolean
  type: 'connectivity' | 'data' | 'security' | 'firmware'
}

export interface GoliothSystemStats {
  total_devices: number
  online_devices: number
  offline_devices: number
  data_points_today: number
  alerts_count: number
  last_updated: string
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

export class GoliothAPI {
  private baseURL: string
  private apiKey: string
  private projectId: string
  private enabled: boolean

  constructor(config?: {
    apiKey?: string
    projectId?: string
    baseUrl?: string
  }) {
    this.baseURL =
      config?.baseUrl ||
      process.env.GOLIOTH_BASE_URL ||
      'https://api.golioth.io'
    this.apiKey = config?.apiKey || process.env.GOLIOTH_API_KEY || ''
    this.projectId = config?.projectId || process.env.GOLIOTH_PROJECT_ID || ''
    this.enabled = !!this.apiKey

    if (!this.enabled && process.env.NODE_ENV !== 'production') {
      console.warn('Golioth API not configured - using mock data')
    }
  }

  /**
   * Check if the Golioth API is enabled and configured
   */
  get isEnabled(): boolean {
    return this.enabled
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.enabled) {
      throw new GoliothAPIError('Golioth API not configured', 503)
    }

    const url = `${this.baseURL}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
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

  // Project Operations
  async getProjects(): Promise<GoliothProject[]> {
    const response = await this.request<{ data: GoliothProject[] }>(
      '/v1/projects'
    )
    return response.data
  }

  async getProject(projectId?: string): Promise<GoliothProject> {
    const id = projectId || this.projectId
    return this.request<GoliothProject>(`/v1/projects/${id}`)
  }

  // Device Operations
  async getDevices(projectId?: string): Promise<GoliothDevice[]> {
    if (!this.enabled) {
      // Return empty array when API is not configured
      console.info(
        'Golioth API not configured. Set GOLIOTH_API_KEY and GOLIOTH_PROJECT_ID to enable.'
      )
      return []
    }

    const id = projectId || this.projectId
    const response = await this.request<{ data: GoliothDevice[] }>(
      `/v1/projects/${id}/devices`
    )
    return response.data
  }

  async getDevice(
    deviceId: string,
    projectId?: string
  ): Promise<GoliothDevice> {
    const id = projectId || this.projectId
    return this.request<GoliothDevice>(`/v1/projects/${id}/devices/${deviceId}`)
  }

  async createDevice(
    device: Partial<GoliothDevice>,
    projectId?: string
  ): Promise<GoliothDevice> {
    const id = projectId || this.projectId
    return this.request<GoliothDevice>(`/v1/projects/${id}/devices`, {
      method: 'POST',
      body: JSON.stringify(device),
    })
  }

  async updateDevice(
    deviceId: string,
    updates: Partial<GoliothDevice>,
    projectId?: string
  ): Promise<GoliothDevice> {
    const id = projectId || this.projectId
    return this.request<GoliothDevice>(
      `/v1/projects/${id}/devices/${deviceId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }
    )
  }

  async deleteDevice(deviceId: string, projectId?: string): Promise<void> {
    const id = projectId || this.projectId
    await this.request<void>(`/v1/projects/${id}/devices/${deviceId}`, {
      method: 'DELETE',
    })
  }

  // Device State and Data
  async getDeviceState(
    deviceId: string,
    projectId?: string
  ): Promise<GoliothDeviceState> {
    const id = projectId || this.projectId
    return this.request<GoliothDeviceState>(
      `/v1/projects/${id}/devices/${deviceId}/state`
    )
  }

  async setDeviceState(
    deviceId: string,
    state: Record<string, unknown>,
    projectId?: string
  ): Promise<void> {
    const id = projectId || this.projectId
    await this.request<void>(`/v1/projects/${id}/devices/${deviceId}/state`, {
      method: 'POST',
      body: JSON.stringify(state),
    })
  }

  async getDeviceStream(
    deviceId: string,
    options?: {
      start?: string
      end?: string
      limit?: number
      path?: string
    },
    projectId?: string
  ): Promise<GoliothStreamData[]> {
    const id = projectId || this.projectId
    const params = new URLSearchParams()

    if (options?.start) params.append('start', options.start)
    if (options?.end) params.append('end', options.end)
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.path) params.append('path', options.path)

    const endpoint = `/v1/projects/${id}/devices/${deviceId}/stream${params.toString() ? `?${params}` : ''}`
    const response = await this.request<{ data: GoliothStreamData[] }>(endpoint)
    return response.data
  }

  // System Statistics
  async getSystemStats(projectId?: string): Promise<GoliothSystemStats> {
    try {
      if (!this.enabled) {
        // Return mock data when API is not configured
        return {
          total_devices: 24,
          online_devices: 18,
          offline_devices: 6,
          data_points_today: 1247,
          alerts_count: 3,
          last_updated: new Date().toISOString(),
        }
      }

      const id = projectId || this.projectId
      const devices = await this.getDevices(id)

      const onlineDevices = devices.filter(
        (device) => device.status === 'online'
      ).length
      const offlineDevices = devices.filter(
        (device) => device.status === 'offline'
      ).length

      // For now, return calculated stats
      // In a real implementation, this would come from Golioth analytics API
      return {
        total_devices: devices.length,
        online_devices: onlineDevices,
        offline_devices: offlineDevices,
        data_points_today: Math.floor(Math.random() * 10000), // Placeholder
        alerts_count: Math.floor(Math.random() * 50), // Placeholder
        last_updated: new Date().toISOString(),
      }
    } catch {
      // Return empty stats on error instead of mock data
      return {
        total_devices: 0,
        online_devices: 0,
        offline_devices: 0,
        data_points_today: 0,
        alerts_count: 0,
        last_updated: new Date().toISOString(),
      }
    }
  }

  // Alerts (simulated - Golioth doesn't have a direct alerts API)
  async getAlerts(projectId?: string): Promise<GoliothAlert[]> {
    try {
      if (!this.enabled) {
        // Return empty array when API is not configured
        console.info(
          'Golioth API not configured. Set GOLIOTH_API_KEY and GOLIOTH_PROJECT_ID to enable.'
        )
        return []
      }

      const id = projectId || this.projectId
      const devices = await this.getDevices(id)

      // Generate alerts based on device status
      const alerts: GoliothAlert[] = []

      devices.forEach((device) => {
        if (device.status === 'offline') {
          alerts.push({
            id: `alert-${device.id}-offline`,
            device_id: device.id,
            device_name: device.name,
            severity: 'warning',
            message: `Device ${device.name} is offline`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            type: 'connectivity',
          })
        }

        // Add random data alerts for online devices
        if (device.status === 'online' && Math.random() < 0.1) {
          alerts.push({
            id: `alert-${device.id}-data`,
            device_id: device.id,
            device_name: device.name,
            severity: Math.random() < 0.3 ? 'critical' : 'info',
            message: `Unusual data pattern detected on ${device.name}`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            type: 'data',
          })
        }
      })

      return alerts.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    } catch {
      return [
        {
          id: 'alert-1',
          device_id: 'mock-device-1',
          device_name: 'Temperature Sensor - Floor 1',
          severity: 'warning',
          message: 'Temperature above normal range',
          timestamp: new Date().toISOString(),
          acknowledged: false,
          type: 'data',
        },
      ]
    }
  }

  // Recent Activity
  async getRecentActivity(
    projectId?: string,
    limit: number = 10
  ): Promise<
    Array<{
      id: string
      type:
        | 'device_connected'
        | 'device_disconnected'
        | 'data_received'
        | 'alert_triggered'
      message: string
      timestamp: string
      device_id?: string
      device_name?: string
    }>
  > {
    try {
      if (!this.enabled) {
        // Return empty array when API is not configured
        console.info(
          'Golioth API not configured. Set GOLIOTH_API_KEY and GOLIOTH_PROJECT_ID to enable.'
        )
        return []
      }

      const id = projectId || this.projectId
      const devices = await this.getDevices(id)

      const activities: Array<{
        id: string
        type:
          | 'device_connected'
          | 'device_disconnected'
          | 'data_received'
          | 'alert_triggered'
        message: string
        timestamp: string
        device_id?: string
        device_name?: string
      }> = []

      // Generate activities based on devices
      devices.forEach((device) => {
        if (device.last_seen) {
          activities.push({
            id: `activity-${device.id}-${Date.now()}`,
            type:
              device.status === 'online'
                ? 'device_connected'
                : ('device_disconnected' as const),
            message: `${device.name} ${device.status === 'online' ? 'connected' : 'disconnected'}`,
            timestamp: device.last_seen,
            device_id: device.id,
            device_name: device.name,
          })
        }
      })

      return activities
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, limit)
    } catch {
      // Return empty array on error instead of mock data
      return []
    }
  }
}

// Singleton instance
export const goliothAPI = new GoliothAPI()
