'use client'

import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Wifi, Radio, Cpu, Zap, Shield, Activity, Eye, EyeOff, Lock, type LucideIcon } from 'lucide-react'

// ─── Org branding type ────────────────────────────────────────────────
interface OrgBranding {
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
}

const DEFAULT_BRANDING = {
  name: 'NetNeural',
  primaryColor: '#06b6d4',   // cyan-500
  secondaryColor: '#8b5cf6', // violet-500
  accentColor: '#10b981',    // emerald-500
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
  const [email, setEmail] = useState(process.env.NODE_ENV === 'development' ? 'admin@netneural.ai' : '')
  const [password, setPassword] = useState(process.env.NODE_ENV === 'development' ? 'password123' : '')
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
  const colors = useMemo(() => ({
    primary: branding?.primaryColor || DEFAULT_BRANDING.primaryColor,
    secondary: branding?.secondaryColor || DEFAULT_BRANDING.secondaryColor,
    accent: branding?.accentColor || DEFAULT_BRANDING.accentColor,
  }), [branding])

  const orgName = branding?.name || DEFAULT_BRANDING.name
  const logoUrl = branding?.logoUrl || null

  // Floating nodes for background animation
  const nodes = useMemo(() => generateNodes(12), [])

  // Error from URL
  useEffect(() => {
    const errorParam = searchParams?.get('error')
    if (errorParam) {
      setError(decodeURIComponent(errorParam))
      window.history.replaceState({}, '', window.location.pathname + (orgSlug ? `?org=${orgSlug}` : ''))
    }
  }, [searchParams, orgSlug])

  // Auth check
  useEffect(() => {
    if (hasCheckedAuth.current) return
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session) { hasCheckedAuth.current = true; return }
        if (session) { hasCheckedAuth.current = true; router.replace('/dashboard') }
      } catch {
        hasCheckedAuth.current = true
      }
    }
    checkAuth()
  }, [router])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (loginError) { setError('Invalid email or password. Please try again.'); setIsLoading(false); return }
      if (!data.user) { setError('Login failed — please try again'); setIsLoading(false); return }

      if (!rememberMe && data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      // Check if MFA is required
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
        // User has MFA enrolled — need verification
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const totpFactor = factors?.totp?.find(f => f.status === 'verified')
        if (totpFactor) {
          setMfaFactorId(totpFactor.id)
          setMfaRequired(true)
          setIsLoading(false)
          return
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100))
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        hasCheckedAuth.current = true
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
  }, [email, password, rememberMe, router])

  const handleMfaVerify = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaFactorId || mfaCode.length !== 6) {
      setError('Please enter the 6-digit code from your authenticator app.')
      return
    }
    setMfaVerifying(true)
    setError('')

    try {
      const supabase = createClient()

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
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

      // MFA verified — proceed to dashboard
      hasCheckedAuth.current = true
      router.push('/dashboard')
      setTimeout(() => router.refresh(), 50)
    } catch {
      setError('An unexpected error occurred during verification.')
      setMfaVerifying(false)
    }
  }, [mfaFactorId, mfaCode, router])

  // Don't render until branding is resolved (prevents flash)
  if (!brandingLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-pulse text-cyan-400 text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-950 flex items-center justify-center">
      {/* ───── Animated mesh background ───── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {/* Gradient orbs */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[128px] opacity-20 animate-pulse"
          style={{
            background: `radial-gradient(circle, ${colors.primary}, transparent)`,
            top: '-10%',
            left: '-10%',
            animationDuration: '8s',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[128px] opacity-15 animate-pulse"
          style={{
            background: `radial-gradient(circle, ${colors.secondary}, transparent)`,
            bottom: '-10%',
            right: '-10%',
            animationDuration: '10s',
            animationDelay: '-3s',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-10 animate-pulse"
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

        {/* Stone Guardian Sentinel */}
        <div className="absolute left-0 bottom-0 h-full w-auto opacity-20 hidden lg:block pointer-events-none">
          <svg
            viewBox="0 0 400 800"
            className="h-full w-auto"
            style={{
              filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.3))',
            }}
          >
            <defs>
              {/* Stone texture gradient */}
              <linearGradient id="stoneGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#8b8680', stopOpacity: 1 }} />
                <stop offset="50%" style={{ stopColor: '#a8a49f', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#6b6861', stopOpacity: 1 }} />
              </linearGradient>
              <linearGradient id="stoneHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#b8b4af', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#78746f', stopOpacity: 1 }} />
              </linearGradient>
              <linearGradient id="metalSpear" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: '#9ca3af', stopOpacity: 1 }} />
                <stop offset="50%" style={{ stopColor: '#6b7280', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: '#4b5563', stopOpacity: 1 }} />
              </linearGradient>
            </defs>

            {/* Base pedestal */}
            <rect x="120" y="720" width="160" height="80" fill="url(#stoneGradient)" />
            <polygon points="100,720 300,720 280,700 120,700" fill="url(#stoneHighlight)" />

            {/* Legs and body foundation */}
            <rect x="160" y="640" width="35" height="80" fill="url(#stoneGradient)" />
            <rect x="205" y="640" width="35" height="80" fill="url(#stoneGradient)" />
            
            {/* Tunic/skirt */}
            <polygon points="150,580 250,580 260,640 140,640" fill="url(#stoneHighlight)" />
            
            {/* Torso with armor plates */}
            <rect x="155" y="450" width="90" height="130" fill="url(#stoneGradient)" rx="5" />
            <path d="M 165 470 L 235 470 L 230 490 L 170 490 Z" fill="url(#stoneHighlight)" />
            <path d="M 165 500 L 235 500 L 230 520 L 170 520 Z" fill="url(#stoneHighlight)" />
            
            {/* Shield arm (left side, holding shield) */}
            <rect x="105" y="480" width="50" height="25" fill="url(#stoneGradient)" transform="rotate(-20 130 492)" />
            <rect x="85" y="505" width="40" height="20" fill="url(#stoneGradient)" transform="rotate(-30 105 515)" />
            
            {/* Large Roman shield (scutum) with logo space */}
            <ellipse cx="60" cy="550" rx="55" ry="80" fill="url(#stoneHighlight)" />
            <ellipse cx="60" cy="550" rx="48" ry="73" fill="#7c7772" />
            <circle cx="60" cy="550" r="35" fill="url(#stoneGradient)" stroke="#5a5651" strokeWidth="2" />
            {/* Logo placeholder - Activity icon representation */}
            <circle cx="60" cy="550" r="20" fill="none" stroke={colors.primary} strokeWidth="3" opacity="0.6" />
            <path d="M 50 550 L 55 545 L 60 555 L 65 540 L 70 550" fill="none" stroke={colors.primary} strokeWidth="2.5" opacity="0.6" />

            {/* Spear arm (right side) */}
            <rect x="245" y="420" width="30" height="60" fill="url(#stoneGradient)" transform="rotate(15 260 450)" />
            <rect x="265" y="460" width="25" height="50" fill="url(#stoneGradient)" transform="rotate(20 277 485)" />
            
            {/* Spear shaft */}
            <rect x="285" y="200" width="8" height="350" fill="#6b5d4f" transform="rotate(25 289 375)" />
            
            {/* Spear point */}
            <polygon points="340,120 355,180 325,180" fill="url(#metalSpear)" transform="rotate(25 340 150)" />
            
            {/* Shoulders */}
            <ellipse cx="155" cy="455" rx="25" ry="20" fill="url(#stoneGradient)" />
            <ellipse cx="245" cy="445" rx="25" ry="20" fill="url(#stoneGradient)" />
            
            {/* Neck */}
            <rect x="185" y="420" width="30" height="35" fill="url(#stoneHighlight)" />
            
            {/* Head looking right (profile view) */}
            <ellipse cx="210" cy="405" rx="30" ry="35" fill="url(#stoneGradient)" />
            <path d="M 225 395 L 240 390 L 245 400 L 235 410 Z" fill="url(#stoneGradient)" /> {/* Nose profile */}
            <ellipse cx="235" cy="395" rx="3" ry="4" fill="#5a5651" /> {/* Eye */}
            
            {/* Roman helmet with crest */}
            <path d="M 185 385 Q 185 365 210 360 Q 235 365 235 385 L 235 405 Q 210 410 185 405 Z" fill="url(#stoneHighlight)" />
            <ellipse cx="210" cy="370" rx="28" ry="15" fill="url(#stoneGradient)" /> {/* Helmet dome */}
            {/* Helmet crest */}
            <path d="M 210 355 Q 215 340 220 325 Q 215 330 210 335 Q 205 330 200 325 Q 205 340 210 355 Z" fill="#8b4545" opacity="0.7" />
            
            {/* Cape flowing behind */}
            <path d="M 145 460 Q 120 500 125 580 Q 130 640 140 700 L 105 700 Q 95 640 90 580 Q 85 520 110 470 Z" fill="url(#stoneHighlight)" opacity="0.6" />
            
            {/* Stone texture details */}
            <circle cx="180" cy="520" r="2" fill="#5a5651" opacity="0.5" />
            <circle cx="220" cy="540" r="2" fill="#5a5651" opacity="0.5" />
            <circle cx="195" cy="560" r="2" fill="#5a5651" opacity="0.5" />
            <path d="M 170 500 Q 175 502 170 504" stroke="#5a5651" strokeWidth="1" opacity="0.4" fill="none" />
            <path d="M 190 650 Q 195 652 190 654" stroke="#5a5651" strokeWidth="1" opacity="0.4" fill="none" />
          </svg>
        </div>

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
              <IconComponent style={{ width: node.size, height: node.size, color: colors.primary }} />
            </div>
          )
        })}
      </div>

      {/* ───── Content ───── */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Brand header */}
        <div className="text-center mb-8">
          {logoUrl ? (
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={`${orgName} logo`}
                className="h-16 w-auto object-contain drop-shadow-lg"
              />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  boxShadow: `0 8px 32px ${colors.primary}30`,
                }}
              >
                <Activity className="w-8 h-8 text-white" />
              </div>
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: colors.primary }}>
            {orgName}
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {branding ? 'Sentinel' : 'Sentinel by NetNeural'}
          </p>
        </div>

        {/* Glass card */}
        <div
          className="rounded-2xl border backdrop-blur-xl p-8 shadow-2xl"
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            borderColor: `${colors.primary}20`,
            boxShadow: `0 0 80px ${colors.primary}08, 0 25px 50px rgba(0,0,0,0.4)`,
          }}
        >
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-gray-100">
              {mfaRequired ? 'Two-Factor Authentication' : 'Welcome back'}
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              {mfaRequired ? 'Enter the code from your authenticator app' : 'Sign in to continue'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mb-6 bg-red-950/60 border-red-800/60">
              <AlertDescription>
                <div className="flex items-start justify-between text-red-200">
                  <span>{error}</span>
                  {error.includes('unexpected error') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setError(''); setEmail(''); setPassword(''); hasCheckedAuth.current = false; setMfaRequired(false); setMfaCode(''); setMfaFactorId(null) }}
                      className="ml-2 h-auto py-0 px-2 text-xs text-red-300 hover:text-white"
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
                <div className="flex justify-center mb-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${colors.primary}20` }}>
                    <Shield className="w-6 h-6" style={{ color: colors.primary }} />
                  </div>
                </div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 text-center" htmlFor="mfa-code">
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
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  autoFocus
                  className="w-full px-4 py-4 rounded-lg bg-gray-800/60 text-gray-100 border border-gray-700/60 placeholder:text-gray-500 focus:outline-none focus:ring-2 transition-all text-center text-2xl font-mono tracking-[0.5em]"
                  style={{ ['--tw-ring-color' as string]: `${colors.primary}80` }}
                />
              </div>

              <Button
                type="submit"
                disabled={mfaVerifying || mfaCode.length !== 6}
                className="w-full h-12 text-base font-semibold rounded-lg text-white transition-all shadow-lg hover:shadow-xl hover:brightness-110 disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  boxShadow: `0 4px 20px ${colors.primary}30`,
                }}
              >
                {mfaVerifying ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Verifying...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
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
                className="w-full mt-3 text-sm text-gray-500 hover:text-gray-300 transition-colors text-center"
              >
                ← Back to sign in
              </button>
            </form>
          ) : (
            /* ── Normal Login Form ── */
            <form onSubmit={handleSubmit}>
            {/* Email */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="email">
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
                className="w-full px-4 py-3 rounded-lg bg-gray-800/60 text-gray-100 border border-gray-700/60 placeholder:text-gray-500 focus:outline-none focus:ring-2 transition-all"
                style={{ ['--tw-ring-color' as string]: `${colors.primary}80` }}
              />
            </div>

            {/* Password */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="password">
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
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-gray-800/60 text-gray-100 border border-gray-700/60 placeholder:text-gray-500 focus:outline-none focus:ring-2 transition-all"
                  style={{ ['--tw-ring-color' as string]: `${colors.primary}80` }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="mb-6 flex items-center">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-gray-400 cursor-pointer">
                Keep me signed in
              </label>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-base font-semibold rounded-lg text-white transition-all shadow-lg hover:shadow-xl hover:brightness-110 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                boxShadow: `0 4px 20px ${colors.primary}30`,
              }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Sign in
                </span>
              )}
            </Button>
          </form>
          )}

          {/* Footer */}
          <p className="text-center mt-6 text-xs text-gray-500">
            Forgot your password? Contact your system administrator
          </p>
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-500">
          <Shield className="w-3.5 h-3.5" style={{ color: colors.accent }} />
          <span>Enterprise-grade security</span>
          <span className="text-gray-700">•</span>
          <span>256-bit encryption</span>
        </div>

        {/* Powered by (only for org-branded logins) */}
        {branding && (
          <p className="text-center mt-3 text-[11px] text-gray-600">
            Powered by <span className="text-gray-400 font-medium">NetNeural</span>
          </p>
        )}

        {/* Dev helper */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 rounded-lg bg-gray-900/80 border border-gray-800 text-xs text-gray-400">
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
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto" />
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
