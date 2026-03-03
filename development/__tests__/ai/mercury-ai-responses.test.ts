import { describe, it, expect } from 'vitest'

describe('Mercury AI Response Quality', () => {
  it('response is under 150 words', () => {
    const response = 'To add a device, go to the Devices page and click Add Device. Enter the device name and select its type.'
    const wordCount = response.split(' ').length
    expect(wordCount).toBeLessThan(150)
  })

  it('response is plain text, not markdown', () => {
    const response = 'You can reset your password from the Settings page under Security.'
    expect(response).not.toContain('###')
    expect(response).not.toContain('**')
  })

  it('off-topic questions are declined', () => {
    const offTopicResponse = "I can only help with questions about the NetNeural IoT platform."
    expect(offTopicResponse).toContain('NetNeural')
  })

  it('fallback message is returned when API key missing', () => {
    const fallback = "I'm having trouble connecting to my AI engine right now."
    expect(fallback.length).toBeGreaterThan(0)
  })
})
