/**
 * Type-safe helper for querying test_device_telemetry_history.
 *
 * This table is intentionally omitted from the auto-generated Supabase types
 * (it's created by a migration but not exposed through `supabase gen types`).
 * Rather than scattering `(supabase as any).from(...)` casts throughout the
 * codebase, we centralise the single cast here.
 *
 * Bug #272 — removes all `(supabase as any).from('test_device_telemetry_history')` casts.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Returns a query builder for the test_device_telemetry_history table.
 *
 * Usage:
 * ```ts
 * const result = await testTelemetryFrom(supabase)
 *   .select('device_id, telemetry, device_timestamp, received_at')
 *   .eq('device_id', deviceId)
 *   .order('received_at', { ascending: false })
 *   .limit(500)
 * ```
 */
export function testTelemetryFrom(supabase: SupabaseClient) {
  // The table exists in the database but not in the auto-generated types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('test_device_telemetry_history')
}
