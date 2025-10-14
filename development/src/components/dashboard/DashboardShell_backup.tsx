'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Smartphone,
  AlertTriangle,
  Building2,
  Plug,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  ChevronDown
} from 'lucide-react'

interface DashboardShellProps {
  children: React.ReactNode
  user?: {
    id: string
    email: string
    full_name: string | null
    role: string
    organization_id: string | null
    organization?: {
      id: string
      name: string
    } | null
  }
}

const navigationItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    current: false,
  },
  {
    name: 'Devices',
    href: '/dashboard/devices',
    icon: Smartphone,
    current: false,
  },
  {
    name: 'Alerts',
    href: '/dashboard/alerts',
    icon: AlertTriangle,
    current: false,
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    current: false,
  },
  {
    name: 'Settings & Users',
    href: '/dashboard/settings',
    icon: Settings,
    current: false,
  },
]

const superAdminItems = [
  {
    name: 'Organizations',
    href: '/dashboard/organizations',
    icon: Building2,
    current: false,
  },
  {
    name: 'Integrations',
    href: '/dashboard/integrations',
    icon: Plug,
    current: false,
  },
]

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Combine navigation items with super admin items if applicable
  const allNavigationItems = [
    ...navigationItems,
    ...(user?.role === 'super_admin' ? superAdminItems : [])
  ].map(item => ({
    ...item,
    current: pathname === item.href
  }))

  return (
    <div className="min-h-screen bg-gray-25">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" />
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-xl border-r border-gray-200
        transform transition-transform duration-300 ease-in-out lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo & Brand */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 enterprise-gradient rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">NN</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">NetNeural</h2>
              <p className="text-xs text-gray-500">IoT Platform</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {allNavigationItems.map((item) => {
            const IconComponent = item.icon
            return (
              <a
                key={item.name}
                href={item.href}
                className={`
                  group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200
                  ${item.current
                    ? 'bg-primary-50 text-primary-700 border border-primary-200 shadow-sm'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <IconComponent className={`
                  mr-3 h-5 w-5 flex-shrink-0 transition-colors
                  ${item.current ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-700'}
                `} />
                {item.name}
                {item.current && (
                  <div className="ml-auto w-2 h-2 bg-primary-500 rounded-full" />
                )}
              </a>
            )
          })}
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-gray-200 p-4">
          {user && (
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user.full_name || user.email}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user.role.replace('_', ' ')}
                </p>
                {user.organization && (
                  <p className="text-xs text-gray-400 truncate">
                    {user.organization.name}
                  </p>
                )}
              </div>
            </div>
          )}
          <Button 
            onClick={handleSignOut} 
            disabled={isLoading}
            variant="outline" 
            className="w-full justify-start"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {isLoading ? 'Signing out...' : 'Sign Out'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-72">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Mobile menu button */}
              <div className="flex items-center lg:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </div>

              {/* Search bar */}
              <div className="flex-1 max-w-lg mx-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search devices, alerts, or users..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50"
                  />
                </div>
              </div>

              {/* Header actions */}
              <div className="flex items-center space-x-3">
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-error-500 rounded-full text-xs flex items-center justify-center">
                    <span className="sr-only">3 notifications</span>
                  </span>
                </Button>
                
                <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-gray-200">
                  {user && (
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-xs">
                          {(user.full_name || user.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}