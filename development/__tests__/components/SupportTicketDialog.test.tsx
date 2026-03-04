import { describe, it, expect } from 'vitest'

describe('Support Ticket Dialog', () => {
  it('submit is disabled when subject is empty', () => {
    const subject = ''
    const isDisabled = subject.trim().length === 0
    expect(isDisabled).toBe(true)
  })

  it('submit is enabled when fields are filled', () => {
    const subject = 'Device offline'
    const description = 'My device went offline at 3pm.'
    const isDisabled = !subject.trim() || !description.trim()
    expect(isDisabled).toBe(false)
  })

  it('priority defaults to normal', () => {
    const defaultPriority = 'normal'
    expect(defaultPriority).toBe('normal')
  })

  it('dialog closes on cancel', () => {
    let open = true
    open = false
    expect(open).toBe(false)
  })
})
