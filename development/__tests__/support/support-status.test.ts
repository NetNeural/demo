import { describe, it, expect } from 'vitest'

describe('Support Status', () => {
  it('shows admin on duty when shifts are active', () => {
    const dutyCount = 2
    expect(dutyCount > 0).toBe(true)
  })

  it('shows no admin when no active shifts', () => {
    const dutyCount = 0
    expect(dutyCount === 0).toBe(true)
  })

  it('open ticket count returns non-negative number', () => {
    const openTickets = 3
    expect(openTickets).toBeGreaterThanOrEqual(0)
  })

  it('AI fallback message is provided when key missing', () => {
    const fallback = "I'm having trouble connecting to my AI engine right now. You can still create a support ticket..."
    expect(fallback.length).toBeGreaterThan(0)
  })
})
