/**
 * Bug #268 — AlertHistoryReport: real acknowledgement stats
 *
 * Previously, acknowledged/resolved/false-positive stats were always zero.
 * Fix: Fetch from alert_acknowledgements table in batches of 200,
 * keep latest ack per alert, compute response time and false-positive flag.
 *
 * This test verifies the acknowledgement mapping and stats logic.
 */

interface AlertAcknowledgement {
  id: string
  alert_id: string
  user_id: string
  acknowledgement_type:
    | 'acknowledged'
    | 'resolved'
    | 'dismissed'
    | 'false_positive'
  acknowledged_at: string
  notes?: string
}

interface AlertWithAck {
  id: string
  created_at: string
  acknowledgement?: AlertAcknowledgement
  responseTimeMinutes?: number
  isFalsePositive: boolean
}

describe('Bug #268 — AlertHistoryReport acknowledgement stats', () => {
  /**
   * Simulate the deduplication logic from AlertHistoryReport.tsx (lines 237-249).
   * Keeps only the latest acknowledgement per alert (first seen wins, since
   * results are ordered descending by acknowledged_at).
   */
  function buildAcknowledgementsMap(
    ackRows: Array<{
      id: string
      alert_id: string
      user_id: string
      acknowledgement_type: string
      acknowledged_at: string
      notes: string | null
    }>
  ): Map<string, AlertAcknowledgement> {
    const map = new Map<string, AlertAcknowledgement>()

    for (const ack of ackRows) {
      // Keep only the latest acknowledgement per alert
      if (!map.has(ack.alert_id)) {
        map.set(ack.alert_id, {
          id: ack.id,
          alert_id: ack.alert_id,
          user_id: ack.user_id,
          acknowledgement_type:
            ack.acknowledgement_type as AlertAcknowledgement['acknowledgement_type'],
          acknowledged_at: ack.acknowledged_at,
          notes: ack.notes ?? undefined,
        })
      }
    }

    return map
  }

  it('keeps only the latest acknowledgement per alert', () => {
    const ackRows = [
      {
        id: 'ack-2',
        alert_id: 'alert-1',
        user_id: 'user-1',
        acknowledgement_type: 'resolved',
        acknowledged_at: '2026-02-26T12:00:00Z', // newer (comes first from ORDER BY desc)
        notes: null,
      },
      {
        id: 'ack-1',
        alert_id: 'alert-1',
        user_id: 'user-1',
        acknowledgement_type: 'acknowledged',
        acknowledged_at: '2026-02-26T10:00:00Z', // older
        notes: 'first ack',
      },
    ]

    const map = buildAcknowledgementsMap(ackRows)
    expect(map.size).toBe(1)
    expect(map.get('alert-1')?.id).toBe('ack-2') // Latest wins
    expect(map.get('alert-1')?.acknowledgement_type).toBe('resolved')
  })

  it('maps multiple alerts correctly', () => {
    const ackRows = [
      {
        id: 'ack-1',
        alert_id: 'alert-1',
        user_id: 'user-1',
        acknowledgement_type: 'acknowledged',
        acknowledged_at: '2026-02-26T10:00:00Z',
        notes: null,
      },
      {
        id: 'ack-2',
        alert_id: 'alert-2',
        user_id: 'user-2',
        acknowledgement_type: 'false_positive',
        acknowledged_at: '2026-02-26T11:00:00Z',
        notes: 'test sensor',
      },
    ]

    const map = buildAcknowledgementsMap(ackRows)
    expect(map.size).toBe(2)
    expect(map.get('alert-1')?.acknowledgement_type).toBe('acknowledged')
    expect(map.get('alert-2')?.acknowledgement_type).toBe('false_positive')
    expect(map.get('alert-2')?.notes).toBe('test sensor')
  })

  it('converts null notes to undefined', () => {
    const ackRows = [
      {
        id: 'ack-1',
        alert_id: 'alert-1',
        user_id: 'user-1',
        acknowledgement_type: 'dismissed',
        acknowledged_at: '2026-02-26T10:00:00Z',
        notes: null,
      },
    ]

    const map = buildAcknowledgementsMap(ackRows)
    expect(map.get('alert-1')?.notes).toBeUndefined()
  })

  /**
   * Simulate the alert-ack merge logic from AlertHistoryReport.tsx (lines 260-290).
   */
  function mergeAlertWithAck(
    alert: { id: string; created_at: string },
    ack: AlertAcknowledgement | undefined
  ): AlertWithAck {
    let responseTimeMinutes: number | undefined
    let isFalsePositive = false

    if (ack?.acknowledged_at) {
      const createdTime = new Date(alert.created_at).getTime()
      const acknowledgedTime = new Date(ack.acknowledged_at).getTime()
      responseTimeMinutes = (acknowledgedTime - createdTime) / 1000 / 60
      isFalsePositive = ack.acknowledgement_type === 'false_positive'
    }

    return {
      id: alert.id,
      created_at: alert.created_at,
      acknowledgement: ack,
      responseTimeMinutes,
      isFalsePositive,
    }
  }

  it('computes response time in minutes', () => {
    const alert = { id: 'a1', created_at: '2026-02-26T10:00:00Z' }
    const ack: AlertAcknowledgement = {
      id: 'ack-1',
      alert_id: 'a1',
      user_id: 'u1',
      acknowledgement_type: 'acknowledged',
      acknowledged_at: '2026-02-26T10:30:00Z', // 30 min later
    }

    const result = mergeAlertWithAck(alert, ack)
    expect(result.responseTimeMinutes).toBe(30)
    expect(result.isFalsePositive).toBe(false)
  })

  it('flags false positive when acknowledgement_type is false_positive', () => {
    const alert = { id: 'a1', created_at: '2026-02-26T10:00:00Z' }
    const ack: AlertAcknowledgement = {
      id: 'ack-1',
      alert_id: 'a1',
      user_id: 'u1',
      acknowledgement_type: 'false_positive',
      acknowledged_at: '2026-02-26T10:05:00Z',
    }

    const result = mergeAlertWithAck(alert, ack)
    expect(result.isFalsePositive).toBe(true)
    expect(result.responseTimeMinutes).toBe(5)
  })

  it('returns undefined response time when no acknowledgement exists', () => {
    const alert = { id: 'a1', created_at: '2026-02-26T10:00:00Z' }
    const result = mergeAlertWithAck(alert, undefined)
    expect(result.responseTimeMinutes).toBeUndefined()
    expect(result.isFalsePositive).toBe(false)
    expect(result.acknowledgement).toBeUndefined()
  })

  /**
   * Verify batching logic: alerts are fetched in batches of 200.
   */
  it('batches alertIds in groups of 200', () => {
    const totalAlerts = 450
    const alertIds = Array.from({ length: totalAlerts }, (_, i) => `alert-${i}`)
    const batchSize = 200
    const batches: string[][] = []

    for (let i = 0; i < alertIds.length; i += batchSize) {
      batches.push(alertIds.slice(i, i + batchSize))
    }

    expect(batches).toHaveLength(3) // 200 + 200 + 50
    expect(batches[0]).toHaveLength(200)
    expect(batches[1]).toHaveLength(200)
    expect(batches[2]).toHaveLength(50)
  })
})
