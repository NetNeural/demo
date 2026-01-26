/**
 * Conflict Detector (Issue #87)
 * 
 * Detects and resolves conflicts between local and remote device data
 * using per-field merge strategies.
 */

import { createClient } from '@/lib/supabase/client';

export type MergeStrategy = 'prefer_local' | 'prefer_remote' | 'manual' | 'merge' | 'prompt';

export interface FieldConflict {
  fieldName: string;
  localValue: any;
  remoteValue: any;
  recommendedStrategy: MergeStrategy;
}

export interface ConflictResolution {
  autoResolved: number;
  manualReview: number;
}

export class ConflictDetector {
  private supabase = createClient();

  // Field-specific merge strategies
  private readonly fieldStrategies: Record<string, MergeStrategy> = {
    // User-editable fields (prefer local)
    name: 'prefer_local',
    description: 'prefer_local',
    tags: 'merge', // Array union
    notes: 'prefer_local',
    
    // IoT platform authoritative fields (prefer remote)
    status: 'prefer_remote',
    battery_level: 'prefer_remote',
    firmware_version: 'prefer_remote',
    last_seen_online: 'prefer_remote',
    last_seen_offline: 'prefer_remote',
    hardware_ids: 'prefer_remote',
    cohort_id: 'prefer_remote',
    golioth_status: 'prefer_remote',
    
    // Metadata (manual review)
    metadata: 'manual'
  };

  /**
   * Detect conflicts between local and remote device data
   */
  detectConflicts(localDevice: any, remoteDevice: any): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    for (const field of Object.keys(this.fieldStrategies)) {
      const localValue = localDevice[field];
      const remoteValue = remoteDevice[field];

      // Only report conflicts if values differ
      if (this.valuesConflict(localValue, remoteValue)) {
        conflicts.push({
          fieldName: field,
          localValue,
          remoteValue,
          recommendedStrategy: this.fieldStrategies[field] || 'prompt'
        });
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts automatically or queue for manual review
   */
  async resolveConflicts(
    deviceId: string,
    conflicts: FieldConflict[]
  ): Promise<ConflictResolution> {
    let autoResolved = 0;
    let manualReview = 0;

    for (const conflict of conflicts) {
      if (conflict.recommendedStrategy === 'manual') {
        // Queue for manual review
        await this.supabase
          .from('sync_conflicts')
          .insert({
            device_id: deviceId,
            field_name: conflict.fieldName,
            local_value: conflict.localValue,
            remote_value: conflict.remoteValue,
            resolution_strategy: 'manual'
          });
        manualReview++;
      } else {
        // Auto-resolve based on strategy
        const resolvedValue = this.applyStrategy(
          conflict.localValue,
          conflict.remoteValue,
          conflict.recommendedStrategy
        );

        await this.supabase
          .from('devices')
          .update({ [conflict.fieldName]: resolvedValue })
          .eq('id', deviceId);

        autoResolved++;
      }
    }

    return { autoResolved, manualReview };
  }

  /**
   * Check if two values conflict (not strictly equal)
   */
  private valuesConflict(localValue: any, remoteValue: any): boolean {
    // Handle null/undefined
    if (localValue == null && remoteValue == null) return false;
    if (localValue == null || remoteValue == null) return true;

    // Deep comparison for objects/arrays
    return JSON.stringify(localValue) !== JSON.stringify(remoteValue);
  }

  /**
   * Apply merge strategy to resolve conflict
   */
  private applyStrategy(
    localValue: any,
    remoteValue: any,
    strategy: MergeStrategy
  ): any {
    switch (strategy) {
      case 'prefer_local':
        return localValue;
      
      case 'prefer_remote':
        return remoteValue;
      
      case 'merge':
        // Array union (for tags, etc.)
        if (Array.isArray(localValue) && Array.isArray(remoteValue)) {
          return [...new Set([...localValue, ...remoteValue])];
        }
        // Object merge
        if (typeof localValue === 'object' && typeof remoteValue === 'object') {
          return { ...localValue, ...remoteValue };
        }
        // Default to remote if can't merge
        return remoteValue;
      
      default:
        return remoteValue;
    }
  }

  /**
   * Get unresolved conflicts for a device
   */
  async getUnresolvedConflicts(deviceId: string) {
    const { data, error } = await this.supabase
      .from('sync_conflicts')
      .select('*')
      .eq('device_id', deviceId)
      .is('resolved_at', null)
      .order('conflict_detected_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Manually resolve a conflict
   */
  async manuallyResolveConflict(
    conflictId: string,
    resolution: 'use_local' | 'use_remote' | 'custom',
    customValue?: any,
    userId?: string,
    notes?: string
  ): Promise<void> {
    // Get conflict details
    const { data: conflict } = await this.supabase
      .from('sync_conflicts')
      .select('*')
      .eq('id', conflictId)
      .single();

    if (!conflict) throw new Error('Conflict not found');

    // Determine final value
    let finalValue;
    if (resolution === 'use_local') {
      finalValue = conflict.local_value;
    } else if (resolution === 'use_remote') {
      finalValue = conflict.remote_value;
    } else {
      finalValue = customValue;
    }

    // Apply resolution
    await this.supabase
      .from('devices')
      .update({ [conflict.field_name]: finalValue })
      .eq('id', conflict.device_id);

    // Mark as resolved
    await this.supabase
      .from('sync_conflicts')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_notes: notes
      })
      .eq('id', conflictId);
  }
}
