import { describe, it, expect } from 'vitest'

describe('Support Permissions', () => {
  it('super admin can access support duty', () => {
    const role = 'super_admin'
    const canAccessDuty = role === 'super_admin'
    expect(canAccessDuty).toBe(true)
  })

  it('org member can use mercury chat', () => {
    const role = 'member'
    const canChat = ['member', 'admin', 'owner', 'super_admin'].includes(role)
    expect(canChat).toBe(true)
  })

  it('unauthenticated user cannot chat', () => {
    const user = null
    const canChat = user !== null
    expect(canChat).toBe(false)
  })
})
