/**
 * Devices API Module
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'

export interface DevicesAPI {
  list: (
    organizationId?: string,
    options?: { limit?: number }
  ) => Promise<EdgeFunctionResponse<{ devices: unknown[]; count: number }>>
  get: (deviceId: string) => Promise<EdgeFunctionResponse<unknown>>
  create: (data: unknown) => Promise<EdgeFunctionResponse<unknown>>
  update: (
    deviceId: string,
    data: unknown
  ) => Promise<EdgeFunctionResponse<unknown>>
  delete: (deviceId: string) => Promise<EdgeFunctionResponse<unknown>>
  mapToExternal: (
    deviceId: string,
    integrationId: string,
    externalDeviceId: string
  ) => Promise<EdgeFunctionResponse<unknown>>
  unmapFromExternal: (
    deviceId: string
  ) => Promise<EdgeFunctionResponse<unknown>>
  getStatus: (
    deviceId: string
  ) => Promise<EdgeFunctionResponse<{ status: unknown }>>
}

export function createDevicesAPI(
  call: <T>(
    functionName: string,
    options?: EdgeFunctionOptions
  ) => Promise<EdgeFunctionResponse<T>>
): DevicesAPI {
  return {
    /**
     * List all devices for an organization
     */
    list: (organizationId?: string, options?: { limit?: number }) =>
      call<{ devices: unknown[]; count: number }>('devices', {
        params: organizationId
          ? {
              organization_id: organizationId,
              ...options,
            }
          : options,
      }),

    /**
     * Get a specific device by ID
     */
    get: (deviceId: string) => call(`devices/${deviceId}`),

    /**
     * Create a new device
     */
    create: (data: unknown) =>
      call('devices', {
        method: 'POST',
        body: data,
      }),

    /**
     * Update an existing device
     */
    update: (deviceId: string, data: unknown) =>
      call(`devices/${deviceId}`, {
        method: 'PUT',
        body: data,
      }),

    /**
     * Delete a device
     */
    delete: (deviceId: string) =>
      call(`devices/${deviceId}`, {
        method: 'DELETE',
      }),

    /**
     * Map a device to an external integration
     */
    mapToExternal: (
      deviceId: string,
      integrationId: string,
      externalDeviceId: string
    ) =>
      call(`devices/${deviceId}/map-external`, {
        method: 'PATCH',
        body: {
          integration_id: integrationId,
          external_device_id: externalDeviceId,
        },
      }),

    /**
     * Unmap a device from external integration
     */
    unmapFromExternal: (deviceId: string) =>
      call(`devices/${deviceId}/unmap-external`, {
        method: 'PATCH',
      }),

    /**
     * Get device status with integration info
     */
    getStatus: (deviceId: string) =>
      call<{ status: unknown }>(`devices/${deviceId}/status`, {
        method: 'PATCH',
      }),
  }
}
