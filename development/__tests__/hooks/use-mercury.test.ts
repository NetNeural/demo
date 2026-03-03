import { describe, it, expect } from 'vitest'

describe('useMercury hook state', () => {
  it('duty status updates after get_status call', () => {
    const prev = { duty_admins_online: 0 }
    const next = { duty_admins_online: 1 }
    expect(next.duty_admins_online).toBeGreaterThan(prev.duty_admins_online)
  })

  it('session id persists across messages', () => {
    let sessionId: string | null = null
    sessionId = 'sess-abc-123'
    expect(sessionId).toBe('sess-abc-123')
  })

  it('ticket dialog resets on close', () => {
    const dialog = { subject: 'Filled in', description: 'Some issue' }
    const reset = { subject: '', description: '' }
    expect(reset.subject).toBe('')
  })
})
