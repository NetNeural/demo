// ===========================================================================
// Edge Functions Module Entry Point
// ===========================================================================
// Re-exports the singleton client and all types for easy importing
// Usage: import { edgeFunctions } from '@/lib/edge-functions'
// ===========================================================================

export { edgeFunctions } from './client'
export type {
  EdgeFunctionResponse,
  EdgeFunctionOptions,
  DevicesAPI,
  AlertsAPI,
  OrganizationsAPI,
  MembersAPI,
  UsersAPI,
  LocationsAPI,
  IntegrationsAPI,
} from './client'
