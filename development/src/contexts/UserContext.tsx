'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { UserProfile, getCurrentUser } from '@/lib/auth'
import { useRouter } from 'next/navigation'

interface UserContextType {
  user: UserProfile | null
  loading: boolean
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const loadUser = async () => {
    try {
      const userProfile = await getCurrentUser()
      setUser(userProfile)
      
      // Redirect to login if not authenticated
      if (!userProfile) {
        router.push('/auth/login')
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
