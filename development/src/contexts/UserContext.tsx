'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from 'react'
import { UserProfile, getCurrentUser } from '@/lib/auth'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface UserContextType {
  user: UserProfile | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/signup',
  '/auth/reset-password',
  '/auth/change-password',
]

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const hasRedirected = useRef(false)

  const loadUser = async () => {
    try {
      // First check if we have a valid session
      const supabase = createClient()
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      // If no session or session error, clear session and redirect to login
      if (!session || sessionError) {
        // Clear any stale session data
        await supabase.auth.signOut()

        const isPublicRoute = PUBLIC_ROUTES.some((route) =>
          pathname?.startsWith(route)
        )
        if (!isPublicRoute && !hasRedirected.current) {
          hasRedirected.current = true
          // Don't show session_expired if the user intentionally signed out
          const wasManualSignOut =
            typeof window !== 'undefined' &&
            sessionStorage.getItem('manual_signout')
          if (wasManualSignOut) {
            sessionStorage.removeItem('manual_signout')
            router.push('/auth/login')
          } else {
            router.push('/auth/login?error=session_expired')
          }
        }
        setUser(null)
        return
      }

      // We have a valid session, try to get user profile
      const userProfile = await getCurrentUser()

      // If getCurrentUser fails but we have a session, the API might be down
      // or the user doesn't have proper permissions/profile
      if (!userProfile) {
        console.error('Failed to load user profile despite valid session')

        // Clear the session since we can't get a valid user profile
        await supabase.auth.signOut()

        const isPublicRoute = PUBLIC_ROUTES.some((route) =>
          pathname?.startsWith(route)
        )
        if (!isPublicRoute && !hasRedirected.current) {
          hasRedirected.current = true
          router.push('/auth/login?error=profile_load_failed')
        }
        setUser(null)
        return
      }

      // Success! We have both a valid session and user profile
      setUser(userProfile)
      hasRedirected.current = false

      // Check if user needs to change password
      if (
        userProfile.passwordChangeRequired &&
        pathname !== '/auth/change-password'
      ) {
        console.log('User must change password, redirecting...')
        router.push('/auth/change-password')
        return
      }
    } catch (error) {
      console.error('Failed to load user:', error)

      // Clear session on any error
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch (signOutError) {
        console.error('Failed to sign out:', signOutError)
      }

      setUser(null)

      const isPublicRoute = PUBLIC_ROUTES.some((route) =>
        pathname?.startsWith(route)
      )
      if (!isPublicRoute && !hasRedirected.current) {
        hasRedirected.current = true
        router.push('/auth/login?error=auth_error')
      }
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
        refreshUser: loadUser,
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
