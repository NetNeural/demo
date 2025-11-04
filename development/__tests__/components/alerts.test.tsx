/**
 * Alert Components Tests
 */

describe('Alert Components', () => {
  test('AlertsHeader component exists', async () => {
    const module1 = await import('@/components/alerts/AlertsHeader')
    expect(module1.AlertsHeader).toBeDefined()
  })

  test('AlertsList component exists', async () => {
    const module2 = await import('@/components/alerts/AlertsList')
    expect(module2.AlertsList).toBeDefined()
  })
})
