import { createBrowserClient } from '@supabase/ssr'

// Get Supabase URL and Key with proper fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate that we have the required environment variables
if (!supabaseUrl) {
  console.warn('⚠️ Missing NEXT_PUBLIC_SUPABASE_URL environment variable - falling back to demo mode')
}

if (!supabaseAnonKey) {
  console.warn('⚠️ Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable - falling back to demo mode')
}

// Log the configuration being used (without sensitive data) - only in development
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Supabase configuration:', {
    url: supabaseUrl,
    hasKey: !!supabaseAnonKey,
    keyLength: supabaseAnonKey.length,
    nodeEnv: process.env.NODE_ENV
  })
}

export const createClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase configuration is missing. Using fallback client.')
    // Return a mock client that will trigger demo mode
    return null
  }
  
  try {
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error)
    return null
  }
}

// Helper function to check if Supabase is available
export const isSupabaseAvailable = () => {
  return !!(supabaseUrl && supabaseAnonKey)
}
