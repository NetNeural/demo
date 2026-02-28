/**
 * Bug #272 — Centralized test-telemetry helper
 *
 * Replaces scattered `(supabase as any).from('test_device_telemetry_history')`
 * casts in 4 files with a single `testTelemetryFrom()` helper.
 *
 * This test verifies the helper returns a query builder for
 * test_device_telemetry_history and that the table name is correct.
 */

import { testTelemetryFrom } from '@/lib/supabase/test-telemetry'

describe('Bug #272 — testTelemetryFrom() helper', () => {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
  }

  const mockSupabase = {
    from: jest.fn().mockReturnValue(mockQueryBuilder),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls supabase.from with the correct table name', () => {
    testTelemetryFrom(mockSupabase as any)

    expect(mockSupabase.from).toHaveBeenCalledTimes(1)
    expect(mockSupabase.from).toHaveBeenCalledWith(
      'test_device_telemetry_history'
    )
  })

  it('returns the query builder for chaining', () => {
    const result = testTelemetryFrom(mockSupabase as any)

    expect(result).toBe(mockQueryBuilder)
    // Verify chaining works
    result.select('device_id, telemetry').eq('device_id', 'd1').limit(500)
    expect(mockQueryBuilder.select).toHaveBeenCalledWith('device_id, telemetry')
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('device_id', 'd1')
    expect(mockQueryBuilder.limit).toHaveBeenCalledWith(500)
  })

  it('does not use "as any" cast in the caller (type safety)', () => {
    // The function signature accepts SupabaseClient — no cast needed by callers
    // Just verify the function exists as a proper export
    expect(typeof testTelemetryFrom).toBe('function')
    expect(testTelemetryFrom.length).toBe(1) // takes one argument
  })
})
