'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserProvider, useUser } from '@/contexts/UserContext'
import {
  OrganizationProvider,
  useOrganization,
} from '@/contexts/OrganizationContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import { OrganizationSwitcherCompact } from '@/components/organizations/OrganizationSwitcher'
import { QuickActionsDropdown } from '@/components/quick-actions/QuickActionsDropdown'
import { KeyboardShortcutsModal } from '@/components/keyboard-shortcuts/KeyboardShortcutsModal'
import { ThemeBranding } from '@/components/branding/ThemeBranding'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useSessionTimeout } from '@/hooks/useSessionTimeout'
import { SessionTimeoutModal } from '@/components/session/SessionTimeoutModal'
import { AccessRequestNotifier } from '@/components/access/AccessRequestNotifier'
import {
  LayoutDashboard,
  Bell,
  BarChart3,
  Building2,
  Settings,
  FileText,
  Menu,
  X,
  MessageSquarePlus,
  LifeBuoy,
  DollarSign,
  FileBarChart,
  Activity,
  ShieldCheck,
  Network,
  KeyRound,
  Code,
  Cpu,
  Warehouse,
  Newspaper,
} from 'lucide-react'
import { canAccessSupport, isPlatformAdmin } from '@/lib/permissions'
import { getRoleDisplayInfo } from '@/types/organization'
import { Badge } from '@/components/ui/badge'

// Lazy singleton — avoids calling createClient() at module eval time during static export
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const { currentOrganization, userOrganizations, userRole } = useOrganization()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isSuperAdmin = user?.isSuperAdmin || false
  const isPlAdmin = isPlatformAdmin(user, currentOrganization?.id, userRole)

  // SOC 2 CC6.2: idle session timeout
  const { showWarning, secondsRemaining, extendSession, signOutNow } =
    useSessionTimeout()

  // Always show sentinel logo from root NetNeural org, regardless of selected org
  const sentinelLogoUrl = (() => {
    const rootOrg = userOrganizations.find(
      (org) =>
        org.id === '00000000-0000-0000-0000-000000000001' ||
        (!org.parent_organization_id && org.name === 'NetNeural')
    )
    return (
      rootOrg?.settings?.branding?.sentinel_logo_url ||
      currentOrganization?.settings?.branding?.sentinel_logo_url
    )
  })()

  // Keep browser tab title in sync with current page + org
  usePageTitle()

  // Enable global keyboard shortcuts
  useKeyboardShortcuts()

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!user) {
    return <div className="p-6">Redirecting to login...</div>
  }

  type NavItem = {
    href: string
    label: string
    icon: typeof LayoutDashboard
    exact?: boolean
  }
  type NavGroup = { section: string; items: NavItem[] }

  const navGroups: NavGroup[] = [
    {
      section: 'Overview',
      items: [
        {
          href: '/dashboard',
          label: 'Dashboard',
          icon: LayoutDashboard,
          exact: true,
        },
      ],
    },
    {
      section: 'Operations',
      items: [
        {
          href: '/dashboard/hardware-provisioning',
          label: 'Hardware Provisioning',
          icon: Cpu,
        },
        ...(isSuperAdmin || isPlAdmin
          ? [
              {
                href: '/dashboard/inventory-control',
                label: 'Inventory Control',
                icon: Warehouse,
              },
            ]
          : []),
        { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
      ],
    },
    {
      section: 'Insights',
      items: [
        { href: '/dashboard/analytics', label: 'AI Analytics', icon: BarChart3 },
        { href: '/dashboard/reports', label: 'Reports', icon: FileText },
      ],
    },
    {
      section: 'Management',
      items: [
        {
          href: '/dashboard/organizations',
          label: 'Organization',
          icon: Building2,
        },
        ...(currentOrganization?.id === '00000000-0000-0000-0000-000000000001' &&
        (isSuperAdmin ||
          isPlAdmin ||
          userRole === 'owner' ||
          userRole === 'billing')
          ? [
              {
                href: '/dashboard/billing',
                label: 'Billing Administration',
                icon: FileBarChart,
              },
            ]
          : []),
        ...(currentOrganization?.subscription_tier === 'reseller' ||
        currentOrganization?.is_reseller === true
          ? [{ href: '/dashboard/reseller', label: 'Reseller Hub', icon: Network }]
          : []),
      ],
    },
    {
      section: 'Support',
      items: [
        { href: '/dashboard/feedback', label: 'Feedback', icon: MessageSquarePlus },
        ...(canAccessSupport(user, userRole)
          ? [
              { href: '/dashboard/support', label: 'Support', icon: LifeBuoy },
              { href: '/dashboard/media-room', label: 'Media Room', icon: Newspaper },
            ]
          : []),
      ],
    },
    {
      section: 'System',
      items: [
        { href: '/dashboard/developer', label: 'Developer', icon: Code },
        { href: '/dashboard/settings', label: 'Personal Settings', icon: Settings },
      ],
    },
  ]

  return (
    <>
      <ThemeBranding />
      <KeyboardShortcutsModal />
      <AccessRequestNotifier />
      <div className="dashboard-container">
        {/* Mobile Menu Toggle — visible only on < 1024px via CSS */}
        <button
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
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
            <div className="flex items-center gap-2">
              {sentinelLogoUrl && (
                <img
                  src={sentinelLogoUrl}
                  alt="Sentinel logo"
                  className="h-16 w-16 flex-shrink-0 object-contain"
                />
              )}
              <h1 className="nav-brand">
                {currentOrganization?.name === 'NetNeural' ||
                !currentOrganization
                  ? 'Sentinel by NetNeural'
                  : `Sentinel for ${currentOrganization.name}`}
              </h1>
            </div>
          </div>

          {/* Organization Switcher */}
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--gray-200)' }}>
            <OrganizationSwitcherCompact />
          </div>

          <div className="nav-menu">
            {navGroups.map(({ section, items }) =>
              items.length > 0 ? (
                <div key={section} className="nav-section">
                  <div className="nav-section-label">{section}</div>
                  {items.map(({ href, label, icon: Icon, exact }) => {
                    const isActive = exact
                      ? pathname === href
                      : pathname.startsWith(href)
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`nav-item ${isActive ? 'active' : ''}`}
                        onClick={closeMobileMenu}
                      >
                        <Icon className="mr-2 h-5 w-5" />
                        {label}
                      </Link>
                    )
                  })}
                </div>
              ) : null
            )}
          </div>
          <div className="nav-user">
            <div className="user-info">
              <p className="text-sm font-medium" style={{ color: 'var(--gray-900)' }}>{user.email}</p>
            </div>
            <button
              onClick={async () => {
                closeMobileMenu()
                sessionStorage.setItem('manual_signout', '1')
                // Audit log the logout before signing out
                try {
                  const {
                    data: { user: signOutUser },
                  } = await getSupabase().auth.getUser()
                  if (signOutUser) {
                    const { auditLogout } = await import('@/lib/audit-client')
                    auditLogout(signOutUser.id, signOutUser.email || '')
                    await new Promise((r) => setTimeout(r, 200))
                  }
                } catch {
                  /* don't block logout */
                }
                await getSupabase().auth.signOut()
                window.location.href = '/auth/login'
              }}
              className="btn btn-ghost btn-sm"
            >
              Sign out
            </button>
          </div>
        </nav>
        <main className="main-content">
          {/* Top bar with Quick Actions */}
          <div className="sticky top-0 z-50 flex items-center justify-between border-b bg-background/95 px-4 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-8">
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              {user?.role === 'super_admin' ? (
                <Badge
                  variant="destructive"
                  className="flex items-center gap-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  </svg>
                  <span className="hidden sm:inline">Super Admin</span>
                </Badge>
              ) : (user?.role === 'platform_admin' || isPlAdmin) ? (
                <Badge className="flex items-center gap-1 bg-purple-600 text-white hover:bg-purple-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  </svg>
                  <span className="hidden sm:inline">Platform Admin</span>
                </Badge>
              ) : currentOrganization?.role ? (
                (() => {
                  const roleInfo = getRoleDisplayInfo(currentOrganization.role)
                  const colorMap: Record<string, string> = {
                    purple: 'bg-purple-600 hover:bg-purple-600',
                    blue: 'bg-blue-600 hover:bg-blue-600',
                    amber: 'bg-amber-600 hover:bg-amber-600',
                    green: 'bg-green-600 hover:bg-green-600',
                    gray: 'bg-gray-500 hover:bg-gray-500',
                  }
                  return (
                    <Badge
                      className={`flex items-center gap-1 text-white ${colorMap[roleInfo.color] || 'bg-gray-500'}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                      </svg>
                      <span className="hidden sm:inline">{roleInfo.label}</span>
                    </Badge>
                  )
                })()
              ) : null}
              <QuickActionsDropdown />
            </div>
          </div>
          {children}
        </main>
      </div>
      <SessionTimeoutModal
        open={showWarning}
        secondsRemaining={secondsRemaining}
        onExtend={extendSession}
        onSignOut={signOutNow}
      />
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
        <PreferencesProvider>
          <DashboardContent>{children}</DashboardContent>
        </PreferencesProvider>
      </OrganizationProvider>
    </UserProvider>
  )
}
