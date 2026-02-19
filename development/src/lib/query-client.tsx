/**
 * React Query Configuration
 * 
 * Centralized configuration for TanStack Query (React Query) v5
 * Implements caching strategy per Story 3.3 requirements:
 * - Static data: 5 minutes (organizations, users)
 * - Device status: 30 seconds
 * - Telemetry: 1 minute
 * - AI insights: 15 minutes (already implemented in Edge Function)
 */

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

/**
 * Default Query Client Configuration
 * 
 * Optimized for IoT platform with:
 * - Aggressive caching for static data
 * - Automatic background refetching
 * - Retry logic for network failures
 * - Cache garbage collection
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Default stale time: 30 seconds
        // Data is considered fresh for this duration
        staleTime: 30 * 1000,

        // Cache time: 5 minutes
        // How long inactive queries stay in cache
        gcTime: 5 * 60 * 1000, // Previously 'cacheTime' in v4

        // Retry failed requests 3 times
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

        // Refetch on window focus for critical data
        refetchOnWindowFocus: true,
        
        // Refetch on reconnect
        refetchOnReconnect: true,

        // Don't refetch on mount if data is fresh
        refetchOnMount: false,
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
        retryDelay: 1000,
      },
    },
  })
}

/**
 * Browser-only QueryClient instance
 * Creates a new client on first render to avoid sharing state between requests
 */
let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always create a new query client
    return makeQueryClient()
  } else {
    // Browser: create query client if we don't have one yet
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

/**
 * Query Keys for Consistent Caching
 * 
 * Organized by entity type with optional filters
 * Used for cache invalidation and prefetching
 */
export const queryKeys = {
  // Organizations (static data - 5 min cache)
  organizations: ['organizations'] as const,
  organization: (id: string) => ['organizations', id] as const,
  organizationMembers: (orgId: string) => ['organizations', orgId, 'members'] as const,

  // Users (static data - 5 min cache)
  users: ['users'] as const,
  user: (id: string) => ['users', id] as const,
  currentUser: ['users', 'current'] as const,

  // Devices (30 second cache)
  devices: ['devices'] as const,
  device: (id: string) => ['devices', id] as const,
  devicesByOrg: (orgId: string) => ['devices', 'org', orgId] as const,
  deviceStatus: (id: string) => ['devices', id, 'status'] as const,

  // Telemetry (1 minute cache)
  telemetry: (deviceId: string) => ['telemetry', deviceId] as const,
  telemetryRange: (deviceId: string, start: string, end: string) => 
    ['telemetry', deviceId, start, end] as const,
  latestTelemetry: (deviceId: string) => ['telemetry', deviceId, 'latest'] as const,

  // Alerts (30 second cache)
  alerts: ['alerts'] as const,
  alert: (id: string) => ['alerts', id] as const,
  alertsByDevice: (deviceId: string) => ['alerts', 'device', deviceId] as const,
  alertsByOrg: (orgId: string) => ['alerts', 'org', orgId] as const,
  unacknowledgedAlerts: ['alerts', 'unacknowledged'] as const,

  // Device Types (5 minute cache)
  deviceTypes: (orgId: string) => ['device-types', 'org', orgId] as const,
  deviceType: (id: string) => ['device-types', id] as const,

  // Sensor Thresholds (5 minute cache)
  thresholds: (deviceId: string) => ['thresholds', deviceId] as const,
  thresholdsByOrg: (orgId: string) => ['thresholds', 'org', orgId] as const,

  // AI Insights (15 minute cache - matches Edge Function)
  aiInsights: (deviceId: string) => ['ai-insights', deviceId] as const,

  // User Actions / Audit Log (1 minute cache)
  userActions: (filters?: Record<string, unknown>) => 
    ['user-actions', filters] as const,
  
  // Analytics (1 minute cache)
  analytics: (type: string, filters?: Record<string, unknown>) => 
    ['analytics', type, filters] as const,
} as const

/**
 * Cache Time Constants (in milliseconds)
 * 
 * Per Story 3.3 acceptance criteria:
 * - STATIC_DATA: 5 minutes
 * - DEVICE_STATUS: 30 seconds
 * - TELEMETRY: 1 minute
 * - AI_INSIGHTS: 15 minutes
 */
export const CACHE_TIME = {
  STATIC_DATA: 5 * 60 * 1000,      // 5 minutes (organizations, users)
  DEVICE_STATUS: 30 * 1000,        // 30 seconds
  TELEMETRY: 60 * 1000,            // 1 minute
  AI_INSIGHTS: 15 * 60 * 1000,     // 15 minutes
  ALERTS: 30 * 1000,               // 30 seconds
} as const

/**
 * QueryProvider Component
 * 
 * Wraps the application with React Query context
 * Includes DevTools in development for debugging
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a new query client on first render (browser-only)
  const [queryClient] = useState(() => getQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show DevTools in development only */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom" />
      )}
    </QueryClientProvider>
  )
}

/**
 * Usage Examples:
 * 
 * @example Basic Query
 * ```tsx
 * import { useQuery } from '@tanstack/react-query'
 * import { queryKeys, CACHE_TIME } from '@/lib/query-client'
 * 
 * function DevicesList() {
 *   const { data, isLoading } = useQuery({
 *     queryKey: queryKeys.devices,
 *     queryFn: async () => {
 *       const { data } = await supabase.from('devices').select('*')
 *       return data
 *     },
 *     staleTime: CACHE_TIME.DEVICE_STATUS, // 30 seconds
 *   })
 * }
 * ```
 * 
 * @example Mutation with Cache Invalidation
 * ```tsx
 * import { useMutation, useQueryClient } from '@tanstack/react-query'
 * 
 * function UpdateDevice() {
 *   const queryClient = useQueryClient()
 *   
 *   const mutation = useMutation({
 *     mutationFn: async (device) => {
 *       const { data } = await supabase
 *         .from('devices')
 *         .update(device)
 *         .eq('id', device.id)
 *       return data
 *     },
 *     onSuccess: (data) => {
 *       // Invalidate and refetch devices list
 *       queryClient.invalidateQueries({ queryKey: queryKeys.devices })
 *       queryClient.invalidateQueries({ queryKey: queryKeys.device(data.id) })
 *     },
 *   })
 * }
 * ```
 * 
 * @example Prefetching for Performance
 * ```tsx
 * import { useQueryClient } from '@tanstack/react-query'
 * 
 * function DeviceRow({ deviceId }) {
 *   const queryClient = useQueryClient()
 *   
 *   const prefetchDevice = () => {
 *     queryClient.prefetchQuery({
 *       queryKey: queryKeys.device(deviceId),
 *       queryFn: () => fetchDevice(deviceId),
 *     })
 *   }
 *   
 *   return <div onMouseEnter={prefetchDevice}>...</div>
 * }
 * ```
 */
