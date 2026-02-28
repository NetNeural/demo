'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const router = useRouter()

  // Supabase delivers the user here with a session via the recovery link.
  // We need to wait for the auth state to settle before showing the form.
  useEffect(() => {
    const supabase = createClient()

    // Listen for PASSWORD_RECOVERY event (fired when user clicks the email link)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasSession(true)
        setChecking(false)
      }
    })

    // Also check if there's already a session (page refresh after recovery link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true)
      }
      setChecking(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)
    const hasSpecialChar = /[^a-zA-Z0-9\s]/.test(newPassword)

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      setError(
        'Password must contain uppercase, lowercase, number, and special character'
      )
      return
    }

    try {
      setIsSubmitting(true)
      const supabase = createClient()

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw updateError
      }

      // Clear the password_change_required flag if it was set
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await supabase
          .from('users')
          .update({
            password_change_required: false,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', user.id)
      }

      setSuccess(true)
    } catch (err) {
      console.error('Password reset error:', err)
      setError('Failed to reset password. The link may have expired. Please request a new one.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // No session — invalid or expired link
  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="mb-4 flex items-center justify-center">
              <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl">
              Invalid or Expired Link
            </CardTitle>
            <CardDescription className="text-center">
              This password reset link is invalid or has expired. Please request
              a new one from the login page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => router.push('/auth/login')}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="mb-4 flex items-center justify-center">
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <CardTitle className="text-center text-2xl">
              Password Reset
            </CardTitle>
            <CardDescription className="text-center">
              Your password has been successfully changed. You can now sign in
              with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => router.push('/auth/login')}
            >
              <Lock className="mr-2 h-4 w-4" />
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Password reset form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
              <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">
            Reset Your Password
          </CardTitle>
          <CardDescription className="text-center">
            Enter a new secure password for your account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Password must be at least 8 characters and include uppercase,
              lowercase, numbers, and special characters.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={isSubmitting}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Password strength indicators */}
            {newPassword.length > 0 && (
              <div className="space-y-1 text-xs">
                <div className={newPassword.length >= 8 ? 'text-green-600' : 'text-muted-foreground'}>
                  {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                </div>
                <div className={/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-muted-foreground'}>
                  {/[A-Z]/.test(newPassword) ? '✓' : '○'} Uppercase letter
                </div>
                <div className={/[a-z]/.test(newPassword) ? 'text-green-600' : 'text-muted-foreground'}>
                  {/[a-z]/.test(newPassword) ? '✓' : '○'} Lowercase letter
                </div>
                <div className={/[0-9]/.test(newPassword) ? 'text-green-600' : 'text-muted-foreground'}>
                  {/[0-9]/.test(newPassword) ? '✓' : '○'} Number
                </div>
                <div className={/[^a-zA-Z0-9\s]/.test(newPassword) ? 'text-green-600' : 'text-muted-foreground'}>
                  {/[^a-zA-Z0-9\s]/.test(newPassword) ? '✓' : '○'} Special character
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting...
                </span>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Reset Password
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => router.push('/auth/login')}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              ← Back to login
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
