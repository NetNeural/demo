import { supabase } from './index'

export class AuthManager {
  // Sign up with email and password
  async signUp(email: string, password: string, userData?: any) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userData }
    })
    return { user: data.user, session: data.session, error }
  }

  // Sign in with email and password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { user: data.user, session: data.session, error }
  }

  // OAuth sign in
  async signInWithOAuth(provider: 'google' | 'github' | 'discord') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof globalThis !== 'undefined' && 'location' in globalThis 
          ? `${(globalThis as any).location.origin}/auth/callback` 
          : undefined
      }
    })
    return { data, error }
  }

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  // Get current session
  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  }

  // Get current user
  async getUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  }

  // Listen to auth state changes
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

export const authManager = new AuthManager()
