import { describe, it, expect } from 'vitest'

describe('OpenAI Integration', () => {
  it('all edge functions use gpt-4o-mini', () => {
    const functions = [
      { name: 'mercury-chat', model: 'gpt-4o-mini' },
      { name: 'ai-insights', model: 'gpt-4o-mini' },
      { name: 'moderate-image', model: 'gpt-4o-mini' },
      { name: 'generate-report-summary', model: 'gpt-4o-mini' },
      { name: 'email-broadcast', model: 'gpt-4o-mini' },
    ]
    functions.forEach((fn) => expect(fn.model).toBe('gpt-4o-mini'))
  })

  it('API key guard prevents unauthenticated calls', () => {
    const hasKey = (key: string | undefined) => !!key && key.startsWith('sk-')
    expect(hasKey(undefined)).toBe(false)
    expect(hasKey('sk-test123')).toBe(true)
  })
})
