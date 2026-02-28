/**
 * Feature Flags Configuration
 * ===========================
 * Centralized feature flag management for gradual rollouts
 *
 * Date: 2025-11-09
 */

export const FEATURE_FLAGS = {
  /**
   * Use generic sync orchestrator instead of Golioth-specific sync
   * Set to 'true' to enable multi-provider sync architecture
   */
  USE_GENERIC_SYNC: process.env.NEXT_PUBLIC_USE_GENERIC_SYNC === 'true',

  /**
   * Enable unified device status API
   */
  USE_UNIFIED_STATUS_API:
    process.env.NEXT_PUBLIC_USE_UNIFIED_STATUS_API === 'true',

  /**
   * Enable debug logging for sync operations
   */
  DEBUG_SYNC: process.env.NEXT_PUBLIC_DEBUG_SYNC === 'true',
} as const

/**
 * Get all feature flags with their current values
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  return {
    USE_GENERIC_SYNC: FEATURE_FLAGS.USE_GENERIC_SYNC,
    USE_UNIFIED_STATUS_API: FEATURE_FLAGS.USE_UNIFIED_STATUS_API,
    DEBUG_SYNC: FEATURE_FLAGS.DEBUG_SYNC,
  }
}
