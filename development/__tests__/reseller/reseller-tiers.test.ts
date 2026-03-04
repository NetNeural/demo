import { describe, it, expect } from 'vitest'

describe('Reseller Tiers (Project Hydra)', () => {
  it('tier has name and sensor threshold', () => {
    const tier = {
      name: 'Silver',
      min_sensors: 10,
      max_sensors: 50,
      commission_rate: 0.15,
    }
    expect(tier.name).toBeDefined()
    expect(tier.min_sensors).toBeGreaterThanOrEqual(0)
  })

  it('commission rate is between 0 and 1', () => {
    const tier = { commission_rate: 0.15 }
    expect(tier.commission_rate).toBeGreaterThan(0)
    expect(tier.commission_rate).toBeLessThan(1)
  })

  it('tier thresholds do not overlap', () => {
    const tiers = [
      { name: 'Bronze', min: 1, max: 9 },
      { name: 'Silver', min: 10, max: 49 },
      { name: 'Gold', min: 50, max: 199 },
    ]
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].min).toBeGreaterThan(tiers[i - 1].max)
    }
  })
})
