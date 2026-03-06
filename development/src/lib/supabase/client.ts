import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'
import { getSupabaseUrl, getSupabaseAnonKey } from './config'

/**
 * Custom storage that checks sessionStorage first (ephemeral / "don't remember me"),
 * then falls back to localStorage (persistent / "keep me signed in").
 * Writes always go to whichever store currently holds the token, defaulting to localStorage.
 */
const hybridStorage: Storage = typeof window !== 'undefined'
  ? {
      get length() { return localStorage.length },
      key: (i: number) => localStorage.key(i),
      clear: () => { localStorage.clear(); sessionStorage.clear() },
      getItem: (key: string) => sessionStorage.getItem(key) ?? localStorage.getItem(key),
      setItem: (key: string, value: string) => {
        // If token is in sessionStorage (ephemeral session), keep it there
        if (sessionStorage.getItem(key) !== null) {
          sessionStorage.setItem(key, value)
        } else {
          localStorage.setItem(key, value)
        }
      },
      removeItem: (key: string) => {
        localStorage.removeItem(key)
        sessionStorage.removeItem(key)
      },
    }
  : (undefined as unknown as Storage)

export const createClient = () => {
  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    ...(typeof window !== 'undefined' ? { auth: { storage: hybridStorage } } : {}),
  })
}
