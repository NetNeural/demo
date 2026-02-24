'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  formatPhoneE164,
  isValidPhoneNumber,
} from '@/lib/helpers/sms-users'
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
import { Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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

    // Validation
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
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

      // Update password in Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        throw updateError
      }

      // Update password_change_required flag in public.users table
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
            password_change_required: false,
            phone_number: normalizedPrimary,
            phone_sms_enabled: true,
            phone_number_secondary: normalizedSecondary,
            phone_secondary_sms_enabled: !!normalizedSecondary,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', user.id)

        if (dbError) {
          console.error(
            'Failed to update password_change_required flag:',
            dbError
          )
          // Don't fail the operation, password was still changed
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
              Your password must be at least 8 characters and include uppercase,
              lowercase, numbers, and special characters. A primary SMS phone
              number is required to continue.
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={isSubmitting}
                required
              />
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
