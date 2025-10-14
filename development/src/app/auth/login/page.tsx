'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function LoginPage() {
  // Pre-fill credentials only in development mode for convenience
  const [email, setEmail] = useState(process.env.NODE_ENV === 'development' ? 'admin@netneural.ai' : '')
  const [password, setPassword] = useState(process.env.NODE_ENV === 'development' ? 'NetNeural2025!' : '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      })

      if (loginError) {
        setError('Invalid email or password. Please try again.')
        return
      }

      if (!data.user) {
        setError('Login failed - please try again')
        return
      }

      window.location.href = '/dashboard'
      
    } catch (err) {
      console.error('Login error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
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
                  <AlertDescription>{error}</AlertDescription>
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
                  <div className="mt-1 text-xs">Password: NetNeural2025!</div>
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