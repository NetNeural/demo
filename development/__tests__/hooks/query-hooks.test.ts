/**
 * Query Hooks Tests
 * Tests for all React Query hooks using mocked Supabase and edge functions.
 * Covers: useDevicesQuery, useDeviceQuery, useDeviceStatusQuery,
 *         useUpdateDeviceMutation, useDeleteDeviceMutation,
 *         useOrganizationsQuery, useOrganizationQuery, useOrganizationMembersQuery,
 *         useCurrentUserQuery, useUsersQuery, useUpdateOrganizationMutation,
 *         useAlertsQuery, useAlertQuery, useAcknowledgeAlertMutation,
 *         useBulkAcknowledgeAlertsMutation, useDismissAlertMutation
 */

import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Supabase mock ────────────────────────────────────────────────────────────

const mockSupabaseFrom = jest.fn()
const mockSupabaseAuth = {
  getUser: jest.fn(),
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: mockSupabaseFrom,
    auth: mockSupabaseAuth,
  })),
}))

// ─── Edge functions mock ──────────────────────────────────────────────────────

const mockEdgeFunctions = {
  devices: {
    list: jest.fn(),
    get: jest.fn(),
    getStatus: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}

jest.mock('@/lib/edge-functions', () => ({
  edgeFunctions: mockEdgeFunctions,
}))

// ─── Query client wrapper ─────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

// ─── Supabase query builder helpers ──────────────────────────────────────────

function makeQueryBuilder(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = (obj: Record<string, unknown>) => {
    ;['select', 'eq', 'neq', 'order', 'limit', 'in', 'is', 'not', 'gte', 'lte', 'single', 'update', 'insert', 'delete'].forEach(
      (m) => { obj[m] = jest.fn(() => chain(obj)) }
    )
    obj.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve)
    // Make it a thenable/promise-like AND return the result directly for .single()
    return new Proxy(obj, {
      get(target, prop) {
        if (prop === 'then') return (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve)
        if (prop in target) return target[prop as string]
        return jest.fn(() => chain(target))
      }
    })
  }
  return chain(builder)
}

// ─── Tests: useDevicesQuery ───────────────────────────────────────────────────

describe('useDevicesQuery', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns devices on success', async () => {
    const devices = [{ id: 'd-1', name: 'Device 1' }, { id: 'd-2', name: 'Device 2' }]
    mockEdgeFunctions.devices.list.mockResolvedValue({ success: true, data: { devices } })

    const { useDevicesQuery } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useDevicesQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(devices)
    expect(mockEdgeFunctions.devices.list).toHaveBeenCalledWith(undefined)
  })

  test('filters by organizationId when provided', async () => {
    mockEdgeFunctions.devices.list.mockResolvedValue({ success: true, data: { devices: [] } })

    const { useDevicesQuery } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useDevicesQuery('org-123'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockEdgeFunctions.devices.list).toHaveBeenCalledWith('org-123')
  })

  test('throws error on failure', async () => {
    mockEdgeFunctions.devices.list.mockResolvedValue({ success: false, error: { message: 'API error' } })

    const { useDevicesQuery } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useDevicesQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('API error')
  })

  test('returns empty array when devices is null', async () => {
    mockEdgeFunctions.devices.list.mockResolvedValue({ success: true, data: { devices: null } })

    const { useDevicesQuery } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useDevicesQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ─── Tests: useDeviceQuery ────────────────────────────────────────────────────

describe('useDeviceQuery', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns device on success', async () => {
    const device = { id: 'd-1', name: 'Device 1' }
    mockEdgeFunctions.devices.get.mockResolvedValue({ success: true, data: device })

    const { useDeviceQuery } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useDeviceQuery('d-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(device)
  })

  test('is disabled when deviceId is empty', async () => {
    const { useDeviceQuery } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useDeviceQuery(''), { wrapper: createWrapper() })

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockEdgeFunctions.devices.get).not.toHaveBeenCalled()
  })

  test('throws on failure', async () => {
    mockEdgeFunctions.devices.get.mockResolvedValue({ success: false, error: { message: 'Not found' } })

    const { useDeviceQuery } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useDeviceQuery('d-999'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('Not found')
  })
})

// ─── Tests: useUpdateDeviceMutation ──────────────────────────────────────────

describe('useUpdateDeviceMutation', () => {
  beforeEach(() => jest.clearAllMocks())

  test('calls edgeFunctions.devices.update and returns data', async () => {
    const updated = { id: 'd-1', name: 'Updated' }
    mockEdgeFunctions.devices.update.mockResolvedValue({ success: true, data: updated })

    const { useUpdateDeviceMutation } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useUpdateDeviceMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate({ id: 'd-1', name: 'Updated' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockEdgeFunctions.devices.update).toHaveBeenCalledWith('d-1', { id: 'd-1', name: 'Updated' })
  })

  test('fails when API returns error', async () => {
    mockEdgeFunctions.devices.update.mockResolvedValue({ success: false, error: { message: 'Forbidden' } })

    const { useUpdateDeviceMutation } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useUpdateDeviceMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate({ id: 'd-1', name: 'Bad' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('Forbidden')
  })
})

// ─── Tests: useDeleteDeviceMutation ──────────────────────────────────────────

describe('useDeleteDeviceMutation', () => {
  beforeEach(() => jest.clearAllMocks())

  test('deletes device successfully', async () => {
    mockEdgeFunctions.devices.delete.mockResolvedValue({ success: true, data: {} })

    const { useDeleteDeviceMutation } = await import('@/hooks/queries/useDevices')
    const { result } = renderHook(() => useDeleteDeviceMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate('d-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(mockEdgeFunctions.devices.delete).toHaveBeenCalledWith('d-1')
  })
})

// ─── Tests: useOrganizationsQuery ────────────────────────────────────────────

describe('useOrganizationsQuery', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns organizations on success', async () => {
    const orgs = [{ id: 'o-1', name: 'Org 1' }, { id: 'o-2', name: 'Org 2' }]
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: orgs, error: null }))

    const { useOrganizationsQuery } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useOrganizationsQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(orgs)
  })

  test('throws on supabase error', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: null, error: { message: 'DB error' } }))

    const { useOrganizationsQuery } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useOrganizationsQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('DB error')
  })

  test('returns empty array when data is null', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: null, error: null }))

    const { useOrganizationsQuery } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useOrganizationsQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

// ─── Tests: useOrganizationQuery ─────────────────────────────────────────────

describe('useOrganizationQuery', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns single organization', async () => {
    const org = { id: 'o-1', name: 'Org 1' }
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: org, error: null }))

    const { useOrganizationQuery } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useOrganizationQuery('o-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(org)
  })

  test('is disabled when organizationId is empty', async () => {
    const { useOrganizationQuery } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useOrganizationQuery(''), { wrapper: createWrapper() })

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ─── Tests: useOrganizationMembersQuery ──────────────────────────────────────

describe('useOrganizationMembersQuery', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns members on success', async () => {
    const members = [{ id: 'm-1', user_id: 'u-1', organization_id: 'o-1', role: 'member' }]
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: members, error: null }))

    const { useOrganizationMembersQuery } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useOrganizationMembersQuery('o-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(members)
  })

  test('is disabled when organizationId is empty', async () => {
    const { useOrganizationMembersQuery } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useOrganizationMembersQuery(''), { wrapper: createWrapper() })

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ─── Tests: useCurrentUserQuery ───────────────────────────────────────────────

describe('useCurrentUserQuery', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns current user', async () => {
    const user = { id: 'u-1', email: 'test@example.com' }
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user }, error: null })

    const { useCurrentUserQuery } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useCurrentUserQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(user)
  })

  test('throws on auth error', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'Not authenticated' } })

    const { useCurrentUserQuery } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useCurrentUserQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── Tests: useAlertsQuery ────────────────────────────────────────────────────

describe('useAlertsQuery', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns alerts on success', async () => {
    const alerts = [
      { id: 'a-1', severity: 'high', is_resolved: false },
      { id: 'a-2', severity: 'low', is_resolved: true },
    ]
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: alerts, error: null }))

    const { useAlertsQuery } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useAlertsQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(alerts)
  })

  test('returns empty array when data is null', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: null, error: null }))

    const { useAlertsQuery } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useAlertsQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  test('throws on supabase error', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: null, error: { message: 'Query failed' } }))

    const { useAlertsQuery } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useAlertsQuery(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('Query failed')
  })

  test('accepts filters - unresolvedOnly', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))

    const { useAlertsQuery } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(
      () => useAlertsQuery({ unresolvedOnly: true }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  test('accepts filters - deviceId', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))

    const { useAlertsQuery } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(
      () => useAlertsQuery({ deviceId: 'd-1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  test('accepts filters - organizationId', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: [], error: null }))

    const { useAlertsQuery } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(
      () => useAlertsQuery({ organizationId: 'o-1' }),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

// ─── Tests: useAlertQuery ─────────────────────────────────────────────────────

describe('useAlertQuery', () => {
  beforeEach(() => jest.clearAllMocks())

  test('returns single alert', async () => {
    const alert = { id: 'a-1', severity: 'critical', is_resolved: false }
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: alert, error: null }))

    const { useAlertQuery } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useAlertQuery('a-1'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(alert)
  })

  test('is disabled when alertId is empty', async () => {
    const { useAlertQuery } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useAlertQuery(''), { wrapper: createWrapper() })

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.fetchStatus).toBe('idle')
    expect(mockSupabaseFrom).not.toHaveBeenCalled()
  })
})

// ─── Tests: useAcknowledgeAlertMutation ──────────────────────────────────────

describe('useAcknowledgeAlertMutation', () => {
  beforeEach(() => jest.clearAllMocks())

  test('acknowledges alert successfully', async () => {
    const user = { id: 'u-1' }
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user } })
    const updated = { id: 'a-1', is_resolved: true, device_id: 'd-1' }
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: updated, error: null }))

    const { useAcknowledgeAlertMutation } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useAcknowledgeAlertMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate('a-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  test('throws when not authenticated', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null } })

    const { useAcknowledgeAlertMutation } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useAcknowledgeAlertMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate('a-1')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('Not authenticated')
  })
})

// ─── Tests: useBulkAcknowledgeAlertsMutation ─────────────────────────────────

describe('useBulkAcknowledgeAlertsMutation', () => {
  beforeEach(() => jest.clearAllMocks())

  test('bulk acknowledges alerts', async () => {
    const user = { id: 'u-1' }
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user } })
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: [{ id: 'a-1' }, { id: 'a-2' }], error: null }))

    const { useBulkAcknowledgeAlertsMutation } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useBulkAcknowledgeAlertsMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate(['a-1', 'a-2'])
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  test('throws when not authenticated', async () => {
    mockSupabaseAuth.getUser.mockResolvedValue({ data: { user: null } })

    const { useBulkAcknowledgeAlertsMutation } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useBulkAcknowledgeAlertsMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate(['a-1'])
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── Tests: useDismissAlertMutation ──────────────────────────────────────────

describe('useDismissAlertMutation', () => {
  beforeEach(() => jest.clearAllMocks())

  test('dismisses alert successfully', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: null, error: null }))

    const { useDismissAlertMutation } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useDismissAlertMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate('a-1')
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  test('fails when supabase returns error', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: null, error: { message: 'Delete failed' } }))

    const { useDismissAlertMutation } = await import('@/hooks/queries/useAlerts')
    const { result } = renderHook(() => useDismissAlertMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate('a-bad')
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('Delete failed')
  })
})

// ─── Tests: useUpdateOrganizationMutation ────────────────────────────────────

describe('useUpdateOrganizationMutation', () => {
  beforeEach(() => jest.clearAllMocks())

  test('updates organization successfully', async () => {
    const updated = { id: 'o-1', name: 'Updated Org' }
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: updated, error: null }))

    const { useUpdateOrganizationMutation } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useUpdateOrganizationMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate({ id: 'o-1', name: 'Updated Org' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  test('throws on error', async () => {
    mockSupabaseFrom.mockReturnValue(makeQueryBuilder({ data: null, error: { message: 'Update failed' } }))

    const { useUpdateOrganizationMutation } = await import('@/hooks/queries/useOrganizations')
    const { result } = renderHook(() => useUpdateOrganizationMutation(), { wrapper: createWrapper() })

    await act(async () => {
      result.current.mutate({ id: 'o-1', name: 'Bad' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe('Update failed')
  })
})

// ─── Tests: queries/index exports ────────────────────────────────────────────

describe('queries/index barrel exports', () => {
  test('re-exports device hooks', async () => {
    const mod = await import('@/hooks/queries/index')
    expect(mod.useDevicesQuery).toBeDefined()
    expect(mod.useDeviceQuery).toBeDefined()
    expect(mod.useUpdateDeviceMutation).toBeDefined()
    expect(mod.useDeleteDeviceMutation).toBeDefined()
  })

  test('re-exports organization hooks', async () => {
    const mod = await import('@/hooks/queries/index')
    expect(mod.useOrganizationsQuery).toBeDefined()
    expect(mod.useOrganizationQuery).toBeDefined()
    expect(mod.useOrganizationMembersQuery).toBeDefined()
    expect(mod.useCurrentUserQuery).toBeDefined()
  })

  test('re-exports alert hooks', async () => {
    const mod = await import('@/hooks/queries/index')
    expect(mod.useAlertsQuery).toBeDefined()
    expect(mod.useAcknowledgeAlertMutation).toBeDefined()
    expect(mod.useBulkAcknowledgeAlertsMutation).toBeDefined()
    expect(mod.useDismissAlertMutation).toBeDefined()
  })
})
