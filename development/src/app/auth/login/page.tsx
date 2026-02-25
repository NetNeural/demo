'use client'

import {
  useState,
  useEffect,
  useRef,
  Suspense,
  useMemo,
  useCallback,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { auditLogin, auditLoginFailed } from '@/lib/audit-client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Wifi,
  Radio,
  Cpu,
  Zap,
  Shield,
  Activity,
  Eye,
  EyeOff,
  Lock,
  type LucideIcon,
} from 'lucide-react'

// ─── Org branding type ────────────────────────────────────────────────
interface OrgBranding {
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  loginPage?: {
    backgroundUrl?: string | null
    backgroundColor?: string | null
    backgroundFit?: 'cover' | 'contain' | 'fill' | 'center' | null
    backgroundPosition?: { x: number; y: number }
    backgroundPositionMobile?: { x: number; y: number }
    headline?: string | null
    subtitle?: string | null
    cardOpacity?: number | null
    showLogo?: boolean
    enhanceBg?: boolean
    showAnimatedBg?: boolean
  }
}

const DEFAULT_BRANDING = {
  name: 'NetNeural',
  primaryColor: '#06b6d4', // cyan-500
  secondaryColor: '#8b5cf6', // violet-500
  accentColor: '#10b981', // emerald-500
}

// ─── Animated background node ─────────────────────────────────────────
interface FloatingNode {
  id: number
  x: number
  y: number
  size: number
  speed: number
  delay: number
  icon: number
}

function generateNodes(count: number): FloatingNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 16 + Math.random() * 20,
    speed: 20 + Math.random() * 40,
    delay: Math.random() * -20,
    icon: i % 6,
  }))
}

const NODE_ICONS: LucideIcon[] = [Wifi, Radio, Cpu, Zap, Shield, Activity]

// ─── Main login component ─────────────────────────────────────────────
function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Form state
  const [email, setEmail] = useState(
    process.env.NODE_ENV === 'development' ? 'admin@netneural.ai' : ''
  )
  const [password, setPassword] = useState(
    process.env.NODE_ENV === 'development' ? 'password123' : ''
  )
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const hasCheckedAuth = useRef(false)

  // MFA challenge state
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)

  // Branding state
  const [branding, setBranding] = useState<OrgBranding | null>(null)
  const [brandingLoaded, setBrandingLoaded] = useState(false)

  const orgSlug = searchParams?.get('org') || null

  // Fetch org branding — always load branding (default to netneural-demo when no ?org= param)
  useEffect(() => {
    const slug = orgSlug || 'netneural-demo'
    const fetchBranding = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const res = await fetch(
          `${supabaseUrl}/functions/v1/org-branding?slug=${encodeURIComponent(slug)}`,
          { headers: { 'Content-Type': 'application/json' } }
        )
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.data) {
            setBranding(json.data)
          }
        }
      } catch (err) {
        console.error('Failed to fetch org branding:', err)
      } finally {
        setBrandingLoaded(true)
      }
    }
    fetchBranding()
  }, [orgSlug])

  // Resolved colors (org branding → defaults)
  const colors = useMemo(
    () => ({
      primary: branding?.primaryColor || DEFAULT_BRANDING.primaryColor,
      secondary: branding?.secondaryColor || DEFAULT_BRANDING.secondaryColor,
      accent: branding?.accentColor || DEFAULT_BRANDING.accentColor,
    }),
    [branding]
  )

  const orgName = branding?.name || DEFAULT_BRANDING.name
  const logoUrl = branding?.logoUrl || null

  // Login page appearance
  const loginPage = branding?.loginPage
  const bgUrl = loginPage?.backgroundUrl || null
  const bgColor = loginPage?.backgroundColor || '#030712'
  const bgFit = loginPage?.backgroundFit || 'cover'
  const bgPosDesktop = loginPage?.backgroundPosition || { x: 50, y: 50 }
  const bgPosMobile = loginPage?.backgroundPositionMobile || bgPosDesktop
  const headline = loginPage?.headline || null
  const subtitle = loginPage?.subtitle || null
  const cardOpacity = loginPage?.cardOpacity ?? 70
  const showLogo = loginPage?.showLogo !== false
  const enhanceBg = loginPage?.enhanceBg === true
  const showAnimatedBg = loginPage?.showAnimatedBg !== false

  // Floating nodes for background animation
  const nodes = useMemo(() => generateNodes(12), [])

  // Error from URL
  useEffect(() => {
    const errorParam = searchParams?.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (orgSlug ? `?org=${orgSlug}` : '')
      )
    }
  }, [searchParams, orgSlug])

  // Auth check
  useEffect(() => {
    if (hasCheckedAuth.current) return
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()
        if (sessionError || !session) {
          hasCheckedAuth.current = true
          return
        }
        if (session) {
          hasCheckedAuth.current = true
          router.replace('/dashboard')
        }
      } catch {
        hasCheckedAuth.current = true
      }
    }
    checkAuth()
  }, [router])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setIsLoading(true)
      setError('')

      try {
        const supabase = createClient()
        const { data, error: loginError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })

        if (loginError) {
          auditLoginFailed(email.trim(), loginError.message)
          setError('Invalid email or password. Please try again.')
          setIsLoading(false)
          return
        }
        if (!data.user) {
          setError('Login failed — please try again')
          setIsLoading(false)
          return
        }

        if (!rememberMe && data.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          })
        }

        // Check if MFA is required
        const { data: aal } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
          // User has MFA enrolled — need verification
          const { data: factors } = await supabase.auth.mfa.listFactors()
          const totpFactor = factors?.totp?.find((f) => f.status === 'verified')
          if (totpFactor) {
            setMfaFactorId(totpFactor.id)
            setMfaRequired(true)
            setIsLoading(false)
            return
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 100))
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          hasCheckedAuth.current = true

          // Audit log the successful login
          auditLogin(data.user.id, data.user.email || email.trim(), {
            mfa: false,
            remember_me: rememberMe,
          })

          // Check password change requirement before navigating (fixes mobile race condition)
          const { data: userRecord } = await supabase
            .from('users')
            .select('password_change_required')
            .eq('id', data.user.id)
            .single()

          if (userRecord?.password_change_required) {
            router.push('/auth/change-password')
            return
          }

          router.push('/dashboard')
          setTimeout(() => router.refresh(), 50)
        } else {
          setError('Session could not be established. Please try again.')
          setIsLoading(false)
        }
      } catch {
        setError('An unexpected error occurred. Please try again.')
        setIsLoading(false)
      }
    },
    [email, password, rememberMe, router]
  )

  const handleMfaVerify = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!mfaFactorId || mfaCode.length !== 6) {
        setError('Please enter the 6-digit code from your authenticator app.')
        return
      }
      setMfaVerifying(true)
      setError('')

      try {
        const supabase = createClient()

        const { data: challengeData, error: challengeError } =
          await supabase.auth.mfa.challenge({
            factorId: mfaFactorId,
          })
        if (challengeError) {
          setError(`Verification failed: ${challengeError.message}`)
          setMfaVerifying(false)
          return
        }

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId: mfaFactorId,
          challengeId: challengeData.id,
          code: mfaCode,
        })
        if (verifyError) {
          setError('Invalid verification code. Please try again.')
          setMfaCode('')
          setMfaVerifying(false)
          return
        }

        // MFA verified — check password change requirement before navigating
        hasCheckedAuth.current = true

        const {
          data: { user: mfaUser },
        } = await supabase.auth.getUser()
        if (mfaUser) {
          // Audit log the successful MFA login
          auditLogin(mfaUser.id, mfaUser.email || email.trim(), {
            mfa: true,
          })

          const { data: mfaUserRecord } = await supabase
            .from('users')
            .select('password_change_required')
            .eq('id', mfaUser.id)
            .single()

          if (mfaUserRecord?.password_change_required) {
            router.push('/auth/change-password')
            return
          }
        }

        router.push('/dashboard')
        setTimeout(() => router.refresh(), 50)
      } catch {
        setError('An unexpected error occurred during verification.')
        setMfaVerifying(false)
      }
    },
    [mfaFactorId, mfaCode, router]
  )

  // Don't render until branding is resolved (prevents flash)
  if (!brandingLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="animate-pulse text-lg text-cyan-400">Loading...</div>
      </div>
    )
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      {/* ───── Background image (if configured) ───── */}
      {bgUrl && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Desktop background */}
          <img
            src={bgUrl}
            alt=""
            className={`hidden h-full w-full md:block ${
              bgFit === 'cover' ? 'object-cover' :
              bgFit === 'contain' ? 'object-contain' :
              bgFit === 'fill' ? 'object-fill' :
              'object-none'
            }`}
            style={{
              objectPosition: `${bgPosDesktop.x}% ${bgPosDesktop.y}%`,
              ...(enhanceBg ? { filter: 'brightness(1.08) contrast(1.12) saturate(1.25)' } : {}),
              minHeight: '100vh',
              minWidth: '100vw',
            }}
          />
          {/* Mobile background */}
          <img
            src={bgUrl}
            alt=""
            className={`block h-full w-full md:hidden ${
              bgFit === 'cover' ? 'object-cover' :
              bgFit === 'contain' ? 'object-contain' :
              bgFit === 'fill' ? 'object-fill' :
              'object-none'
            }`}
            style={{
              objectPosition: `${bgPosMobile.x}% ${bgPosMobile.y}%`,
              ...(enhanceBg ? { filter: 'brightness(1.08) contrast(1.12) saturate(1.25)' } : {}),
              minHeight: '100vh',
              minWidth: '100vw',
            }}
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* ───── Animated mesh background ───── */}
      {showAnimatedBg && (
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Gradient orbs */}
        <div
          className="absolute h-[600px] w-[600px] animate-pulse rounded-full opacity-20 blur-[128px]"
          style={{
            background: `radial-gradient(circle, ${colors.primary}, transparent)`,
            top: '-10%',
            left: '-10%',
            animationDuration: '8s',
          }}
        />
        <div
          className="absolute h-[500px] w-[500px] animate-pulse rounded-full opacity-15 blur-[128px]"
          style={{
            background: `radial-gradient(circle, ${colors.secondary}, transparent)`,
            bottom: '-10%',
            right: '-10%',
            animationDuration: '10s',
            animationDelay: '-3s',
          }}
        />
        <div
          className="absolute h-[400px] w-[400px] animate-pulse rounded-full opacity-10 blur-[100px]"
          style={{
            background: `radial-gradient(circle, ${colors.accent}, transparent)`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            animationDuration: '12s',
            animationDelay: '-6s',
          }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(${colors.primary}40 1px, transparent 1px), linear-gradient(90deg, ${colors.primary}40 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating IoT node icons */}
        {nodes.map((node) => {
          const IconComponent = NODE_ICONS[node.icon] as LucideIcon
          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                opacity: 0.06,
                animation: `nnFloat ${node.speed}s linear infinite`,
                animationDelay: `${node.delay}s`,
              }}
            >
              <IconComponent
                style={{
                  width: node.size,
                  height: node.size,
                  color: colors.primary,
                }}
              />
            </div>
          )
        })}
      </div>
      )}

      {/* ───── Content ───── */}
      <div className="relative z-10 mx-4 w-full max-w-md sm:mx-auto">
        {/* Brand header */}
        <div className="mb-6 sm:mb-8 text-center">
          {showLogo && (
            logoUrl ? (
              <div className="mb-3 sm:mb-4 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt={`${orgName} logo`}
                  className="h-12 sm:h-16 w-auto object-contain drop-shadow-lg"
                />
              </div>
            ) : (
              <div className="mb-3 sm:mb-4 flex justify-center">
                <div
                  className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                    boxShadow: `0 8px 32px ${colors.primary}30`,
                  }}
                >
                  <Activity className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                </div>
              </div>
            )
          )}
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ color: colors.primary }}
          >
            {headline || orgName}
          </h1>
          <p className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-gray-300">
            {subtitle || (branding ? 'Sentinel' : 'Sentinel by NetNeural')}
          </p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl border p-6 sm:p-8 shadow-2xl backdrop-blur-xl"
          style={{
            background: `rgba(15, 23, 42, ${cardOpacity / 100})`,
            borderColor: `${colors.primary}20`,
            boxShadow: `0 0 80px ${colors.primary}08, 0 25px 50px rgba(0,0,0,0.4)`,
          }}
        >
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-gray-100">
              {mfaRequired ? 'Two-Factor Authentication' : 'Welcome back'}
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              {mfaRequired
                ? 'Enter the code from your authenticator app'
                : 'Sign in to continue'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <Alert
              variant="destructive"
              className="mb-6 border-red-800/60 bg-red-950/60"
            >
              <AlertDescription>
                <div className="flex items-start justify-between text-red-200">
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
                        setMfaRequired(false)
                        setMfaCode('')
                        setMfaFactorId(null)
                      }}
                      className="ml-2 h-auto px-2 py-0 text-xs text-red-300 hover:text-white"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {mfaRequired ? (
            /* ── MFA Verification Form ── */
            <form onSubmit={handleMfaVerify}>
              <div className="mb-6">
                <div className="mb-4 flex justify-center">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: `${colors.primary}20` }}
                  >
                    <Shield
                      className="h-6 w-6"
                      style={{ color: colors.primary }}
                    />
                  </div>
                </div>
                <label
                  className="mb-1.5 block text-center text-sm font-medium text-gray-300"
                  htmlFor="mfa-code"
                >
                  Verification Code
                </label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  value={mfaCode}
                  onChange={(e) =>
                    setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  autoComplete="one-time-code"
                  autoFocus
                  className="w-full rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-4 text-center font-mono text-2xl tracking-[0.5em] text-gray-100 transition-all placeholder:text-gray-500 focus:outline-none focus:ring-2"
                  style={{
                    ['--tw-ring-color' as string]: `${colors.primary}80`,
                  }}
                />
              </div>

              <Button
                type="submit"
                disabled={mfaVerifying || mfaCode.length !== 6}
                className="h-12 w-full rounded-lg text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  boxShadow: `0 4px 20px ${colors.primary}30`,
                }}
              >
                {mfaVerifying ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Verify & Sign In
                  </span>
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setMfaRequired(false)
                  setMfaFactorId(null)
                  setMfaCode('')
                  setError('')
                  // Sign out the partial session
                  const supabase = createClient()
                  supabase.auth.signOut()
                }}
                className="mt-3 w-full text-center text-sm text-gray-500 transition-colors hover:text-gray-300"
              >
                ← Back to sign in
              </button>
            </form>
          ) : (
            /* ── Normal Login Form ── */
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div className="mb-4">
                <label
                  className="mb-1.5 block text-sm font-medium text-gray-300"
                  htmlFor="email"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  className="w-full rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-3 text-gray-100 transition-all placeholder:text-gray-500 focus:outline-none focus:ring-2"
                  style={{
                    ['--tw-ring-color' as string]: `${colors.primary}80`,
                  }}
                />
              </div>

              {/* Password */}
              <div className="mb-4">
                <label
                  className="mb-1.5 block text-sm font-medium text-gray-300"
                  htmlFor="password"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-gray-700/60 bg-gray-800/60 px-4 py-3 pr-12 text-gray-100 transition-all placeholder:text-gray-500 focus:outline-none focus:ring-2"
                    style={{
                      ['--tw-ring-color' as string]: `${colors.primary}80`,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-200"
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

              {/* Remember me */}
              <div className="mb-6 flex items-center">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 data-[state=checked]:border-cyan-500 data-[state=checked]:bg-cyan-500"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 cursor-pointer text-sm text-gray-400"
                >
                  Keep me signed in
                </label>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="h-12 w-full rounded-lg text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  boxShadow: `0 4px 20px ${colors.primary}30`,
                }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Sign in
                  </span>
                )}
              </Button>
            </form>
          )}

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-gray-500">
            Forgot your password? Contact your system administrator
          </p>
        </div>

        {/* Security badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Shield className="h-3.5 w-3.5" style={{ color: colors.accent }} />
          <span>Enterprise-grade security</span>
          <span className="text-gray-700">•</span>
          <span>256-bit encryption</span>
        </div>

        {/* Powered by (only for org-branded logins) */}
        {branding && (
          <p className="mt-3 text-center text-[11px] text-gray-600">
            Powered by{' '}
            <span className="font-medium text-gray-400">NetNeural</span>
          </p>
        )}

        {/* Dev helper */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/80 p-3 text-xs text-gray-400">
            <strong className="text-cyan-400">Dev Mode</strong> — Test accounts:
            <div className="mt-1 space-y-0.5 text-gray-500">
              <div>superadmin@netneural.ai / admin@netneural.ai</div>
              <div>user@netneural.ai / viewer@netneural.ai</div>
              <div className="text-gray-600">Password: password123</div>
            </div>
          </div>
        )}
      </div>

      {/* ───── Animation keyframes ───── */}
      <style>{`
        @keyframes nnFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          25% { transform: translateY(-20px) rotate(5deg); }
          50% { transform: translateY(-10px) rotate(-3deg); }
          75% { transform: translateY(-25px) rotate(2deg); }
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-950">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-cyan-500" />
            <p className="mt-4 text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
