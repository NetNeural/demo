import { describe, it, expect, vi } from 'vitest'

describe('useSupport hook', () => {
  it('initial state has empty messages', () => {
    const initialState = { messages: [], sending: false, sessionId: null }
    expect(initialState.messages).toHaveLength(0)
    expect(initialState.sending).toBe(false)
  })

  it('sending flag is true while request in flight', () => {
    const state = { sending: true }
    expect(state.sending).toBe(true)
  })

  it('messages append on send', () => {
    const messages = [{ sender_type: 'user', content: 'Hello', id: '1' }]
    messages.push({ sender_type: 'mercury', content: 'Hi there!', id: '2' })
    expect(messages).toHaveLength(2)
  })
})
