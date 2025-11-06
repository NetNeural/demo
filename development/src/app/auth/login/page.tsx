'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Pre-fill credentials only in development mode for convenience
  const [email, setEmail] = useState(process.env.NODE_ENV === 'development' ? 'admin@netneural.ai' : '')
  const [password, setPassword] = useState(process.env.NODE_ENV === 'development' ? 'password123' : '')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Prevent redirect loops
  const hasCheckedAuth = useRef(false)

  // Check for error messages in URL parameters
  useEffect(() => {
    const errorParam = searchParams?.get('error')
    if (errorParam) {
      // Decode and display the error message
      setError(decodeURIComponent(errorParam))
      
      // Clear the URL parameter to prevent showing error after refresh
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [searchParams])

  // Check if user is already authenticated and redirect
  useEffect(() => {
    // Only check once to prevent loops
    if (hasCheckedAuth.current) return
    
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        // If there's a session error or no session, just stay on login page
        if (sessionError || !session) {
          hasCheckedAuth.current = true
          return
        }
        
        // Only redirect if we have a valid session
        if (session) {
          hasCheckedAuth.current = true
          router.replace('/dashboard')
        }
      } catch (err) {
        console.error('Auth check error:', err)
        // Mark as checked to prevent loops
        hasCheckedAuth.current = true
        // Don't show error to user, just stay on login page
      }
    }
    
    checkAuth()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      
      // Sign in with password
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      })

      if (loginError) {
        setError('Invalid email or password. Please try again.')
        setIsLoading(false)
        return
      }

      if (!data.user) {
        setError('Login failed - please try again')
        setIsLoading(false)
        return
      }

      // If "Remember Me" is NOT checked, set session to expire after 8 hours
      // Default Supabase session is 7 days, so we override only if not remembering
      if (!rememberMe && data.session) {
        // Set session expiry to 8 hours (28800 seconds)
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        })
      }

      // Wait a brief moment to ensure session is fully established
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Verify session is established before redirecting
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // Mark that we've successfully authenticated
        hasCheckedAuth.current = true
        
        // Use Next.js router for client-side navigation
        router.push('/dashboard')
        // Small delay then force refresh to ensure all auth state is synced
        setTimeout(() => {
          router.refresh()
        }, 50)
      } else {
        setError('Session could not be established. Please try again.')
        setIsLoading(false)
      }
      
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding (Desktop only) */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-600 to-blue-500 text-white p-12 flex-col justify-center">
        <div className="opacity-95">
          <h1 className="text-3xl font-bold mb-4">NetNeural IoT</h1>
          <p className="text-xl mb-8">Enterprise IoT Management Platform</p>
          <h2 className="text-2xl font-semibold mb-4">Secure IoT Infrastructure</h2>
          <p className="text-lg">Monitor, manage, and secure your enterprise IoT ecosystem</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-[400px]">
          {/* Mobile Brand (Mobile only) */}
          <div className="text-center mb-8 lg:hidden">
            <h1 className="text-2xl font-bold text-gray-900">NetNeural IoT</h1>
            <p className="text-gray-600">Enterprise Platform</p>
          </div>

          {/* Login Card */}
          <Card>
            <CardContent className="p-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
                <p className="text-gray-600">Sign in to your enterprise account</p>
              </div>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertDescription>
                    <div className="flex items-start justify-between">
                      <span>{error}</span>
                      {error.includes('unexpected error') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setError('')
                            setEmail('')
                            setPassword('')
                            hasCheckedAuth.current = false
                          }}
                          className="ml-2 h-auto py-0 px-2 text-xs"
                        >
                          Reset
                        </Button>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="mb-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="mb-6 flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="remember-me" className="ml-2 text-sm text-gray-700">
                    Remember me (keep me signed in)
                  </label>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 text-base font-medium"
                >
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </form>

              <div className="text-center">
                <p className="text-xs text-gray-600">
                  Forgot your password? Contact your system administrator
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Development Mode Helper */}
          {process.env.NODE_ENV === 'development' && (
            <Alert className="mt-4 bg-blue-50 border-blue-200">
              <AlertDescription>
                <strong>Development Mode:</strong> Test accounts available
                <div className="text-sm mt-2 space-y-1">
                  <div>• superadmin@netneural.ai</div>
                  <div>• admin@netneural.ai</div>
                  <div>• user@netneural.ai</div>
                  <div>• viewer@netneural.ai</div>
                  <div className="mt-1 text-xs">Password: password123</div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Security Notice */}
          <Alert className="mt-4 bg-green-50 border-green-200">
            <AlertDescription>
              <strong>Enterprise Security:</strong> This platform uses advanced security measures.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}