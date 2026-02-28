'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  Key,
  Smartphone,
  Clock,
  Trash2,
  Copy,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  Wand2,
  Check,
  X,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface Session {
  id: string
  device: string
  location: string
  lastActive: string
  current: boolean
}

interface ApiKey {
  id: string
  name: string
  key: string
  created: string
  lastUsed: string
}

// ─── Password strength utilities ────────────────────────────────────
interface PasswordRequirement {
  label: string
  test: (pw: string) => boolean
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  { label: 'At least 12 characters', test: (pw) => pw.length >= 12 },
  { label: 'Uppercase letter (A-Z)', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter (a-z)', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Number (0-9)', test: (pw) => /[0-9]/.test(pw) },
  {
    label: 'Special character (!@#$...)',
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
]

function getPasswordStrength(pw: string): {
  score: number
  label: string
  color: string
} {
  if (!pw) return { score: 0, label: '', color: '' }
  const passed = PASSWORD_REQUIREMENTS.filter((r) => r.test(pw)).length
  // Bonus for length
  const lengthBonus = pw.length >= 16 ? 1 : 0
  const total = passed + lengthBonus
  if (total <= 1) return { score: 1, label: 'Very Weak', color: 'bg-red-500' }
  if (total <= 2) return { score: 2, label: 'Weak', color: 'bg-orange-500' }
  if (total <= 3) return { score: 3, label: 'Fair', color: 'bg-yellow-500' }
  if (total <= 4) return { score: 4, label: 'Strong', color: 'bg-blue-500' }
  return { score: 5, label: 'Very Strong', color: 'bg-green-500' }
}

function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '!@#$%&*_+-='
  const all = upper + lower + digits + special

  // Guarantee at least one of each category
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]!
  const required = [pick(upper), pick(lower), pick(digits), pick(special)]

  // Fill to 20 characters
  const remaining = Array.from({ length: 16 }, () => pick(all))
  const chars = [...required, ...remaining]

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.join('')
}

export function SecurityTab() {
  const { toast } = useToast()
  const { fmt } = useDateFormatter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  // 2FA state
  const [mfaLoading, setMfaLoading] = useState(true)
  const [mfaEnrolled, setMfaEnrolled] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollQrCode, setEnrollQrCode] = useState<string | null>(null)
  const [enrollSecret, setEnrollSecret] = useState<string | null>(null)
  const [enrollFactorId, setEnrollFactorId] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [unenrolling, setUnenrolling] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  const [sessions, setSessions] = useState<Session[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])

  // Load active sessions from Supabase
  useEffect(() => {
    const loadSessions = async () => {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        // Parse browser and OS from user agent
        const ua = navigator.userAgent
        let browser = 'Unknown Browser'
        if (ua.includes('Edg/')) browser = 'Edge'
        else if (ua.includes('Chrome/')) browser = 'Chrome'
        else if (ua.includes('Firefox/')) browser = 'Firefox'
        else if (ua.includes('Safari/')) browser = 'Safari'

        let os = 'Unknown OS'
        if (ua.includes('Win')) os = 'Windows'
        else if (ua.includes('Mac')) os = 'macOS'
        else if (ua.includes('Linux')) os = 'Linux'
        else if (ua.includes('Android')) os = 'Android'
        else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'

        // Calculate session age from token issued time
        const tokenIssuedAt = session.expires_at
          ? new Date((session.expires_at - 3600) * 1000) // expires_at minus 1 hour default TTL
          : null

        const signedInText = tokenIssuedAt
          ? `Signed in ${fmt.timeAgo(tokenIssuedAt)}`
          : 'Active now'

        const currentSession: Session = {
          id: session.access_token.substring(0, 10),
          device: `${browser} on ${os}`,
          location: signedInText,
          lastActive: 'Active now',
          current: true,
        }
        setSessions([currentSession])
      }
    }

    loadSessions()
  }, [])

  // Check MFA enrollment status on mount
  const checkMfaStatus = useCallback(async () => {
    try {
      setMfaLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error) {
        console.error('Failed to list MFA factors:', error)
        return
      }
      // Find verified TOTP factor
      const verified = data.totp.find((f) => f.status === 'verified')
      if (verified) {
        setMfaEnrolled(true)
        setMfaFactorId(verified.id)
      } else {
        setMfaEnrolled(false)
        setMfaFactorId(null)
      }
    } catch (err) {
      console.error('MFA status check error:', err)
    } finally {
      setMfaLoading(false)
    }
  }, [])

  useEffect(() => {
    checkMfaStatus()
  }, [checkMfaStatus])

  // Load API keys from Supabase (stored in a custom api_keys table)
  // Load API keys from database
  useEffect(() => {
    const loadApiKeys = async () => {
      // Note: The api_keys table needs to be added to the database schema
      // For now, showing empty state
      // TODO: Add api_keys table migration with columns: id, user_id, name, key_prefix, key_suffix, created_at, last_used_at
      setApiKeys([])
    }

    loadApiKeys()
  }, [])

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive',
      })
      return
    }
    if (!currentPassword || !newPassword) {
      toast({
        title: 'Error',
        description: 'Please fill in all password fields',
        variant: 'destructive',
      })
      return
    }
    // Require all password rules to pass
    const failedRules = PASSWORD_REQUIREMENTS.filter(
      (r) => !r.test(newPassword)
    )
    if (failedRules.length > 0) {
      toast({
        title: 'Password too weak',
        description: `Missing: ${failedRules.map((r) => r.label).join(', ')}`,
        variant: 'destructive',
      })
      return
    }
    if (newPassword === currentPassword) {
      toast({
        title: 'Error',
        description: 'New password must be different from current password',
        variant: 'destructive',
      })
      return
    }

    try {
      setChangingPassword(true)
      const supabase = createClient()

      // First verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email || '',
        password: currentPassword,
      })

      if (verifyError) {
        toast({
          title: 'Error',
          description: 'Current password is incorrect',
          variant: 'destructive',
        })
        return
      }

      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (updateError) {
        toast({
          title: 'Error',
          description: 'Failed to update password: ' + updateError.message,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Success',
        description: 'Password updated successfully!',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    } catch (err) {
      console.error('Error changing password:', err)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setChangingPassword(false)
    }
  }

  const handleRevokeSession = (sessionId: string) => {
    setSessions(sessions.filter((s) => s.id !== sessionId))
    toast({
      title: 'Session Revoked',
      description: 'The session has been successfully revoked',
    })
  }

  const handleRevokeApiKey = (keyId: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== keyId))
    toast({
      title: 'API Key Revoked',
      description: 'The API key has been successfully revoked',
    })
  }

  const handleCreateApiKey = () => {
    const newKey: ApiKey = {
      id: `key${apiKeys.length + 1}`,
      name: 'New API Key',
      key: `nn_live_${Math.random().toString(36).substring(2, 15)}`,
      created: new Date().toISOString().split('T')[0] || '',
      lastUsed: 'Never',
    }
    setApiKeys([...apiKeys, newKey])
    toast({
      title: 'API Key Created',
      description:
        "New API key has been created. Copy it now - it won't be shown again!",
    })
  }

  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast({
      title: 'Copied',
      description: 'API key copied to clipboard',
    })
  }

  const handleToggle2FA = async (checked: boolean) => {
    if (checked) {
      // Start MFA enrollment
      try {
        setEnrolling(true)
        const supabase = createClient()

        // Clean up ALL existing TOTP factors before enrolling a new one.
        // Supabase returns 422 if any factor (verified or unverified) already exists.
        // This handles: re-enrollment after disable, stale unverified factors, etc.
        const { data: existingFactors } =
          await supabase.auth.mfa.listFactors()
        if (existingFactors?.totp && existingFactors.totp.length > 0) {
          for (const factor of existingFactors.totp) {
            try {
              await supabase.auth.mfa.unenroll({ factorId: factor.id })
            } catch {
              // Continue cleaning up remaining factors even if one fails
              console.warn(`Failed to clean up factor ${factor.id}`)
            }
          }
          // Update local state since we removed everything
          setMfaEnrolled(false)
          setMfaFactorId(null)
        }

        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Authenticator App',
        })
        if (error) {
          toast({
            title: 'Error',
            description: `Failed to start 2FA setup: ${error.message}`,
            variant: 'destructive',
          })
          setEnrolling(false)
          return
        }
        setEnrollQrCode(data.totp.qr_code)
        setEnrollSecret(data.totp.secret)
        setEnrollFactorId(data.id)
      } catch (err) {
        console.error('MFA enroll error:', err)
        toast({
          title: 'Error',
          description: 'An unexpected error occurred starting 2FA setup.',
          variant: 'destructive',
        })
        setEnrolling(false)
      }
    } else {
      // Unenroll MFA — remove ALL TOTP factors to ensure clean state
      try {
        setUnenrolling(true)
        const supabase = createClient()

        // List and remove all TOTP factors, not just the one in state
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totpFactors = factors?.totp || []

        if (totpFactors.length === 0 && !mfaFactorId) {
          // Nothing to unenroll
          setMfaEnrolled(false)
          setMfaFactorId(null)
          toast({
            title: '2FA Disabled',
            description: 'Two-factor authentication has been removed from your account.',
          })
          return
        }

        let anyError: Error | null = null
        for (const factor of totpFactors) {
          const { error } = await supabase.auth.mfa.unenroll({
            factorId: factor.id,
          })
          if (error) {
            anyError = error
            console.error(`Failed to unenroll factor ${factor.id}:`, error)
          }
        }

        // Also try the tracked factor if it wasn't in the list
        if (mfaFactorId && !totpFactors.some((f) => f.id === mfaFactorId)) {
          const { error } = await supabase.auth.mfa.unenroll({
            factorId: mfaFactorId,
          })
          if (error) anyError = error
        }

        if (anyError && totpFactors.length > 0) {
          toast({
            title: 'Error',
            description: `Failed to disable 2FA: ${anyError.message}`,
            variant: 'destructive',
          })
          return
        }

        setMfaEnrolled(false)
        setMfaFactorId(null)
        toast({
          title: '2FA Disabled',
          description:
            'Two-factor authentication has been removed from your account.',
        })
      } catch (err) {
        console.error('MFA unenroll error:', err)
        toast({
          title: 'Error',
          description: 'An unexpected error occurred removing 2FA.',
          variant: 'destructive',
        })
      } finally {
        setUnenrolling(false)
      }
    }
  }

  const handleVerifyEnrollment = async () => {
    if (!enrollFactorId || verifyCode.length !== 6) {
      toast({
        title: 'Error',
        description:
          'Please enter the 6-digit code from your authenticator app.',
        variant: 'destructive',
      })
      return
    }
    try {
      setVerifying(true)
      const supabase = createClient()

      // Challenge the factor first
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId: enrollFactorId,
        })
      if (challengeError) {
        toast({
          title: 'Error',
          description: `Challenge failed: ${challengeError.message}`,
          variant: 'destructive',
        })
        return
      }

      // Verify with the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollFactorId,
        challengeId: challengeData.id,
        code: verifyCode,
      })
      if (verifyError) {
        const isCodeError =
          verifyError.status === 422 ||
          verifyError.message?.toLowerCase().includes('invalid') ||
          verifyError.message?.toLowerCase().includes('code')
        toast({
          title: isCodeError ? 'Invalid Code' : 'Verification Failed',
          description: isCodeError
            ? 'The code was incorrect. Make sure you scanned the NEW QR code above (not an old entry) and that the code hasn\'t expired. Codes refresh every 30 seconds.'
            : `Verification failed: ${verifyError.message}`,
          variant: 'destructive',
        })
        return
      }

      // Success
      setMfaEnrolled(true)
      setMfaFactorId(enrollFactorId)
      setEnrolling(false)
      setEnrollQrCode(null)
      setEnrollSecret(null)
      setEnrollFactorId(null)
      setVerifyCode('')
      setShowSecret(false)
      toast({
        title: '2FA Enabled',
        description:
          "Two-factor authentication is now active. You'll need your authenticator app when signing in.",
      })
    } catch (err) {
      console.error('MFA verify error:', err)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred during verification.',
        variant: 'destructive',
      })
    } finally {
      setVerifying(false)
    }
  }

  const handleCancelEnrollment = async () => {
    // Unenroll the unverified factor to clean up
    if (enrollFactorId) {
      try {
        const supabase = createClient()
        await supabase.auth.mfa.unenroll({ factorId: enrollFactorId })
      } catch {
        // Ignore cleanup errors
      }
    }
    setEnrolling(false)
    setEnrollQrCode(null)
    setEnrollSecret(null)
    setEnrollFactorId(null)
    setVerifyCode('')
    setShowSecret(false)
  }

  return (
    <div className="space-y-6">
      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-password">New Password</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const pw = generateStrongPassword()
                  setNewPassword(pw)
                  setConfirmPassword(pw)
                  setShowNewPassword(true)
                  setShowConfirmPassword(true)
                  navigator.clipboard.writeText(pw)
                  toast({
                    title: 'Password generated',
                    description:
                      'Strong password generated and copied to clipboard. Save it in your password manager!',
                  })
                }}
              >
                <Wand2 className="mr-1 h-3 w-3" />
                Generate Strong Password
              </Button>
            </div>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showNewPassword ? (
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
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
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

          <Button
            onClick={handleChangePassword}
            disabled={
              changingPassword ||
              !currentPassword ||
              !newPassword ||
              !confirmPassword ||
              newPassword !== confirmPassword
            }
          >
            {changingPassword ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Changing...
              </>
            ) : (
              'Change Password'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {mfaLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking 2FA status...
            </div>
          ) : enrolling && enrollQrCode ? (
            /* ── Enrollment flow: QR code + verify ── */
            <div className="space-y-4">
              <div className="space-y-4 rounded-lg bg-muted p-4">
                <div className="flex items-start gap-2">
                  <Smartphone className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium">Setup Instructions</p>
                    <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                      <li>
                        Open your authenticator app (Google Authenticator,
                        Authy, 1Password, etc.)
                      </li>
                      <li>
                        Scan the QR code below, or enter the setup key manually
                      </li>
                      <li>
                        Enter the 6-digit code shown in the app to confirm
                      </li>
                    </ol>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex justify-center py-4">
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={enrollQrCode}
                      alt="Scan this QR code with your authenticator app"
                      width={200}
                      height={200}
                    />
                  </div>
                </div>

                {/* Manual setup key */}
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? 'Hide' : 'Show'} Setup Key
                  </Button>
                  {showSecret && enrollSecret && (
                    <div className="flex items-center gap-2">
                      <code className="rounded border bg-background px-3 py-2 font-mono text-xs tracking-wider">
                        {enrollSecret}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(enrollSecret)
                          toast({
                            title: 'Copied',
                            description: 'Setup key copied to clipboard',
                          })
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Verification input */}
                <div className="space-y-2 border-t pt-2">
                  <Label htmlFor="verify-code">
                    Enter 6-digit code from your app
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="verify-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={verifyCode}
                      onChange={(e) =>
                        setVerifyCode(
                          e.target.value.replace(/\D/g, '').slice(0, 6)
                        )
                      }
                      className="w-32 text-center font-mono text-lg tracking-widest"
                      autoComplete="one-time-code"
                    />
                    <Button
                      onClick={handleVerifyEnrollment}
                      disabled={verifying || verifyCode.length !== 6}
                    >
                      {verifying ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Verify & Enable
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEnrollment}
              >
                Cancel Setup
              </Button>
            </div>
          ) : (
            /* ── Normal state: toggle on/off ── */
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="2fa">Enable 2FA</Label>
                  <p className="text-sm text-muted-foreground">
                    Require a verification code from your phone when signing in
                  </p>
                </div>
                <Switch
                  id="2fa"
                  checked={mfaEnrolled}
                  onCheckedChange={handleToggle2FA}
                  disabled={unenrolling}
                />
              </div>

              {mfaEnrolled && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Shield className="h-4 w-4" />
                  Two-factor authentication is enabled
                  {unenrolling && (
                    <Loader2 className="ml-1 h-3 w-3 animate-spin" />
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage your active sessions across different devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-start gap-3">
                  <Smartphone className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{session.device}</p>
                      {session.current && (
                        <Badge variant="default" className="text-xs">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {session.location}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last active: {session.lastActive}
                    </p>
                  </div>
                </div>
                {!session.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevokeSession(session.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription>
                Manage your personal API keys for integrations
              </CardDescription>
            </div>
            <Button onClick={handleCreateApiKey} size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Create New Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{apiKey.name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      {apiKey.key}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyApiKey(apiKey.key)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span>Created: {apiKey.created}</span>
                    <span>Last used: {apiKey.lastUsed}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevokeApiKey(apiKey.id)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Revoke
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Keep your API keys secure and never share them publicly. Revoke
              any keys that may have been compromised.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
