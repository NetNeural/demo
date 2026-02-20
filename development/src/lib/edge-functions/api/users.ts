/**
 * Users API Module
 */

import type { EdgeFunctionResponse, EdgeFunctionOptions } from '../types'

export interface UsersAPI {
  create: (data: {
    email: string
    password: string
    fullName: string
    role?: string
    organizationRole?: string
    organizationId?: string
  }) => Promise<EdgeFunctionResponse<unknown>>
}

export function createUsersAPI(
  call: <T>(
    functionName: string,
    options?: EdgeFunctionOptions
  ) => Promise<EdgeFunctionResponse<T>>
): UsersAPI {
  return {
    /**
     * Create a new user
     */
    create: (data) =>
      call('create-user', {
        method: 'POST',
        body: data,
      }),
  }
}
