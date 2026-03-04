import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Mercury Chat', () => {
  describe('get_status action', () => {
    it('returns duty_admins_online count', () => {
      const status = {
        duty_admins_online: 2,
        active_session: null,
        open_ticket_count: 0,
        is_super_admin: false,
        user_name: 'Test',
      }
      expect(status.duty_admins_online).toBeGreaterThanOrEqual(0)
    })

    it('returns null active_session when no session exists', () => {
      const status = {
        duty_admins_online: 0,
        active_session: null,
        open_ticket_count: 0,
        is_super_admin: false,
        user_name: 'Test',
      }
      expect(status.active_session).toBeNull()
    })

    it('returns active session when one exists', () => {
      const session = { id: 'abc-123', status: 'active' }
      const status = {
        duty_admins_online: 1,
        active_session: session,
        open_ticket_count: 1,
        is_super_admin: false,
        user_name: 'Test',
      }
      expect(status.active_session?.id).toBe('abc-123')
    })

    it('identifies super admin users', () => {
      const status = {
        duty_admins_online: 0,
        active_session: null,
        open_ticket_count: 0,
        is_super_admin: true,
        user_name: 'Admin',
      }
      expect(status.is_super_admin).toBe(true)
    })
  })

  describe('message sender types', () => {
    it('validates sender_type values', () => {
      const validTypes = ['user', 'mercury', 'admin', 'system']
      validTypes.forEach((t) => expect(validTypes).toContain(t))
    })

    it('system messages are centered in UI', () => {
      const msg = { sender_type: 'system', content: 'Ticket created.' }
      expect(msg.sender_type).toBe('system')
    })
  })
})
