/**
 * React Query Hooks - Centralized Export
 *
 * Import all query hooks from this file for consistency.
 *
 * @example
 * ```tsx
 * import {
 *   useDevicesQuery,
 *   useAlertsQuery,
 *   useTelemetryStatsQuery,
 * } from '@/hooks/queries'
 * ```
 */

// Devices
export {
  useDeviceStatusQuery,
  useDevicesQuery,
  useDeviceQuery,
  useUpdateDeviceMutation,
  useDeleteDeviceMutation,
} from './useDevices'

// Alerts
export {
  useAlertsQuery,
  useAlertQuery,
  useAcknowledgeAlertMutation,
  useBulkAcknowledgeAlertsMutation,
  useDismissAlertMutation,
  type Alert,
} from './useAlerts'

// Telemetry
export {
  useLatestTelemetryQuery,
  useTelemetryRangeQuery,
  useTelemetryStatsQuery,
  useGroupedTelemetryQuery,
  type TelemetryData,
  type TelemetryRow,
  type TelemetryParsed,
} from './useTelemetry'

// Organizations & Users
export {
  useOrganizationsQuery,
  useOrganizationQuery,
  useOrganizationMembersQuery,
  useCurrentUserQuery,
  useUsersQuery,
  useUserQuery,
  useUpdateOrganizationMutation,
  useAddOrganizationMemberMutation,
  useRemoveOrganizationMemberMutation,
  type Organization,
  type User,
  type OrganizationMember,
} from './useOrganizations'

// Device Types
export {
  useDeviceTypesQuery,
  useDeviceTypeQuery,
  useCreateDeviceTypeMutation,
  useUpdateDeviceTypeMutation,
  useDeleteDeviceTypeMutation,
} from './useDeviceTypes'

// Re-export query client utilities
export { queryKeys, CACHE_TIME } from '@/lib/query-client'
