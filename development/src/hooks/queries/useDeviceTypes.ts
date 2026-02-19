/**
 * React Query hooks for Device Types CRUD
 * 
 * Note: The `device_types` table is not yet in the auto-generated Supabase
 * types (migration pending). We use an untyped client reference until
 * `supabase gen types` is re-run after applying the migration.
 * 
 * @see Issue #118 — Device Type Configuration & Threshold Management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { queryKeys, CACHE_TIME } from '@/lib/query-client'
import type { DeviceType, DeviceTypePayload } from '@/types/device-types'

/**
 * Get an untyped Supabase client so we can access the `device_types` table
 * before the generated Database type is refreshed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deviceTypesTable() {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('device_types')
}

// ─── Queries ──────────────────────────────────────────────

/** Fetch all device types for an organization */
export function useDeviceTypesQuery(organizationId?: string) {
  return useQuery<DeviceType[]>({
    queryKey: queryKeys.deviceTypes(organizationId ?? ''),
    queryFn: async () => {
      if (!organizationId) return []

      const { data, error } = await deviceTypesTable()
        .select('*')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true })

      if (error) throw new Error((error as { message: string }).message)
      return (data as DeviceType[]) || []
    },
    enabled: !!organizationId,
    staleTime: CACHE_TIME.STATIC_DATA,
  })
}

/** Fetch a single device type */
export function useDeviceTypeQuery(id?: string) {
  return useQuery<DeviceType | null>({
    queryKey: queryKeys.deviceType(id ?? ''),
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await deviceTypesTable()
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw new Error((error as { message: string }).message)
      return (data as DeviceType) || null
    },
    enabled: !!id,
    staleTime: CACHE_TIME.STATIC_DATA,
  })
}

// ─── Mutations ────────────────────────────────────────────

/** Create a new device type */
export function useCreateDeviceTypeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      organizationId,
      payload,
      userId,
    }: {
      organizationId: string
      payload: DeviceTypePayload
      userId?: string
    }) => {
      const { data, error } = await deviceTypesTable()
        .insert({
          organization_id: organizationId,
          ...payload,
          created_by: userId ?? null,
          updated_by: userId ?? null,
        })
        .select()
        .single()

      if (error) throw new Error((error as { message: string }).message)
      return data as DeviceType
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.deviceTypes(variables.organizationId),
      })
    },
  })
}

/** Update an existing device type */
export function useUpdateDeviceTypeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      organizationId,
      payload,
      userId,
    }: {
      id: string
      organizationId: string
      payload: Partial<DeviceTypePayload>
      userId?: string
    }) => {
      const { data, error } = await deviceTypesTable()
        .update({
          ...payload,
          updated_by: userId ?? null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error((error as { message: string }).message)
      return data as DeviceType
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.deviceTypes(variables.organizationId),
      })
      queryClient.invalidateQueries({
        queryKey: queryKeys.deviceType(variables.id),
      })
    },
  })
}

/** Delete a device type */
export function useDeleteDeviceTypeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: string
      organizationId: string
    }) => {
      const { error } = await deviceTypesTable()
        .delete()
        .eq('id', id)

      if (error) throw new Error((error as { message: string }).message)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.deviceTypes(variables.organizationId),
      })
    },
  })
}
