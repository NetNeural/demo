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
  Wand2,
  Check,
  X,
} from 'lucide-react'
import {
  PASSWORD_REQUIREMENTS,
  getPasswordStrength,
  generateStrongPassword,
} from '@/lib/password-utils'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [linkExpiredError, setLinkExpiredError] = useState<string | null>(null)
  const [resendEmail, setResendEmail] = useState('')
  const [resendSent, setResendSent] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const router = useRouter()

  // Supabase delivers the user here via a recovery link.
  // With token_hash flow (preferred), the URL contains ?token_hash=XXX&type=recovery
  // which is verified via POST (immune to email scanner prefetching).
  // With PKCE flow, the URL contains ?code=XXX which must be exchanged for a session.
  // With implicit flow (older links), the session is already in the URL hash.
  useEffect(() => {
    const supabase = createClient()

    // Listen for PASSWORD_RECOVERY event (fired after code exchange or hash token)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasSession(true)
        setChecking(false)
      }
    })

    const handleRecovery = async () => {
      // Check for error in URL hash (e.g. #error=access_denied&error_code=otp_expired)
      const hash = window.location.hash.slice(1)
      if (hash) {
        const hashParams = new URLSearchParams(hash)
        const hashError = hashParams.get('error')
        const hashErrorCode = hashParams.get('error_code')
        if (hashError || hashErrorCode) {
          const description =
            hashParams.get('error_description')?.replace(/\+/g, ' ') ??
            'This password reset link is invalid or has expired.'
          setLinkExpiredError(description)
          setChecking(false)
          return
        }
      }

      // Check URL query params
      const params = new URLSearchParams(window.location.search)

      // Also check query string for error (some flows put it there)
      const queryError = params.get('error_code') ?? params.get('error')
      if (queryError) {
        const description =
          params.get('error_description')?.replace(/\+/g, ' ') ??
          'This password reset link is invalid or has expired.'
        setLinkExpiredError(description)
        setChecking(false)
        return
      }

      // ── Token hash flow (preferred — POST-based, immune to email scanners) ──
      const tokenHash = params.get('token_hash')
      const tokenType = params.get('type')
      if (tokenHash && tokenType === 'recovery') {
        // Clean URL immediately so token_hash isn't visible / bookmarkable
        window.history.replaceState({}, '', window.location.pathname)
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery',
        })
        if (error) {
          setLinkExpiredError(
            error.message ??
              'This password reset link is invalid or has expired.'
          )
          setChecking(false)
          return
        }
        // verifyOtp fires onAuthStateChange → PASSWORD_RECOVERY, which sets hasSession
        return
      }

      // ── PKCE flow (Supabase SSR / PKCE code exchange) ──
      const code = params.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setLinkExpiredError(
            error.message ??
              'This password reset link is invalid or has expired.'
          )
          setChecking(false)
          return
        }
        // onAuthStateChange above will fire PASSWORD_RECOVERY and set hasSession
        return
      }

      // Fallback: check if there's already an active session (page refresh)
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        setHasSession(true)
      }
      setChecking(false)
    }

    handleRecovery()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Require all password rules to pass
    const failedRules = PASSWORD_REQUIREMENTS.filter(
      (r) => !r.test(newPassword)
    )
    if (failedRules.length > 0) {
      setError(`Missing: ${failedRules.map((r) => r.label).join(', ')}`)
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
      setError(
        'Failed to reset password. The link may have expired. Please request a new one.'
      )
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

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resendEmail) return
    setResendLoading(true)
    try {
      // Use our admin edge function so we never hit Supabase's built-in email
      // rate limit. The function uses generate_link + Resend instead of SMTP.
      const supabase = createClient()
      // Get the Supabase URL to derive the edge function endpoint
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      await fetch(`${supabaseUrl}/functions/v1/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({
          email: resendEmail.trim().toLowerCase(),
          redirectTo: `${window.location.origin}/auth/reset-password/`,
        }),
      })
      // Always show success (edge function always returns 200)
      setResendSent(true)
    } catch (_err) {
      // Always show success to prevent email enumeration
      setResendSent(true)
    } finally {
      setResendLoading(false)
    }
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
              {linkExpiredError ??
                'This password reset link is invalid or has expired.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {resendSent ? (
              <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700 dark:text-green-300">
                  If that email is registered, a new reset link has been sent.
                  Check your inbox (and spam folder).
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleResend} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enter your email to receive a fresh reset link:
                </p>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  required
                  autoFocus
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={resendLoading}
                >
                  {resendLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send New Reset Link'
                  )}
                </Button>
              </form>
            )}
            <div className="text-center">
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="new-password">New Password</Label>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => {
                    const pw = generateStrongPassword()
                    setNewPassword(pw)
                    setConfirmPassword(pw)
                    setShowPassword(true)
                    setShowConfirmPassword(true)
                    navigator.clipboard.writeText(pw)
                  }}
                >
                  <Wand2 className="h-3 w-3" />
                  Generate Strong Password
                </button>
              </div>
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

              {/* Password strength meter */}
              {newPassword && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${getPasswordStrength(newPassword).color}`}
                        style={{
                          width: `${(getPasswordStrength(newPassword).score / 5) * 100}%`,
                        }}
                      />
                    </div>
                    <span
                      className={`min-w-[70px] text-right text-xs font-medium ${
                        getPasswordStrength(newPassword).score <= 2
                          ? 'text-red-500'
                          : getPasswordStrength(newPassword).score <= 3
                            ? 'text-yellow-500'
                            : 'text-green-500'
                      }`}
                    >
                      {getPasswordStrength(newPassword).label}
                    </span>
                  </div>

                  {/* Requirements checklist */}
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {PASSWORD_REQUIREMENTS.map((req) => {
                      const met = req.test(newPassword)
                      return (
                        <div
                          key={req.label}
                          className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}
                        >
                          {met ? (
                            <Check className="h-3 w-3 flex-shrink-0" />
                          ) : (
                            <X className="h-3 w-3 flex-shrink-0" />
                          )}
                          {req.label}
                        </div>
                      )
                    })}
                    <div
                      className={`flex items-center gap-1.5 text-xs ${newPassword.length >= 16 ? 'text-green-600' : 'text-muted-foreground'}`}
                    >
                      {newPassword.length >= 16 ? (
                        <Check className="h-3 w-3 flex-shrink-0" />
                      ) : (
                        <X className="h-3 w-3 flex-shrink-0" />
                      )}
                      16+ characters (bonus)
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={isSubmitting}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirmPassword &&
                newPassword &&
                confirmPassword !== newPassword && (
                  <p className="flex items-center gap-1 text-xs text-red-500">
                    <X className="h-3 w-3" /> Passwords do not match
                  </p>
                )}
              {confirmPassword &&
                newPassword &&
                confirmPassword === newPassword && (
                  <p className="flex items-center gap-1 text-xs text-green-600">
                    <Check className="h-3 w-3" /> Passwords match
                  </p>
                )}
            </div>

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
