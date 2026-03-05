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
  '/auth/setup-mfa',
]

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const hasRedirected = useRef(false)
  const retryCount = useRef(0)

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

      // If getCurrentUser fails but we have a session, the API might be temporarily down.
      // Retry up to 2 times before giving up — don't destroy the session on transient errors.
      if (!userProfile) {
        if (retryCount.current < 2) {
          retryCount.current += 1
          console.warn(
            `getCurrentUser returned null (attempt ${retryCount.current}/2), retrying in 2s...`
          )
          setTimeout(() => loadUser(), 2000)
          return
        }

        console.error(
          'Failed to load user profile after 2 retries — session still valid, NOT signing out.'
        )

        // Don't sign out — the session is valid, the API is just unreachable.
        // Set user null so the UI can show a loading/error state.
        setUser(null)
        return
      }

      // Success — reset retry counter
      retryCount.current = 0

      // Success! We have both a valid session and user profile
      setUser(userProfile)
      hasRedirected.current = false

      // Check if user needs MFA setup (before password check so MFA is enforced first)
      // MFA enforcement is disabled on dev (demo.netneural.ai) for E2E testing
      const isMfaEnforced = !process.env.NEXT_PUBLIC_DISABLE_MFA_ENFORCEMENT
      if (
        isMfaEnforced &&
        pathname !== '/auth/setup-mfa' &&
        pathname !== '/auth/change-password'
      ) {
        const { data: mfaFactors } = await supabase.auth.mfa.listFactors()
        const hasVerifiedTotp = mfaFactors?.totp?.some(
          (f) => f.status === 'verified'
        )
        if (!hasVerifiedTotp) {
          router.push('/auth/setup-mfa')
          return
        }

        // Verify the session has completed MFA challenge (aal2)
        // Prevents back-button bypass: user enters password but skips MFA verification
        const { data: aal } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal && aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
          // Session is aal1 but aal2 is required — MFA challenge not completed
          await supabase.auth.signOut()
          router.push('/auth/login')
          return
        }
      }

      // Check if user needs to change password
      if (
        userProfile.passwordChangeRequired &&
        pathname !== '/auth/change-password'
      ) {
        router.push('/auth/change-password')
        return
      }
    } catch (error) {
      console.error('Failed to load user:', error)

      // Don't sign out on transient errors — the session may still be valid.
      // Only clear state so the UI shows a loading/error state.
      setUser(null)

      // If this is a persistent/hard error (not a network blip), let the
      // user see the auth-error page — but still don't destroy the session.
      const isPublicRoute = PUBLIC_ROUTES.some((route) =>
        pathname?.startsWith(route)
      )
      if (!isPublicRoute && !hasRedirected.current && retryCount.current >= 2) {
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
