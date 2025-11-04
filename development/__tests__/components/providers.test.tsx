/**
 * Provider Components Tests
 */

describe('Provider Components', () => {
  test('UserProvider from contexts module loads', async () => {
    const module1 = await import('@/contexts/UserContext')
    expect(module1.UserProvider).toBeDefined()
    expect(module1.useUser).toBeDefined()
  })

  test('OrganizationProvider from contexts module loads', async () => {
    const module2 = await import('@/contexts/OrganizationContext')
    expect(module2.OrganizationProvider).toBeDefined()
    expect(module2.useOrganization).toBeDefined()
  })

  test('ErrorBoundary module loads', async () => {
    const module3 = await import('@/components/ErrorBoundary')
    expect(module3.default).toBeDefined()
  })

  test('SentryUserTracker module loads', async () => {
    const module4 = await import('@/components/SentryUserTracker')
    expect(module4.SentryUserTracker).toBeDefined()
  })
})
