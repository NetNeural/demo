'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { UserProfile, getCurrentUser } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'

interface UserContextType {
  user: UserProfile | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/auth/login', '/auth/signup', '/auth/reset-password']

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const hasRedirected = useRef(false)

  const loadUser = async () => {
    try {
      const userProfile = await getCurrentUser()
      setUser(userProfile)
      
      // Check if current route is public
      const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))
      
      // Only redirect once per session to prevent loops
      if (!userProfile && !isPublicRoute && !hasRedirected.current) {
        hasRedirected.current = true
        router.push('/auth/login')
      }
      
      // Reset redirect flag if user is authenticated (for logout scenarios)
      if (userProfile) {
        hasRedirected.current = false
      }
    } catch (error) {
      console.error('Failed to load user:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <UserContext.Provider 
      value={{ 
        user, 
        loading,
        refreshUser: loadUser
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
