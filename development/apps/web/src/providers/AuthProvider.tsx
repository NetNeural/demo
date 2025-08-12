'use client'

import { createContext, useContext } from 'react'
import { useSupabase } from './SupabaseProvider'

const AuthContext = createContext({})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabaseContext = useSupabase()
  
  return (
    <AuthContext.Provider value={supabaseContext}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useSupabase()
}
