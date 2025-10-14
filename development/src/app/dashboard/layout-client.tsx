'use client'

import { createClient } from '@/lib/supabase/client'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  userEmail: string
}

export default function DashboardLayoutClient({ children, userEmail }: DashboardLayoutClientProps) {
  const handleLogout = async () => {
    try {
      const supabase = createClient()
      
      // Sign out the user
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error('Logout error:', error)
      }
      
      // Force redirect to login page
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Logout error:', error)
      // Force redirect even if there's an error
      window.location.href = '/auth/login'
    }
  }

  return (
    <div className="dashboard-container">
      <nav className="nav-sidebar">
        <div className="nav-header">
          <h1 className="nav-brand">NetNeural IoT</h1>
        </div>
        <div className="nav-menu">
          <a href="/dashboard" className="nav-item">
            <span className="nav-icon">📊</span>
            Dashboard
          </a>
          <a href="/dashboard/devices" className="nav-item">
            <span className="nav-icon">📱</span>
            Devices
          </a>
          <a href="/dashboard/alerts" className="nav-item">
            <span className="nav-icon">🚨</span>
            Alerts
          </a>
          <a href="/dashboard/analytics" className="nav-item">
            <span className="nav-icon">📈</span>
            Analytics
          </a>
        </div>
        <div className="nav-user">
          <div className="user-info">
            <p className="text-sm font-medium text-gray-900">
              {userEmail}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            type="button"
          >
            Sign out
          </button>
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}