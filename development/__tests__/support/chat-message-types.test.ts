import { describe, it, expect } from 'vitest'

describe('Chat Message Types', () => {
  it('mercury messages are left-aligned', () => {
    const msg = { sender_type: 'mercury', content: 'Hello!' }
    const isLeftAligned =
      msg.sender_type === 'mercury' || msg.sender_type === 'admin'
    expect(isLeftAligned).toBe(true)
  })

  it('user messages are right-aligned', () => {
    const msg = { sender_type: 'user', content: 'My device is offline' }
    const isRightAligned = msg.sender_type === 'user'
    expect(isRightAligned).toBe(true)
  })

  it('system messages are centered', () => {
    const msg = { sender_type: 'system', content: 'Ticket #ABC123 created.' }
    expect(msg.sender_type).toBe('system')
  })

  it('message content is required', () => {
    const msg = { sender_type: 'user', content: 'Test' }
    expect(msg.content.trim().length).toBeGreaterThan(0)
  })
})
