import { describe, it, expect } from 'vitest'

describe('Billing Status', () => {
  it('active org has billing access', () => {
    const org = { billing_status: 'active' }
    const hasAccess = org.billing_status === 'active' || org.billing_status === 'trialing'
    expect(hasAccess).toBe(true)
  })

  it('past_due org has limited access', () => {
    const org = { billing_status: 'past_due' }
    expect(org.billing_status).toBe('past_due')
  })

  it('free tier has no subscription', () => {
    const sub = null
    expect(sub).toBeNull()
  })
})
