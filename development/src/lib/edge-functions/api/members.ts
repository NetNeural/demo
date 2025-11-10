/**
 * Members API Module
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'

export interface MembersAPI {
  list: (organizationId: string) => Promise<EdgeFunctionResponse<{ members: unknown[] }>>
  add: (organizationId: string, data: { userId: string; role: string }) => Promise<EdgeFunctionResponse<unknown>>
  updateRole: (organizationId: string, userId: string, role: string) => Promise<EdgeFunctionResponse<unknown>>
  remove: (organizationId: string, userId: string) => Promise<EdgeFunctionResponse<unknown>>
}

export function createMembersAPI(call: <T>(functionName: string, options?: EdgeFunctionOptions) => Promise<EdgeFunctionResponse<T>>): MembersAPI {
  return {
    /**
     * List members for an organization
     */
    list: (organizationId) =>
      call<{ members: unknown[] }>('members', {
        params: { organization_id: organizationId },
      }),
    
    /**
     * Add a member to an organization
     */
    add: (organizationId, data) =>
      call('members', {
        method: 'POST',
        params: { organization_id: organizationId },
        body: data,
      }),
    
    /**
     * Update member role
     */
    updateRole: (organizationId, userId, role) =>
      call('members', {
        method: 'PUT',
        params: { organization_id: organizationId },
        body: { userId, role },
      }),
    
    /**
     * Remove member from organization
     */
    remove: (organizationId, userId) =>
      call('members', {
        method: 'DELETE',
        params: { organization_id: organizationId },
        body: { userId },
      }),
  }
}
