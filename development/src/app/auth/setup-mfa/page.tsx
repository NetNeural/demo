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
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function SetupMfaPage() {
  const [authChecking, setAuthChecking] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Auth guard — redirect unauthenticated users to login
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth/login')
      } else {
        // Check if user already has MFA enrolled — if so, skip to dashboard
        supabase.auth.mfa.listFactors().then(({ data: factors }) => {
          const hasVerifiedTotp = factors?.totp?.some(
            (f) => f.status === 'verified'
          )
          if (hasVerifiedTotp) {
            router.replace('/dashboard')
          } else {
            setAuthChecking(false)
            startEnrollment()
          }
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function startEnrollment() {
    try {
      setEnrolling(true)
      setError('')
      const supabase = createClient()

      // Clean up any existing unverified TOTP factors
      const { data: existingFactors } = await supabase.auth.mfa.listFactors()
      if (existingFactors?.totp && existingFactors.totp.length > 0) {
        for (const factor of existingFactors.totp) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: factor.id })
          } catch {
            console.warn(`Failed to clean up factor ${factor.id}`)
          }
        }
      }

      // Enroll a new TOTP factor
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      })
      if (enrollError) {
        setError(`Failed to start 2FA setup: ${enrollError.message}`)
        setEnrolling(false)
        return
      }

      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setFactorId(data.id)
      setEnrolling(false)
    } catch (err) {
      console.error('MFA enrollment error:', err)
      setError('An unexpected error occurred starting 2FA setup.')
      setEnrolling(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId || verifyCode.length !== 6) {
      setError('Please enter the 6-digit code from your authenticator app.')
      return
    }

    try {
      setIsVerifying(true)
      setError('')
      const supabase = createClient()

      // Challenge the factor
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId,
        })
      if (challengeError) {
        setError(`Verification failed: ${challengeError.message}`)
        setIsVerifying(false)
        return
      }

      // Verify with the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      })
      if (verifyError) {
        const isCodeError =
          verifyError.status === 422 ||
          verifyError.message?.toLowerCase().includes('invalid') ||
          verifyError.message?.toLowerCase().includes('code')
        setError(
          isCodeError
            ? 'Invalid code. Make sure you scanned the QR code and the code hasn\'t expired. Codes refresh every 30 seconds.'
            : `Verification failed: ${verifyError.message}`
        )
        setVerifyCode('')
        setIsVerifying(false)
        return
      }

      // Success — MFA is now enrolled and verified
      toast({
        title: '2FA Enabled',
        description:
          "Two-factor authentication is now active. You'll need your authenticator app when signing in.",
      })

      // Check if password change is also required
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: userRecord } = await supabase
          .from('users')
          .select('password_change_required')
          .eq('id', user.id)
          .single()

        if (userRecord?.password_change_required) {
          router.push('/auth/change-password')
          return
        }
      }

      router.push('/dashboard')
      setTimeout(() => router.refresh(), 50)
    } catch (err) {
      console.error('MFA verify error:', err)
      setError('An unexpected error occurred during verification.')
      setIsVerifying(false)
    }
  }

  function handleCopySecret() {
    if (secret) {
      navigator.clipboard.writeText(secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (enrolling) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Setting up two-factor authentication...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-blue-100 p-3">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">
            Set Up Two-Factor Authentication
          </CardTitle>
          <CardDescription className="text-center">
            For your security, two-factor authentication is required. Scan the
            QR code below with your authenticator app.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Use an authenticator app like Google Authenticator, Microsoft
              Authenticator, or Authy to scan the QR code. Then enter the
              6-digit code to verify.
            </AlertDescription>
          </Alert>

          {/* QR Code */}
          {qrCode && (
            <div className="mb-6 flex flex-col items-center">
              <div className="rounded-lg border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrCode}
                  alt="Scan this QR code with your authenticator app"
                  className="h-48 w-48"
                />
              </div>
            </div>
          )}

          {/* Manual Secret */}
          {secret && (
            <div className="mb-6">
              <Label className="text-xs text-muted-foreground">
                Can&apos;t scan? Enter this code manually:
              </Label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">
                  {showSecret ? secret : '••••••••••••••••'}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSecret(!showSecret)}
                  className="shrink-0"
                >
                  {showSecret ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCopySecret}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Verification Form */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify-code">Verification Code</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verifyCode}
                onChange={(e) =>
                  setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="Enter 6-digit code"
                disabled={isVerifying}
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isVerifying || verifyCode.length !== 6}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Verify &amp; Enable 2FA
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
