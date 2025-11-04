/**
 * Hooks Tests
 */

describe('Custom Hooks', () => {
  test('use-toast hook exists', async () => {
    const module1 = await import('@/hooks/use-toast')
    expect(module1.useToast).toBeDefined()
    expect(module1.toast).toBeDefined()
  })
})
