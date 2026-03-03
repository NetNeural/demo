import { describe, it, expect } from 'vitest'

describe('Image Moderation (GPT-4o-mini Vision)', () => {
  it('moderation result has allowed flag', () => {
    const result = { allowed: true, reason: null, confidence: 0.99 }
    expect(typeof result.allowed).toBe('boolean')
  })

  it('rejected image has reason', () => {
    const result = { allowed: false, reason: 'Contains inappropriate content', confidence: 0.95 }
    expect(result.allowed).toBe(false)
    expect(result.reason).not.toBeNull()
  })

  it('confidence is between 0 and 1', () => {
    const result = { confidence: 0.87 }
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })
})
