/**
 * Dashboard Components Tests
 */

describe('Dashboard Components', () => {
  test('DeviceStatusCard component exists', async () => {
    const module5 = await import('@/components/dashboard/DeviceStatusCard')
    expect(module5.DeviceStatusCard).toBeDefined()
  })

  test('LocationsCard component exists', async () => {
    const module6 = await import('@/components/dashboard/LocationsCard')
    expect(module6.LocationsCard).toBeDefined()
  })

  test('AlertsCard component exists', async () => {
    const module7 = await import('@/components/dashboard/AlertsCard')
    expect(module7.AlertsCard).toBeDefined()
  })

  test('RecentActivityCard component exists', async () => {
    const module8 = await import('@/components/dashboard/RecentActivityCard')
    expect(module8.RecentActivityCard).toBeDefined()
  })

  test('SystemStatsCard component exists', async () => {
    const module9 = await import('@/components/dashboard/SystemStatsCard')
    expect(module9.SystemStatsCard).toBeDefined()
  })

  test('DashboardShell component exists', async () => {
    const module10 = await import('@/components/dashboard/DashboardShell')
    expect(module10.default).toBeDefined()
  })

  test('DashboardOverview component exists', async () => {
    const module11 = await import('@/components/dashboard/DashboardOverview')
    expect(module11.DashboardOverview).toBeDefined()
  })
})
