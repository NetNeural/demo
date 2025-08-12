import { createBrowserClient } from '@supabase/ssr'

// Get Supabase URL and Key with proper fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Validate that we have the required environment variables
if (!supabaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')))
}

if (!supabaseAnonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
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
    const error = new Error(`Supabase configuration is missing. 
    URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'} 
    Key: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}
    Please check your environment variables.`)
    console.error(error.message)
    throw error
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
