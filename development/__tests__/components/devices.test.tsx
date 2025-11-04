/**
 * Device Components Tests
 */

describe('Device Components', () => {
  test('DevicesHeader component exists', async () => {
    const module1 = await import('@/components/devices/DevicesHeader')
    expect(module1.DevicesHeader).toBeDefined()
  })

  test('DevicesList component exists', async () => {
    const module2 = await import('@/components/devices/DevicesList')
    expect(module2.DevicesList).toBeDefined()
  })
})
