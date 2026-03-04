'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatPhoneE164, isValidPhoneNumber } from '@/lib/helpers/sms-users'
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
import { useToast } from '@/hooks/use-toast'
import {
  PASSWORD_REQUIREMENTS,
  getPasswordStrength,
  generateStrongPassword,
} from '@/lib/password-utils'

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [phoneNumberSecondary, setPhoneNumberSecondary] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [authChecking, setAuthChecking] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  // Auth guard — redirect unauthenticated users to login
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth/login')
      } else {
        setAuthChecking(false)
      }
    })
  }, [router])

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Require all password rules to pass
    const failedRules = PASSWORD_REQUIREMENTS.filter(
      (r) => !r.test(newPassword)
    )
    if (failedRules.length > 0) {
      setError(`Missing: ${failedRules.map((r) => r.label).join(', ')}`)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!phoneNumber.trim()) {
      setError('Primary phone number is required for SMS notifications')
      return
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      setError('Primary phone number format is invalid')
      return
    }

    if (
      phoneNumberSecondary.trim() &&
      !isValidPhoneNumber(phoneNumberSecondary)
    ) {
      setError('Secondary phone number format is invalid')
      return
    }

    try {
      setIsSubmitting(true)
      const supabase = createClient()

      // Use change-password edge function with forceChange mode
      // (admin API bypass — the client-side supabase.auth.updateUser silently
      // fails when "Secure password change" is enabled in Supabase settings)
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Session expired. Please log in again.')
        setIsSubmitting(false)
        return
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const res = await fetch(`${supabaseUrl}/functions/v1/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          newPassword,
          forceChange: true, // Skip current password — user has temp password
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(
          result?.error || result?.message || 'Failed to change password'
        )
      }

      // Update phone numbers in public.users table
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const normalizedPrimary = formatPhoneE164(phoneNumber.trim())
        const normalizedSecondary = phoneNumberSecondary.trim()
          ? formatPhoneE164(phoneNumberSecondary.trim())
          : null

        if (!normalizedPrimary) {
          setError('Primary phone number format is invalid')
          setIsSubmitting(false)
          return
        }

        if (phoneNumberSecondary.trim() && !normalizedSecondary) {
          setError('Secondary phone number format is invalid')
          setIsSubmitting(false)
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: dbError } = await supabase
          .from('users')
          .update({
            phone_number: normalizedPrimary,
            phone_sms_enabled: true,
            phone_number_secondary: normalizedSecondary,
            phone_secondary_sms_enabled: !!normalizedSecondary,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', user.id)

        if (dbError) {
          console.error('Failed to update phone numbers:', dbError)
          // Don't fail — password was already changed
        }
      }

      toast({
        title: 'Password Changed',
        description: 'Your password has been successfully changed.',
      })

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      console.error('Password change error:', err)
      setError('Failed to change password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-orange-100 p-3">
              <Lock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">
            Change Your Password
          </CardTitle>
          <CardDescription className="text-center">
            You&apos;re using a temporary password. Please create a new secure
            password to continue.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your password must be at least 12 characters and include
              uppercase, lowercase, numbers, and special characters. A primary
              SMS phone number is required to continue.
            </AlertDescription>
          </Alert>

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
                    toast({
                      title: 'Password generated',
                      description:
                        'Strong password generated and copied to clipboard. Save it in your password manager!',
                    })
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

            <div className="space-y-2">
              <Label htmlFor="phone-number">Primary SMS Phone Number</Label>
              <Input
                id="phone-number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+15551234567"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone-number-secondary">
                Secondary SMS Phone Number (Optional)
              </Label>
              <Input
                id="phone-number-secondary"
                type="tel"
                value={phoneNumberSecondary}
                onChange={(e) => setPhoneNumberSecondary(e.target.value)}
                placeholder="+15559876543"
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                'Changing Password...'
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Change Password
                </>
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            For security reasons, you cannot skip this step.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
