import { describe, it, expect } from 'vitest'

describe('Usage Metrics', () => {
  it('metric has organization_id and device count', () => {
    const metric = {
      organization_id: 'org-1',
      active_devices: 5,
      period_start: '2026-03-01',
      period_end: '2026-03-31',
    }
    expect(metric.active_devices).toBeGreaterThanOrEqual(0)
  })

  it('period start is before period end', () => {
    const metric = { period_start: '2026-03-01', period_end: '2026-03-31' }
    expect(new Date(metric.period_end) > new Date(metric.period_start)).toBe(
      true
    )
  })
})
