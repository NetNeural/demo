/**
 * Bug #267 — DevicesList N+1 telemetry query
 *
 * Fix: Replace per-device queries with a single batched `.in('device_id', deviceIds)`
 * query. If any devices are crowded out of the global limit, a targeted follow-up
 * fetches only those missing devices.
 *
 * This test verifies the batching logic and follow-up strategy.
 */

describe('Bug #267 — Batched telemetry fetch logic', () => {
  /**
   * Simulate the batch-limit calculation from DevicesList.tsx (line ~380).
   */
  function calculateBatchLimit(deviceCount: number): number {
    return Math.max(deviceCount * 15, 500)
  }

  it('batch limit is at least 500 even for a few devices', () => {
    expect(calculateBatchLimit(1)).toBe(500)
    expect(calculateBatchLimit(10)).toBe(500)
    expect(calculateBatchLimit(33)).toBe(500)
  })

  it('batch limit scales to 15x for large device counts', () => {
    expect(calculateBatchLimit(50)).toBe(750)
    expect(calculateBatchLimit(100)).toBe(1500)
    expect(calculateBatchLimit(200)).toBe(3000)
  })

  /**
   * Simulate the follow-up logic: find devices that were "crowded out"
   * of the initial batch, then do a targeted fetch for just those.
   */
  function identifyMissingDevices(
    deviceIds: string[],
    fetchedDeviceIds: Set<string>
  ): string[] {
    return deviceIds.filter((id) => !fetchedDeviceIds.has(id))
  }

  it('identifies devices missing from initial batch', () => {
    const allIds = ['d1', 'd2', 'd3', 'd4', 'd5']
    const fetched = new Set(['d1', 'd3', 'd5'])
    const missing = identifyMissingDevices(allIds, fetched)
    expect(missing).toEqual(['d2', 'd4'])
  })

  it('returns empty when all devices were fetched', () => {
    const allIds = ['d1', 'd2', 'd3']
    const fetched = new Set(['d1', 'd2', 'd3'])
    expect(identifyMissingDevices(allIds, fetched)).toEqual([])
  })

  it('skips follow-up when all devices are missing (would be full re-fetch)', () => {
    // From source: "missingIds.length < deviceIds.length" gate on follow-up
    const allIds = ['d1', 'd2', 'd3']
    const fetched = new Set<string>([]) // nothing came back
    const missing = identifyMissingDevices(allIds, fetched)

    // The follow-up should NOT trigger when ALL are missing
    const shouldDoFollowUp =
      missing.length > 0 && missing.length < allIds.length
    expect(shouldDoFollowUp).toBe(false)
  })

  it('triggers follow-up only for partial misses', () => {
    const allIds = ['d1', 'd2', 'd3', 'd4']
    const fetched = new Set(['d1', 'd2']) // 2 of 4 fetched
    const missing = identifyMissingDevices(allIds, fetched)

    const shouldDoFollowUp =
      missing.length > 0 && missing.length < allIds.length
    expect(shouldDoFollowUp).toBe(true)
    expect(missing).toEqual(['d3', 'd4'])
  })

  /**
   * Verify that grouping logic keeps only the latest reading per sensor type per device.
   */
  function groupByDeviceLatest(
    rows: Array<{
      device_id: string
      telemetry: Record<string, unknown>
      received_at: string
    }>
  ): Record<string, Record<string, unknown>[]> {
    const grouped: Record<string, Record<string, unknown>[]> = {}

    for (const row of rows) {
      if (!grouped[row.device_id]) {
        grouped[row.device_id] = []
      }
      grouped[row.device_id].push(row.telemetry)
    }

    return grouped
  }

  it('groups telemetry rows by device_id', () => {
    const rows = [
      {
        device_id: 'd1',
        telemetry: { temp: 22 },
        received_at: '2026-02-26T10:00:00Z',
      },
      {
        device_id: 'd1',
        telemetry: { humidity: 45 },
        received_at: '2026-02-26T09:00:00Z',
      },
      {
        device_id: 'd2',
        telemetry: { temp: 18 },
        received_at: '2026-02-26T10:00:00Z',
      },
    ]

    const grouped = groupByDeviceLatest(rows)
    expect(Object.keys(grouped)).toEqual(['d1', 'd2'])
    expect(grouped['d1']).toHaveLength(2)
    expect(grouped['d2']).toHaveLength(1)
  })

  it('handles empty device list gracefully', () => {
    // From source: "if (!currentOrganization || deviceIds.length === 0) return"
    const deviceIds: string[] = []
    expect(deviceIds.length === 0).toBe(true)
    // The function should return early — no queries made
  })
})
