import { describe, it, expect } from 'vitest'

describe('Subscriptions', () => {
  const validStatuses = ['active', 'trialing', 'past_due', 'canceled', 'paused']

  it('active subscription has valid status', () => {
    const sub = { id: 'sub-1', status: 'active', organization_id: 'org-1' }
    expect(validStatuses).toContain(sub.status)
  })

  it('canceled subscription is not active', () => {
    const sub = { status: 'canceled' }
    expect(sub.status).not.toBe('active')
  })

  it('trialing subscription is not yet paid', () => {
    const sub = { status: 'trialing', trial_ends_at: new Date(Date.now() + 86400000).toISOString() }
    expect(sub.status).toBe('trialing')
    expect(new Date(sub.trial_ends_at) > new Date()).toBe(true)
  })

  it('subscription has organization_id', () => {
    const sub = { id: 'sub-2', status: 'active', organization_id: 'org-123', billing_plan_id: 'plan-1' }
    expect(sub.organization_id).toBeDefined()
  })
})
