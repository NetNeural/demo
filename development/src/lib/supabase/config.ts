/**
 * Get Supabase URL dynamically based on environment
 * - Codespaces: Use Next.js API proxy to avoid CORS issues
 * - Local: http://127.0.0.1:54321
 * - Production: From NEXT_PUBLIC_SUPABASE_URL
 */
export function getSupabaseUrl(): string {
  // If explicitly set, use it
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
  }

  // Detect Codespaces environment - use API proxy to avoid CORS
  if (typeof window !== 'undefined' && window.location.hostname.includes('app.github.dev')) {
    // Use the Next.js API proxy which can communicate with localhost Supabase without CORS issues
    return `${window.location.origin}/api/supabase-proxy`
  }

  // Default to localhost for local development
  return 'http://127.0.0.1:54321'
}

/**
 * Get Supabase anon key from environment
 */
export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')
  }
  return key
}
