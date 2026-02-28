/**
 * Database Device Management Service
 *
 * This service handles CRUD operations for devices stored in the local database.
 * Devices can optionally be mapped to external systems like Golioth.
 */

import { createClient } from '@/lib/supabase/client'
import { Database, Json } from '@/lib/supabase-types'

type Device = Database['public']['Tables']['devices']['Row']
type DeviceInsert = Database['public']['Tables']['devices']['Insert']
type DeviceUpdate = Database['public']['Tables']['devices']['Update']
type DeviceIntegration =
  Database['public']['Tables']['device_integrations']['Row']

export interface LocalDevice {
  id: string
  organization_id: string
  integration_id?: string | null
  external_device_id?: string | null
  name: string
  device_type: string
  model?: string | null
  serial_number?: string | null
  status: Database['public']['Enums']['device_status'] | null
  last_seen?: string | null
  battery_level?: number | null
  signal_strength?: number | null
  firmware_version?: string | null
  location_id?: string | null
  department_id?: string | null
  metadata: Json | null
  created_at: string | null
  updated_at: string | null
  // Integration details (if mapped)
  integration?: DeviceIntegration | null
  // Location details
  location?: {
    name: string
    description?: string
  } | null
  department?: {
    name: string
    description?: string
  } | null
}

export interface DeviceFilters {
  organization_id?: string
  status?: Device['status']
  device_type?: string
  location_id?: string
  department_id?: string
  integration_id?: string
  has_external_mapping?: boolean
}

export class DatabaseDeviceService {
  private supabase = createClient()

  /**
   * Get all devices with optional filtering and includes
   */
  async getDevices(filters: DeviceFilters = {}): Promise<LocalDevice[]> {
    let query = this.supabase
      .from('devices')
      .select(
        `
        *,
        integration:device_integrations(*),
        location:locations(name, description),
        department:departments(name, description)
      `
      )
      .order('created_at', { ascending: false })

    // Apply filters
    if (filters.organization_id) {
      query = query.eq('organization_id', filters.organization_id)
    }
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.device_type) {
      query = query.eq('device_type', filters.device_type)
    }
    if (filters.location_id) {
      query = query.eq('location_id', filters.location_id)
    }
    if (filters.department_id) {
      query = query.eq('department_id', filters.department_id)
    }
    if (filters.integration_id) {
      query = query.eq('integration_id', filters.integration_id)
    }
    if (filters.has_external_mapping !== undefined) {
      if (filters.has_external_mapping) {
        query = query.not('external_device_id', 'is', null)
      } else {
        query = query.is('external_device_id', null)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching devices:', error)
      throw new Error(`Failed to fetch devices: ${error.message}`)
    }

    return data as LocalDevice[]
  }

  /**
   * Get a single device by ID
   */
  async getDevice(id: string): Promise<LocalDevice | null> {
    const { data, error } = await this.supabase
      .from('devices')
      .select(
        `
        *,
        integration:device_integrations(*),
        location:locations(name, description),
        department:departments(name, description)
      `
      )
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      console.error('Error fetching device:', error)
      throw new Error(`Failed to fetch device: ${error.message}`)
    }

    return data as LocalDevice
  }

  /**
   * Create a new device
   */
  async createDevice(device: DeviceInsert): Promise<LocalDevice> {
    const { data, error } = await this.supabase
      .from('devices')
      .insert(device as any)
      .select(
        `
        *,
        integration:device_integrations(*),
        location:locations(name, description),
        department:departments(name, description)
      `
      )
      .single()

    if (error) {
      console.error('Error creating device:', error)
      throw new Error(`Failed to create device: ${error.message}`)
    }

    return data as LocalDevice
  }

  /**
   * Update an existing device
   */
  async updateDevice(id: string, updates: DeviceUpdate): Promise<LocalDevice> {
    const { data, error } = await this.supabase
      .from('devices')
      .update({ ...updates, updated_at: new Date().toISOString() } as any)
      .eq('id', id)
      .select(
        `
        *,
        integration:device_integrations(*),
        location:locations(name, description),
        department:departments(name, description)
      `
      )
      .single()

    if (error) {
      console.error('Error updating device:', error)
      throw new Error(`Failed to update device: ${error.message}`)
    }

    return data as LocalDevice
  }

  /**
   * Delete a device
   */
  async deleteDevice(id: string): Promise<void> {
    const { error } = await this.supabase.from('devices').delete().eq('id', id)

    if (error) {
      console.error('Error deleting device:', error)
      throw new Error(`Failed to delete device: ${error.message}`)
    }
  }

  /**
   * Map a local device to an external system (like Golioth)
   */
  async mapDeviceToExternal(
    deviceId: string,
    integrationId: string,
    externalDeviceId: string
  ): Promise<LocalDevice> {
    return this.updateDevice(deviceId, {
      integration_id: integrationId,
      external_device_id: externalDeviceId,
    })
  }

  /**
   * Unmap a device from external system
   */
  async unmapDeviceFromExternal(deviceId: string): Promise<LocalDevice> {
    return this.updateDevice(deviceId, {
      integration_id: null,
      external_device_id: null,
    })
  }

  /**
   * Get devices by external system mapping
   */
  async getDevicesByIntegration(integrationId: string): Promise<LocalDevice[]> {
    return this.getDevices({ integration_id: integrationId })
  }

  /**
   * Get device by external ID
   */
  async getDeviceByExternalId(
    externalDeviceId: string
  ): Promise<LocalDevice | null> {
    const { data, error } = await this.supabase
      .from('devices')
      .select(
        `
        *,
        integration:device_integrations(*),
        location:locations(name, description),
        department:departments(name, description)
      `
      )
      .eq('external_device_id', externalDeviceId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null
      }
      console.error('Error fetching device by external ID:', error)
      throw new Error(`Failed to fetch device by external ID: ${error.message}`)
    }

    return data as LocalDevice
  }

  /**
   * Get device statistics
   */
  async getDeviceStats(organizationId: string): Promise<{
    total: number
    online: number
    offline: number
    warning: number
    error: number
    mapped_to_external: number
  }> {
    // Since we don't have custom functions yet, we'll calculate stats manually
    const devices = await this.getDevices({ organization_id: organizationId })

    const stats = {
      total: devices.length,
      online: devices.filter((d) => d.status === 'online').length,
      offline: devices.filter((d) => d.status === 'offline').length,
      warning: devices.filter((d) => d.status === 'warning').length,
      error: devices.filter((d) => d.status === 'error').length,
      mapped_to_external: devices.filter((d) => d.external_device_id !== null)
        .length,
    }

    return stats
  }
}

// Export singleton instance
export const databaseDeviceService = new DatabaseDeviceService()
