'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserProvider, useUser } from '@/contexts/UserContext'
import { OrganizationProvider, useOrganization } from '@/contexts/OrganizationContext'
import { OrganizationSwitcherCompact } from '@/components/organizations/OrganizationSwitcher'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const { currentOrganization } = useOrganization()
  const supabase = createClient()

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!user) {
    return <div className="p-6">Redirecting to login...</div>
  }

  return (
    <div className="dashboard-container">
      <nav className="nav-sidebar">
        <div className="nav-header">
          <h1 className="nav-brand">{currentOrganization?.name || 'NetNeural'} IoT Platform</h1>
        </div>
        
        {/* Organization Switcher */}
        <div className="px-4 py-3 border-b border-gray-200">
          <OrganizationSwitcherCompact />
        </div>
        
        <div className="nav-menu">
          <Link href="/dashboard" className="nav-item">
            <span className="nav-icon">📊</span>
            Dashboard
          </Link>
          <Link href="/dashboard/devices" className="nav-item">
            <span className="nav-icon">📱</span>
            Devices
          </Link>
          <Link href="/dashboard/alerts" className="nav-item">
            <span className="nav-icon">🚨</span>
            Alerts
          </Link>
          <Link href="/dashboard/analytics" className="nav-item">
            <span className="nav-icon">📈</span>
            Analytics
          </Link>
          <a href="/dashboard/organizations" className="nav-item">
            <span className="nav-icon">🏢</span>
            Organization
          </a>
          <a href="/dashboard/settings" className="nav-item">
            <span className="nav-icon">⚙️</span>
            Personal Settings
          </a>
        </div>
        <div className="nav-user">
          <div className="user-info">
            <p className="text-sm font-medium text-gray-900">
              {user.email}
            </p>
            {user.isSuperAdmin ? (
              <p className="text-xs font-semibold text-red-600">
                🛡️ Super Admin
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                {user.organizationName}
              </p>
            )}
          </div>
          <button 
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/'
            }}
            className="btn btn-ghost btn-sm"
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <UserProvider>
      <OrganizationProvider>
        <DashboardContent>{children}</DashboardContent>
      </OrganizationProvider>
    </UserProvider>
  )
}