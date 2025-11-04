/**
 * User Components Tests
 */

describe('User Components', () => {
  test('UsersHeader component exists', async () => {
    const module1 = await import('@/components/users/UsersHeader')
    expect(module1.UsersHeader).toBeDefined()
  })

  test('UsersList component exists', async () => {
    const module2 = await import('@/components/users/UsersList')
    expect(module2.UsersList).toBeDefined()
  })
})
