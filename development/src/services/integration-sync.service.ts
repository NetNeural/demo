// ===========================================================================
// Integration Sync Service - Frontend
// ===========================================================================
// Handles all integration sync operations from the frontend
// Supports: Golioth, AWS IoT, Azure IoT, MQTT, and other integration types
// Features: Trigger syncs, manage conflicts, real-time subscriptions
// ===========================================================================

import { createClient } from '@/lib/supabase/client'
import { edgeFunctions } from '@/lib/edge-functions/client'
import type { Json } from '@/types/supabase'
import type { Database } from '@/types/supabase'

// Note: Database table will be renamed in migration from golioth_sync_log to integration_sync_log
// Using January 2026 partition for type definition (partitioned table)
type SyncLog = Database['public']['Tables']['golioth_sync_log_2026_01']['Row']
type DeviceConflict = Database['public']['Tables']['device_conflicts']['Row']
type SyncOperation = 'import' | 'export' | 'bidirectional'

export interface SyncOptions {
  integrationId: string
  organizationId: string
  operation: SyncOperation
  deviceIds?: string[]
  force?: boolean
}

export interface SyncProgress {
  syncLogId: string
  status: 'started' | 'processing' | 'completed' | 'failed' | 'partial'
  devicesProcessed: number
  devicesSucceeded: number
  devicesFailed: number
  conflictsDetected: number
  errors?: Array<{ deviceId: string; error: string }>
}

export class IntegrationSyncService {
  private supabase = createClient()

  /**
   * Trigger a sync operation with any integration provider
   * (Golioth, AWS IoT, Azure IoT, MQTT, etc.)
   */
  async triggerSync(options: SyncOptions): Promise<SyncProgress> {
    try {
      const response = await edgeFunctions.integrations.sync(options)

      if (!response.success) {
        throw new Error(response.error?.message || 'Sync failed')
      }

      return response.data as SyncProgress
    } catch (error) {
      console.error('Sync trigger error:', error)
      throw new Error(`Failed to trigger sync: ${(error as Error).message}`)
    }
  }

  /**
   * Get sync history for an organization
   */
  async getSyncHistory(
    organizationId: string,
    limit: number = 50
  ): Promise<SyncLog[]> {
    // Query the current month partition (partitioned table)
    const { data, error } = await this.supabase
      .from('golioth_sync_log_2026_01')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  }

  /**
   * Get sync statistics for an integration
   */
  async getSyncStats(organizationId: string, integrationId?: string) {
    const { data, error } = await this.supabase.rpc('get_sync_stats', {
      org_id: organizationId,
      integration_id_param: integrationId || undefined,
    })

    if (error) throw error
    return data
  }

  /**
   * Get pending conflicts for an organization
   */
  async getPendingConflicts(organizationId: string): Promise<DeviceConflict[]> {
    const { data, error } = await this.supabase.rpc('get_pending_conflicts', {
      org_id: organizationId,
    })

    if (error) throw error
    return (data || []) as unknown as DeviceConflict[]
  }

  /**
   * Resolve a device conflict
   */
  async resolveConflict(
    conflictId: string,
    strategy: 'local_wins' | 'remote_wins' | 'merge',
    resolvedValue?: Record<string, unknown>
  ): Promise<void> {
    const user = await this.supabase.auth.getUser()

    const { error } = await this.supabase
      .from('device_conflicts')
      .update({
        resolution_status: 'resolved',
        resolution_strategy: strategy,
        resolved_value: (resolvedValue as Json) ?? null,
        resolved_by: user.data.user?.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', conflictId)

    if (error) throw error

    // Get conflict details to apply resolution
    const { data: conflict } = await this.supabase
      .from('device_conflicts')
      .select('device_id, field_name, local_value, remote_value')
      .eq('id', conflictId)
      .single()

    if (conflict) {
      const valueToApply =
        resolvedValue || (conflict.remote_value as Record<string, unknown>)
      await this.applyConflictResolution(
        conflict.device_id,
        strategy,
        valueToApply
      )
    }
  }

  /**
   * Apply conflict resolution to device
   */
  private async applyConflictResolution(
    deviceId: string,
    strategy: string,
    resolvedValue: Record<string, unknown>
  ): Promise<void> {
    if (strategy === 'local_wins') {
      // Keep local, no action needed
      return
    }

    if (strategy === 'remote_wins' || strategy === 'merge') {
      // Update local device with resolved value
      await this.supabase
        .from('devices')
        .update(resolvedValue)
        .eq('id', deviceId)
    }
  }

  /**
   * Subscribe to sync log updates (real-time)
   */
  subscribeSyncUpdates(
    organizationId: string,
    callback: (log: SyncLog) => void
  ) {
    return this.supabase
      .channel('sync-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'golioth_sync_log',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => callback(payload.new as SyncLog)
      )
      .subscribe()
  }

  /**
   * Test integration connection
   */
  async testConnection(
    integrationId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      // Trigger a test sync using SDK
      const response = await edgeFunctions.integrations.sync({
        integrationId,
        organizationId,
        operation: 'test',
        deviceIds: [],
      })

      if (!response.success) {
        const errorMessage = response.error?.message || 'Connection test failed'
        console.error(
          '[Integration Service] Test failed:',
          errorMessage,
          'Full response:',
          response
        )
        throw new Error(errorMessage)
      }

      return true
    } catch (error) {
      console.error('[Integration Service] Test connection exception:', error)
      throw error
    }
  }
}

// Singleton instance
export const integrationSyncService = new IntegrationSyncService()
