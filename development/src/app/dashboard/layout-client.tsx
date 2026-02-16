'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'

interface DashboardLayoutClientProps {
  children: React.ReactNode
  userEmail: string
}

export default function DashboardLayoutClient({ children, userEmail }: DashboardLayoutClientProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { currentOrganization } = useOrganization()

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
      {/* Mobile Menu Toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {mobileMenuOpen ? (
            <path d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <nav className={`nav-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="nav-header">
          <h1 className="nav-brand">{currentOrganization?.name || 'NetNeural'} IoT Platform</h1>
        </div>
        <div className="nav-menu">
          <Link href="/dashboard" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
            <span className="nav-icon">📊</span>
            Dashboard
          </Link>
          <Link href="/dashboard/devices" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
            <span className="nav-icon">📱</span>
            Devices
          </Link>
          <Link href="/dashboard/alerts" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
            <span className="nav-icon">🚨</span>
            Alerts
          </Link>
          <Link href="/dashboard/analytics" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
            <span className="nav-icon">📈</span>
            Analytics
          </Link>
        </div>
        <div className="nav-user">
          <div className="user-info">
            <p className="text-sm font-medium">
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