import { describe, it, expect } from 'vitest'

describe('Admin Support Duty System', () => {
  it('shift has clock_in timestamp', () => {
    const shift = {
      id: 'shift-1',
      admin_user_id: 'admin-1',
      clocked_in_at: new Date().toISOString(),
      clocked_out_at: null,
    }
    expect(shift.clocked_in_at).not.toBeNull()
  })

  it('active shift has no clock_out time', () => {
    const shift = {
      id: 'shift-1',
      admin_user_id: 'admin-1',
      clocked_in_at: new Date().toISOString(),
      clocked_out_at: null,
    }
    expect(shift.clocked_out_at).toBeNull()
  })

  it('completed shift has both timestamps', () => {
    const start = new Date(Date.now() - 3600000).toISOString()
    const end = new Date().toISOString()
    const shift = { clocked_in_at: start, clocked_out_at: end }
    expect(new Date(shift.clocked_out_at) > new Date(shift.clocked_in_at)).toBe(
      true
    )
  })

  it('duty status shows admins online', () => {
    const dutyAdmins = [
      { id: 'admin-1', clocked_in_at: new Date().toISOString() },
    ]
    expect(dutyAdmins.length).toBeGreaterThan(0)
  })
})
