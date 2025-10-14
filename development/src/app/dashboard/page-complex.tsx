'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DashboardStats {
  totalDevices: number
  activeDevices: number
  totalAlerts: number
  organizations: number
}

export default function DashboardPage() {
  const [user, setUser] = useState<{ email?: string } | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalDevices: 0,
    activeDevices: 0,
    totalAlerts: 0,
    organizations: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      try {
        console.log('Dashboard: Starting auth check...')
        const supabase = createClient()
        
        // Get the current user
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
        
        console.log('Dashboard: Auth result:', { authUser: !!authUser, authError })
        
        if (authError || !authUser) {
          console.log('Dashboard: No user found, redirecting to login')
          window.location.href = '/auth/login'
          return
        }
        
        console.log('Dashboard: User authenticated:', authUser.email)
        setUser(authUser)
        
        // Fetch dashboard stats
        console.log('Dashboard: Fetching stats...')
        await fetchDashboardStats()
        console.log('Dashboard: Stats fetch completed')
      } catch (err) {
        console.error('Error checking user:', err)
        setError('Authentication error')
        setLoading(false)
      }
    }

    checkUserAndFetchData()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Try to fetch device stats, but don't fail if table doesn't exist
      let totalDevices = 0
      let activeDevices = 0
      
      try {
        const { data: devices, error: devicesError } = await supabase
          .from('devices')
          .select('status')

        if (!devicesError && devices) {
          totalDevices = devices.length || 0
          activeDevices = devices.filter(d => d.status === 'online')?.length || 0
        }
      } catch (err) {
        console.log('Devices table not accessible, using defaults:', err)
      }

      // Try to fetch alerts count
      let alertsCount = 0
      try {
        const { count, error: alertsError } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })

        if (!alertsError) {
          alertsCount = count || 0
        }
      } catch (err) {
        console.log('Alerts table not accessible, using defaults:', err)
      }

      // Try to fetch organizations count
      let orgsCount = 0
      try {
        const { count, error: orgsError } = await supabase
          .from('organizations')
          .select('*', { count: 'exact', head: true })

        if (!orgsError) {
          orgsCount = count || 0
        }
      } catch (err) {
        console.log('Organizations table not accessible, using defaults:', err)
      }

      setStats({
        totalDevices,
        activeDevices,
        totalAlerts: alertsCount,
        organizations: orgsCount,
      })
    } catch (err: unknown) {
      console.error('Error fetching dashboard stats:', err)
      setError('Some dashboard data may not be available')
      // Set default stats so the dashboard still shows
      setStats({
        totalDevices: 0,
        activeDevices: 0,
        totalAlerts: 0,
        organizations: 1, // At least show that there's 1 org (the user's)
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="text-center">
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="dashboard-loading">
        <div className="text-center">
          <p>Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user.email}
        </h1>
        <p className="text-gray-600">
          Here&apos;s what&apos;s happening with your IoT infrastructure today.
        </p>
      </div>

      {error && (
        <div className="alert alert-error mb-6">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="card">
          <div className="card-content">
            <div className="stat-item">
              <div className="stat-icon">📱</div>
              <div className="stat-content">
                <p className="stat-label">Total Devices</p>
                <p className="stat-value">
                  {loading ? '...' : stats.totalDevices}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="stat-item">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <p className="stat-label">Active Devices</p>
                <p className="stat-value">
                  {loading ? '...' : stats.activeDevices}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="stat-item">
              <div className="stat-icon">🚨</div>
              <div className="stat-content">
                <p className="stat-label">Total Alerts</p>
                <p className="stat-value">
                  {loading ? '...' : stats.totalAlerts}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="stat-item">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <p className="stat-label">Organizations</p>
                <p className="stat-value">
                  {loading ? '...' : stats.organizations}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="actions-grid">
          <div className="card">
            <div className="card-content">
              <div className="action-item">
                <div className="action-icon">🔗</div>
                <div className="action-content">
                  <h3 className="font-semibold">Add Integration</h3>
                  <p className="text-sm text-gray-600">
                    Connect a new IoT platform
                  </p>
                  <button className="btn btn-primary btn-sm mt-2">
                    Add Integration
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="action-item">
                <div className="action-icon">📊</div>
                <div className="action-content">
                  <h3 className="font-semibold">View Analytics</h3>
                  <p className="text-sm text-gray-600">
                    Check performance metrics
                  </p>
                  <button className="btn btn-secondary btn-sm mt-2">
                    View Analytics
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="action-item">
                <div className="action-icon">⚙️</div>
                <div className="action-content">
                  <h3 className="font-semibold">System Settings</h3>
                  <p className="text-sm text-gray-600">
                    Configure your platform
                  </p>
                  <button className="btn btn-secondary btn-sm mt-2">
                    Open Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: var(--space-8);
        }

        .dashboard-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: var(--space-6);
          margin-bottom: var(--space-8);
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .stat-icon {
          font-size: var(--text-3xl);
          line-height: 1;
        }

        .stat-label {
          font-size: var(--text-sm);
          color: var(--gray-600);
          margin-bottom: var(--space-1);
        }

        .stat-value {
          font-size: var(--text-2xl);
          font-weight: 600;
          color: var(--gray-900);
        }

        .quick-actions {
          margin-bottom: var(--space-8);
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: var(--space-6);
        }

        .action-item {
          display: flex;
          align-items: flex-start;
          gap: var(--space-4);
        }

        .action-icon {
          font-size: var(--text-2xl);
          line-height: 1;
        }

        .action-content {
          flex: 1;
        }
      `}</style>
    </div>
  )
}