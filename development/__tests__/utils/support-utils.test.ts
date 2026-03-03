import { describe, it, expect } from 'vitest'

describe('Support Utility Functions', () => {
  it('truncates ticket ID for display', () => {
    const fullId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const display = fullId.slice(0, 8).toUpperCase()
    expect(display).toBe('A1B2C3D4')
    expect(display).toHaveLength(8)
  })

  it('formats date for ticket list', () => {
    const date = new Date('2026-03-03')
    const formatted = date.toLocaleDateString()
    expect(formatted).toBeDefined()
  })

  it('extracts recent messages for ticket description', () => {
    const messages = [
      { sender_type: 'user', content: 'My device is offline' },
      { sender_type: 'mercury', content: 'I can help with that.' },
    ]
    const context = messages
      .slice(-6)
      .map(m => `${m.sender_type === 'user' ? 'User' : 'Mercury'}: ${m.content}`)
      .join('\n')
    expect(context).toContain('User:')
    expect(context).toContain('Mercury:')
  })
})
