'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserProvider, useUser } from '@/contexts/UserContext'
import { OrganizationProvider, useOrganization } from '@/contexts/OrganizationContext'
import { OrganizationSwitcherCompact } from '@/components/organizations/OrganizationSwitcher'
import { ThemeBranding } from '@/components/branding/ThemeBranding'
import { usePageTitle } from '@/hooks/usePageTitle'
import { LayoutDashboard, Smartphone, Bell, BarChart3, Building2, Settings, FileText, Menu, X, MessageSquarePlus, LifeBuoy } from 'lucide-react'
import { canAccessSupport } from '@/lib/permissions'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const { currentOrganization } = useOrganization()
  const supabase = createClient()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Keep browser tab title in sync with current page + org
  usePageTitle()

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!user) {
    return <div className="p-6">Redirecting to login...</div>
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { href: '/dashboard/devices', label: 'Devices', icon: Smartphone },
    { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
    { href: '/dashboard/analytics', label: 'AI Analytics', icon: BarChart3 },
    { href: '/dashboard/reports', label: 'Reports', icon: FileText },
    { href: '/dashboard/organizations', label: 'Organization', icon: Building2 },
    { href: '/dashboard/feedback', label: 'Feedback', icon: MessageSquarePlus },
    ...(canAccessSupport(user) ? [{ href: '/dashboard/support', label: 'Support', icon: LifeBuoy }] : []),
    { href: '/dashboard/settings', label: 'Personal Settings', icon: Settings },
  ]

  return (
    <>
      <ThemeBranding />
      <div className="dashboard-container">
        {/* Mobile Menu Toggle — visible only on < 1024px via CSS */}
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Mobile Overlay — closes drawer on tap */}
        {mobileMenuOpen && (
          <div
            className="mobile-overlay"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
        )}

        <nav className={`nav-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
          <div className="nav-header">
            <h1 className="nav-brand">{currentOrganization?.name || 'NetNeural'} IoT Platform</h1>
          </div>
          
          {/* Organization Switcher */}
          <div className="px-4 py-3 border-b border-gray-200">
            <OrganizationSwitcherCompact />
          </div>
        
          <div className="nav-menu">
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  onClick={closeMobileMenu}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {label}
                </Link>
              )
            })}
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
                closeMobileMenu()
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
    </>
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