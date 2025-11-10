/**
 * Locations API Module
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'

export interface LocationsAPI {
  list: (organizationId: string) => Promise<EdgeFunctionResponse<unknown[]>>
  create: (data: {
    organization_id: string
    name: string
    description?: string
    address?: string
    city?: string
    state?: string
    country?: string
  }) => Promise<EdgeFunctionResponse<unknown>>
  update: (locationId: string, data: {
    name?: string
    description?: string
    address?: string
    city?: string
    state?: string
    country?: string
  }) => Promise<EdgeFunctionResponse<unknown>>
  delete: (locationId: string) => Promise<EdgeFunctionResponse<unknown>>
}

export function createLocationsAPI(call: <T>(functionName: string, options?: EdgeFunctionOptions) => Promise<EdgeFunctionResponse<T>>): LocationsAPI {
  return {
    /**
     * List all locations for an organization
     */
    list: (organizationId) =>
      call<unknown[]>('locations', {
        params: { organization_id: organizationId },
      }),
    
    /**
     * Create a new location
     */
    create: (data) =>
      call('locations', {
        method: 'POST',
        body: data,
      }),
    
    /**
     * Update an existing location
     */
    update: (locationId, data) =>
      call(`locations/${locationId}`, {
        method: 'PUT',
        body: data,
      }),
    
    /**
     * Delete a location
     */
    delete: (locationId) =>
      call(`locations/${locationId}`, {
        method: 'DELETE',
      }),
  }
}
