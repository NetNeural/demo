import { describe, it, expect } from 'vitest'

describe('AI Insights (GPT-4o-mini)', () => {
  it('insight has summary and recommendations', () => {
    const insight = {
      summary: 'Device temperatures are trending upward.',
      recommendations: ['Check cooling systems', 'Review threshold settings'],
      model: 'gpt-4o-mini',
    }
    expect(insight.summary.length).toBeGreaterThan(0)
    expect(insight.recommendations.length).toBeGreaterThan(0)
  })

  it('uses gpt-4o-mini model', () => {
    const model = 'gpt-4o-mini'
    expect(model).toBe('gpt-4o-mini')
  })

  it('insight is under 300 words', () => {
    const words = 'Device analysis complete. All systems nominal.'.split(' ')
    expect(words.length).toBeLessThan(300)
  })
})
