/**
 * Organizations API Module
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'
import type {
  OrganizationSettings,
  SubscriptionTier,
} from '@/types/organization'

export interface OrganizationsAPI {
  list: () => Promise<
    EdgeFunctionResponse<{ organizations: unknown[]; isSuperAdmin: boolean }>
  >
  stats: (organizationId: string) => Promise<EdgeFunctionResponse<unknown>>
  create: (data: {
    name: string
    slug?: string
    description?: string
    subscriptionTier?: SubscriptionTier
    parentOrganizationId?: string
    ownerEmail?: string
    ownerFullName?: string
    sendWelcomeEmail?: boolean
  }) => Promise<EdgeFunctionResponse<unknown>>
  update: (
    organizationId: string,
    data: {
      name?: string
      description?: string
      subscriptionTier?: SubscriptionTier
      isActive?: boolean
      settings?: OrganizationSettings
    }
  ) => Promise<EdgeFunctionResponse<unknown>>
  delete: (organizationId: string) => Promise<EdgeFunctionResponse<unknown>>
  listChildren: (
    parentOrgId: string
  ) => Promise<EdgeFunctionResponse<{ organizations: unknown[] }>>
}

export function createOrganizationsAPI(
  call: <T>(
    functionName: string,
    options?: EdgeFunctionOptions
  ) => Promise<EdgeFunctionResponse<T>>
): OrganizationsAPI {
  return {
    /**
     * List all organizations for the current user
     */
    list: () =>
      call<{ organizations: unknown[]; isSuperAdmin: boolean }>(
        'organizations'
      ),

    /**
     * Get dashboard stats for an organization
     */
    stats: (organizationId: string) =>
      call('dashboard-stats', {
        params: { organization_id: organizationId },
      }),

    /**
     * Create a new organization
     */
    create: (data) =>
      call('organizations', {
        method: 'POST',
        body: data,
      }),

    /**
     * Update an existing organization
     */
    update: (organizationId, data) =>
      call(`organizations/${organizationId}`, {
        method: 'PATCH',
        body: data,
      }),

    /**
     * Delete an organization
     */
    delete: (organizationId) =>
      call(`organizations/${organizationId}`, {
        method: 'DELETE',
      }),

    /**
     * List child organizations of a parent (reseller) org
     */
    listChildren: (parentOrgId: string) =>
      call<{ organizations: unknown[] }>('organizations', {
        params: { parent_organization_id: parentOrgId },
      }),
  }
}
