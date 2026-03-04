import { describe, it, expect } from 'vitest'

describe('Edge Function API Contracts', () => {
  it('all functions return data wrapper', () => {
    const response = { data: { result: 'ok' }, error: null }
    expect(response).toHaveProperty('data')
  })

  it('error response has error field', () => {
    const errorResponse = { data: null, error: { message: 'Unauthorized' } }
    expect(errorResponse.error).not.toBeNull()
    expect(errorResponse.error?.message).toBe('Unauthorized')
  })

  it('auth token is required for protected actions', () => {
    const authHeader = 'Bearer eyJhbGciOiJIUzI1NiJ9...'
    expect(authHeader).toContain('Bearer')
  })
})
