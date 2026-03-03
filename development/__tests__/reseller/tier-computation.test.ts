import { describe, it, expect } from 'vitest'

describe('Tier Computation Engine', () => {
  function computeTier(sensorCount: number): string {
    if (sensorCount >= 200) return 'Platinum'
    if (sensorCount >= 50) return 'Gold'
    if (sensorCount >= 10) return 'Silver'
    return 'Bronze'
  }

  it('0 sensors = Bronze', () => expect(computeTier(0)).toBe('Bronze'))
  it('9 sensors = Bronze', () => expect(computeTier(9)).toBe('Bronze'))
  it('10 sensors = Silver', () => expect(computeTier(10)).toBe('Silver'))
  it('50 sensors = Gold', () => expect(computeTier(50)).toBe('Gold'))
  it('200 sensors = Platinum', () => expect(computeTier(200)).toBe('Platinum'))
  it('1000 sensors = Platinum', () => expect(computeTier(1000)).toBe('Platinum'))
})
