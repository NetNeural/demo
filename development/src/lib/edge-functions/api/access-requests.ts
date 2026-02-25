/**
 * Access Requests API Module
 * Cross-org temporary access request system (Issue #35)
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'
import type {
  AccessRequest,
  CreateAccessRequestData,
  ApproveAccessRequestData,
} from '@/types/access-request'

export interface AccessRequestsAPI {
  /** List access requests - sent by me or received by my org */
  list: (options?: {
    view?: 'sent' | 'received' | 'all'
    status?: string
    organizationId?: string
  }) => Promise<EdgeFunctionResponse<{ requests: AccessRequest[] }>>

  /** Create a new access request */
  create: (
    data: CreateAccessRequestData
  ) => Promise<
    EdgeFunctionResponse<{ request: AccessRequest; target_org_name: string }>
  >

  /** Approve or deny a request */
  respond: (
    data: ApproveAccessRequestData
  ) => Promise<EdgeFunctionResponse<{ request_id: string; status: string }>>

  /** Cancel or revoke a request */
  revoke: (
    requestId: string
  ) => Promise<EdgeFunctionResponse<{ request_id: string; status: string }>>
}

export function createAccessRequestsAPI(
  call: <T>(
    functionName: string,
    options?: EdgeFunctionOptions
  ) => Promise<EdgeFunctionResponse<T>>
): AccessRequestsAPI {
  return {
    list: (options = {}) =>
      call<{ requests: AccessRequest[] }>('request-access', {
        params: {
          view: options.view || 'sent',
          ...(options.status && { status: options.status }),
          ...(options.organizationId && {
            organization_id: options.organizationId,
          }),
        },
      }),

    create: (data) =>
      call<{ request: AccessRequest; target_org_name: string }>(
        'request-access',
        {
          method: 'POST',
          body: data,
        }
      ),

    respond: (data) =>
      call<{ request_id: string; status: string }>('request-access', {
        method: 'PATCH',
        body: data,
      }),

    revoke: (requestId) =>
      call<{ request_id: string; status: string }>('request-access', {
        method: 'DELETE',
        body: { request_id: requestId },
      }),
  }
}
