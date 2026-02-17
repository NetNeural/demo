/**
 * React Query Hooks for Alerts
 * 
 * Implements caching strategy per Story 3.3:
 * - Alerts: 30 seconds cache
 * - Automatic cache invalidation on acknowledgments
 * - Real-time updates via background refetching
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys, CACHE_TIME } from '@/lib/query-client'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'

export type Alert = Database['public']['Tables']['alerts']['Row'] & {
  // Extend with any computed fields if needed
}

// Type alias for alert severity
export type AlertSeverity = Database['public']['Enums']['alert_severity']

/**
 * Hook: Fetch all alerts with caching
 * 
 * Cache: 30 seconds per Story 3.3 requirements
 * Background refetch for real-time updates
 * 
 * @example
 * ```tsx
 * const { data: alerts, isLoading } = useAlertsQuery()
 * ```
 */
export function useAlertsQuery(filters?: {
  deviceId?: string
  organizationId?: string
  unresolvedOnly?: boolean
  category?: Alert['category']
  severity?: Alert['severity']
}) {
  const supabase = createClient()

  return useQuery({
    queryKey: filters?.deviceId 
      ? queryKeys.alertsByDevice(filters.deviceId)
      : filters?.organizationId
      ? queryKeys.alertsByOrg(filters.organizationId)
      : filters?.unresolvedOnly
      ? queryKeys.unacknowledgedAlerts
      : queryKeys.alerts,
    
    queryFn: async (): Promise<Alert[]> => {
      let query = supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters?.deviceId) {
        query = query.eq('device_id', filters.deviceId)
      }
      
      if (filters?.unresolvedOnly) {
        query = query.eq('is_resolved', false)
      }
      
      if (filters?.category) {
        query = query.eq('category', filters.category)
      }
      
      if (filters?.severity) {
        query = query.eq('severity', filters.severity)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(error.message || 'Failed to fetch alerts')
      }

      return data || []
    },
    
    staleTime: CACHE_TIME.ALERTS, // 30 seconds
    refetchOnWindowFocus: true, // Refetch on tab focus for real-time feel
  })
}

/**
 * Hook: Fetch single alert
 * 
 * @example
 * ```tsx
 * const { data: alert } = useAlertQuery('alert-123')
 * ```
 */
export function useAlertQuery(alertId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: queryKeys.alert(alertId),
    queryFn: async (): Promise<Alert> => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .eq('id', alertId)
        .single()

      if (error) {
        throw new Error(error.message || 'Failed to fetch alert')
      }

      return data
    },
    staleTime: CACHE_TIME.ALERTS, // 30 seconds
    enabled: !!alertId,
  })
}

/**
 * Hook: Acknowledge alert mutation
 * 
 * Automatically invalidates alert queries on success
 * 
 * @example
 * ```tsx
 * const acknowledgeAlert = useAcknowledgeAlertMutation()
 * 
 * acknowledgeAlert.mutate('alert-123', {
 *   onSuccess: () => toast.success('Alert acknowledged'),
 * })
 * ```
 */
export function useAcknowledgeAlertMutation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (alertId: string) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Update alert
      const { data, error } = await supabase
        .from('alerts')
        .update({
          is_resolved: true,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', alertId)
        .select()
        .single()

      if (error) {
        throw new Error(error.message || 'Failed to acknowledge alert')
      }

      return data
    },
    onSuccess: (data) => {
      // Invalidate all alert queries
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
      queryClient.invalidateQueries({ queryKey: queryKeys.unacknowledgedAlerts })
      
      // Only invalidate device alerts if device_id exists
      if (data.device_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.alertsByDevice(data.device_id) })
      }
      
      // Update the specific alert in cache
      queryClient.setQueryData(queryKeys.alert(data.id), data)
    },
  })
}

/**
 * Hook: Bulk acknowledge alerts mutation
 * 
 * @example
 * ```tsx
 * const bulkAcknowledge = useBulkAcknowledgeAlertsMutation()
 * bulkAcknowledge.mutate(['alert-1', 'alert-2', 'alert-3'])
 * ```
 */
export function useBulkAcknowledgeAlertsMutation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (alertIds: string[]) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Not authenticated')
      }

      // Bulk update
      const { data, error } = await supabase
        .from('alerts')
        .update({
          is_resolved: true,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', alertIds)
        .select()

      if (error) {
        throw new Error(error.message || 'Failed to acknowledge alerts')
      }

      return data
    },
    onSuccess: () => {
      // Invalidate all alert queries (simpler than individual invalidation)
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
      queryClient.invalidateQueries({ queryKey: queryKeys.unacknowledgedAlerts })
    },
  })
}

/**
 * Hook: Dismiss alert mutation
 * 
 * @example
 * ```tsx
 * const dismissAlert = useDismissAlertMutation()
 * dismissAlert.mutate('alert-123')
 * ```
 */
export function useDismissAlertMutation() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('alerts')
        .delete()
        .eq('id', alertId)

      if (error) {
        throw new Error(error.message || 'Failed to dismiss alert')
      }

      return { id: alertId }
    },
    onSuccess: (_, alertId) => {
      // Invalidate all alert queries
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
      // Remove alert from cache
      queryClient.removeQueries({ queryKey: queryKeys.alert(alertId) })
    },
  })
}

/**
 * Migration Guide:
 * 
 * BEFORE (direct Supabase queries):
 * ```tsx
 * const [alerts, setAlerts] = useState([])
 * const [loading, setLoading] = useState(true)
 * 
 * useEffect(() => {
 *   async function fetchAlerts() {
 *     const { data } = await supabase.from('alerts').select('*')
 *     setAlerts(data || [])
 *     setLoading(false)
 *   }
 *   fetchAlerts()
 * }, [])
 * ```
 * 
 * AFTER (useAlertsQuery):
 * ```tsx
 * const { data: alerts, isLoading } = useAlertsQuery()
 * ```
 * 
 * Benefits:
 * - Automatic caching (30 seconds)
 * - No duplicate requests
 * - Background refetching
 * - Cache invalidation on mutations
 * - Real-time feel with minimal API calls
 */
