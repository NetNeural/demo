// ===========================================================================
// Golioth API Client Types - Shared Across Edge Functions
// ===========================================================================

export interface GoliothDevice {
  id: string
  name: string
  hardwareId?: string
  projectId: string
  status: 'online' | 'offline' | 'unknown' | 'maintenance'
  lastSeen?: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown>
  tags?: string[]
}

export interface LocalDevice {
  id: string
  organizationId: string
  integrationId: string | null
  externalDeviceId: string | null
  name: string
  deviceType: string
  status: 'online' | 'offline' | 'warning' | 'error'
  lastSeen: string | null
  batteryLevel: number | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface SyncOperation {
  integrationId: string
  organizationId: string
  operation: 'import' | 'export' | 'bidirectional'
  deviceIds?: string[]
  force?: boolean
}

export interface SyncResult {
  syncLogId: string
  devicesProcessed: number
  devicesSucceeded: number
  devicesFailed: number
  conflictsDetected: number
  errors: Array<{
    deviceId: string
    error: string
  }>
}

export interface Conflict {
  deviceId: string
  fieldName: string
  localValue: unknown
  remoteValue: unknown
  localUpdatedAt: string | null
  remoteUpdatedAt: string | null
}

export interface GoliothTelemetry {
  deviceId: string
  timestamp: string
  data: Record<string, unknown>
}
