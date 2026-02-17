'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/auth/user-context'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { cn } from '@/lib/utils'

interface NavigationItem {
  name: string
  href: string
  icon: string
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user } = useUser()
  const { currentOrganization } = useOrganization()

  const navigation: NavigationItem[] = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Devices', href: '/dashboard/devices', icon: '📱' },
    { name: 'Organizations', href: '/dashboard/organizations', icon: '🏢' },
    { name: 'Alerts', href: '/dashboard/alerts', icon: '🚨' },
    { name: 'Analytics', href: '/dashboard/analytics', icon: '📈' },
    { name: 'Settings & Users', href: '/dashboard/settings', icon: '⚙️' },
  ]

  const handleSignOut = async () => {
    try {
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
      <nav className={cn(
        "fixed top-0 left-0 h-screen w-[280px] bg-white border-r border-gray-200 z-[100] transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Brand */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <OrganizationLogo
              settings={currentOrganization?.settings}
              name={currentOrganization?.name || 'NetNeural'}
              size="lg"
            />
            <h1 className="text-xl font-bold text-gray-900">
              {currentOrganization?.name || 'NetNeural'} IoT Platform
            </h1>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="p-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-4 py-3 mb-1 rounded-md transition-all duration-150 ease-in-out",
                "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
                pathname === item.href && "bg-blue-100 text-blue-700"
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="w-5 h-5 mr-3">{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </div>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
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
          className="fixed inset-0 bg-black/50 z-[99] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="ml-0 lg:ml-[280px] min-h-screen bg-gray-50 transition-[margin-left] duration-300 ease-in-out w-full">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-50">
          <div className="flex items-center justify-between">
            <Button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              variant="ghost"
              size="sm"
              className="lg:hidden"
            >
              ☰
            </Button>
            <div className="hidden lg:flex items-center gap-3">
              <OrganizationLogo
                settings={currentOrganization?.settings}
                name={currentOrganization?.name || 'NetNeural'}
                size="md"
              />
              <h1 className="text-xl font-semibold text-gray-900">
                {currentOrganization?.name || 'NetNeural'} IoT Platform
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Add header actions here if needed */}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-8 px-6">
          {children}
        </div>
      </main>
    </div>
  )
}