'use client'

// Navigation icons using Lucide React - Version 2.0
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/auth/user-context'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Smartphone,
  Building2,
  Bell,
  BarChart3,
  FileText,
  Settings,
  Shield,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user, profile } = useUser()
  const { currentOrganization } = useOrganization()

  const isSuperAdmin = profile?.role === 'super_admin'

  // Debug logging
  console.log('🔍 DashboardShell Debug:', {
    hasUser: !!user,
    hasProfile: !!profile,
    profileRole: profile?.role,
    isSuperAdmin,
    userEmail: user?.email,
  })

  const navigation: NavigationItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Devices', href: '/dashboard/devices', icon: Smartphone },
    {
      name: 'Device Types',
      href: '/dashboard/device-types',
      icon: SlidersHorizontal,
    },
    {
      name: 'Organizations',
      href: '/dashboard/organizations',
      icon: Building2,
    },
    { name: 'Alerts', href: '/dashboard/alerts', icon: Bell },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Reports', href: '/dashboard/reports', icon: FileText },
    { name: 'Settings & Users', href: '/dashboard/settings', icon: Settings },
  ]

  // Debug: Log icon types
  if (typeof window !== 'undefined') {
    console.log('🔍 Navigation Icons Debug:', {
      dashboardIcon: typeof LayoutDashboard,
      devicesIcon: typeof Smartphone,
      iconIsFunction: typeof LayoutDashboard === 'function',
    })
  }

  const handleSignOut = async () => {
    try {
      sessionStorage.setItem('manual_signout', '1')
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/auth/login'
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <nav
        className={cn(
          'fixed left-0 top-0 z-[100] h-screen w-[280px] border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand */}
        <div className="border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <OrganizationLogo
              settings={currentOrganization?.settings}
              name={currentOrganization?.name || 'NetNeural'}
              size="lg"
            />
            <h1 className="text-xl font-bold text-gray-900">
              {currentOrganization?.name === 'NetNeural' || !currentOrganization
                ? 'Sentinel by NetNeural'
                : `Sentinel for ${currentOrganization.name}`}
            </h1>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="p-4">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'mb-1 flex items-center rounded-md px-4 py-3 transition-all duration-150 ease-in-out',
                  'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                  pathname === item.href && 'bg-blue-100 text-blue-700'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-4">
          <div className="mb-2">
            <p className="text-sm font-medium text-gray-900">
              {user?.email || 'Loading...'}
            </p>
          </div>
          <Button
            onClick={handleSignOut}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            Sign out
          </Button>
        </div>
      </nav>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[99] bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="ml-0 min-h-screen w-full bg-gray-50 transition-[margin-left] duration-300 ease-in-out lg:ml-[280px]">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <Button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              variant="ghost"
              size="sm"
              className="lg:hidden"
            >
              ☰
            </Button>
            <div className="hidden flex-1 items-center gap-3 lg:flex">
              <OrganizationLogo
                settings={currentOrganization?.settings}
                name={currentOrganization?.name || 'NetNeural'}
                size="md"
              />
              <h1 className="text-xl font-semibold text-gray-900">
                {currentOrganization?.name === 'NetNeural' ||
                !currentOrganization
                  ? 'Sentinel by NetNeural'
                  : `Sentinel for ${currentOrganization.name}`}
              </h1>
            </div>
            {isSuperAdmin && (
              <Badge
                variant="destructive"
                className="flex flex-shrink-0 items-center gap-1"
              >
                <Shield className="h-3 w-3" />
                <span className="hidden sm:inline">Super Admin</span>
              </Badge>
            )}
          </div>
        </header>

        {/* Page content */}
        <div className="p-8 px-6">{children}</div>
      </main>
    </div>
  )
}
