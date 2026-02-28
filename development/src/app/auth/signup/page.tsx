'use client'

import { useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Shield,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Check,
  Wifi,
  Radio,
  Cpu,
  Zap,
  Activity,
  BarChart3,
  Brain,
  Building2,
  Lock,
  type LucideIcon,
} from 'lucide-react'

// ─── Plan definitions (matches billing_plans seed data) ───────────────
interface PlanTier {
  slug: 'starter' | 'professional' | 'enterprise'
  name: string
  tagline: string
  pricePerSensor: number
  icon: LucideIcon
  color: string
  features: string[]
  limits: { users: string; integrations: string; retention: string }
  popular?: boolean
}

const PLANS: PlanTier[] = [
  {
    slug: 'starter',
    name: 'Starter',
    tagline: 'Core compliance & visibility',
    pricePerSensor: 2,
    icon: BarChart3,
    color: '#06b6d4', // cyan
    features: [
      'Real-time monitoring dashboard',
      'Automated compliance logs',
      'HACCP export',
      'Email & SMS alerts',
      'Manual report export',
    ],
    limits: { users: '5 users', integrations: '1 integration', retention: '30-day retention' },
  },
  {
    slug: 'professional',
    name: 'Professional',
    tagline: 'Operational intelligence',
    pricePerSensor: 4,
    icon: Brain,
    color: '#8b5cf6', // violet
    popular: true,
    features: [
      'Everything in Starter, plus:',
      'AI anomaly detection',
      'Predictive alerts',
      'Multi-site dashboard',
      'Role-based access control',
      'API access & webhooks',
      'Automated audit reports',
      'PDF export & MFA',
    ],
    limits: { users: '25 users', integrations: '5 integrations', retention: '1-year retention' },
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    tagline: 'Enterprise optimization & sustainability',
    pricePerSensor: 6,
    icon: Building2,
    color: '#10b981', // emerald
    features: [
      'Everything in Professional, plus:',
      'AI optimization insights',
      'Chain benchmarking',
      'ESG & carbon reporting',
      'Custom integrations',
      'Dedicated support & SLA',
      'Custom branding',
      'Priority support',
    ],
    limits: { users: 'Unlimited users', integrations: 'Unlimited integrations', retention: 'Unlimited retention' },
  },
]

// ─── Animated background (same style as login) ───────────────────────
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
    icon: i % 5,
  }))
}

const NODE_ICONS: LucideIcon[] = [Wifi, Radio, Cpu, Zap, Activity]

// ─── Signup form component ────────────────────────────────────────────
function SignupForm() {
  const router = useRouter()

  // Step state: 1 = select plan, 2 = account details, 3 = success
  const [step, setStep] = useState(1)
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null)

  // Form state
  const [fullName, setFullName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // Loading / error
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Colors
  const colors = useMemo(() => ({
    primary: '#06b6d4',
    secondary: '#8b5cf6',
    accent: '#10b981',
  }), [])

  // Background nodes
  const nodes = useMemo(() => generateNodes(10), [])

  // ── Validation ──────────────────────────────────────────────────────
  const passwordErrors = useMemo(() => {
    const errs: string[] = []
    if (password.length > 0 && password.length < 8) errs.push('At least 8 characters')
    if (password.length > 0 && !/[A-Z]/.test(password)) errs.push('One uppercase letter')
    if (password.length > 0 && !/[0-9]/.test(password)) errs.push('One number')
    return errs
  }, [password])

  const isStep2Valid = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      orgName.trim().length >= 2 &&
      email.trim().includes('@') &&
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password) &&
      password === confirmPassword &&
      agreedToTerms
    )
  }, [fullName, orgName, email, password, confirmPassword, agreedToTerms])

  // ── Handle signup ───────────────────────────────────────────────────
  const handleSignup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlan || !isStep2Valid) return

    setIsLoading(true)
    setError('')

    try {
      const supabase = createClient()

      // Generate organization slug from name
      const slug = orgName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      // Create auth user with metadata
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            organization_name: orgName.trim(),
            organization_slug: slug,
            selected_plan: selectedPlan.slug,
          },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsLoading(false)
        return
      }

      if (!data.user) {
        setError('Registration failed. Please try again.')
        setIsLoading(false)
        return
      }

      // If email confirmation is required, show success step
      // If auto-confirmed, provision org + user record
      if (data.session) {
        // Auto-confirmed — create organization and user record
        try {
          // Create organization
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .insert({
              name: orgName.trim(),
              slug,
              subscription_tier: selectedPlan.slug,
              is_active: true,
              settings: {},
            })
            .select('id')
            .single()

          if (orgError) {
            console.error('Org creation error:', orgError)
            // Still proceed — org can be set up later
          }

          // Create user record in public.users
          if (orgData) {
            const { error: userError } = await supabase
              .from('users')
              .insert({
                id: data.user.id,
                email: data.user.email || email.trim(),
                full_name: fullName.trim(),
                role: 'org_owner',
                organization_id: orgData.id,
                is_active: true,
              })

            if (userError) {
              console.error('User record creation error:', userError)
            }
          }
        } catch (provisionErr) {
          console.error('Provisioning error:', provisionErr)
          // Auth user is created — provisioning can be retried
        }
      }

      // Move to success step
      setStep(3)
      setIsLoading(false)
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setIsLoading(false)
    }
  }, [selectedPlan, isStep2Valid, email, password, fullName, orgName])

  // ── Plan card ───────────────────────────────────────────────────────
  const renderPlanCard = (plan: PlanTier) => {
    const Icon = plan.icon
    const isSelected = selectedPlan?.slug === plan.slug

    return (
      <button
        key={plan.slug}
        type="button"
        onClick={() => setSelectedPlan(plan)}
        className={`relative flex flex-col rounded-2xl border-2 p-6 text-left transition-all duration-300 ${
          isSelected
            ? 'scale-[1.02] shadow-2xl'
            : 'border-gray-700/50 hover:border-gray-600 hover:shadow-lg'
        }`}
        style={{
          borderColor: isSelected ? plan.color : undefined,
          boxShadow: isSelected ? `0 8px 40px ${plan.color}25` : undefined,
          background: isSelected
            ? `linear-gradient(135deg, ${plan.color}08, ${plan.color}04)`
            : 'rgba(17, 24, 39, 0.6)',
        }}
      >
        {/* Popular badge */}
        {plan.popular && (
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ background: plan.color }}
          >
            Most Popular
          </div>
        )}

        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: `${plan.color}20` }}
          >
            <Icon className="h-5 w-5" style={{ color: plan.color }} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{plan.name}</h3>
            <p className="text-xs text-gray-400">{plan.tagline}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-4">
          <span className="text-3xl font-bold text-white">${plan.pricePerSensor}</span>
          <span className="text-sm text-gray-400">/sensor/mo</span>
        </div>

        {/* Limits */}
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.values(plan.limits).map((limit) => (
            <span
              key={limit}
              className="rounded-full bg-gray-800 px-2.5 py-1 text-xs text-gray-300"
            >
              {limit}
            </span>
          ))}
        </div>

        {/* Features */}
        <ul className="mb-4 flex-1 space-y-2">
          {plan.features.map((feat) => (
            <li key={feat} className="flex items-start gap-2 text-sm text-gray-300">
              {feat.includes('Everything in') ? (
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: plan.color }} />
              ) : (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: plan.color }} />
              )}
              <span>{feat}</span>
            </li>
          ))}
        </ul>

        {/* Selection indicator */}
        <div
          className={`mt-auto flex h-10 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all ${
            isSelected ? 'text-white' : 'border-gray-600 text-gray-400'
          }`}
          style={{
            borderColor: isSelected ? plan.color : undefined,
            background: isSelected ? plan.color : 'transparent',
          }}
        >
          {isSelected ? (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Selected
            </span>
          ) : (
            'Select Plan'
          )}
        </div>
      </button>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-950 px-4 py-12">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 20% 50%, ${colors.primary}08 0%, transparent 60%),
                          radial-gradient(ellipse at 80% 50%, ${colors.secondary}06 0%, transparent 60%),
                          radial-gradient(ellipse at 50% 100%, ${colors.accent}04 0%, transparent 50%)`,
          }}
        />
        {nodes.map((node) => {
          const NodeIcon = NODE_ICONS[node.icon] as LucideIcon | undefined
          if (!NodeIcon) return null
          return (
            <div
              key={node.id}
              className="absolute opacity-[0.04]"
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                width: node.size,
                height: node.size,
                animation: `nnFloat ${node.speed}s ease-in-out infinite`,
                animationDelay: `${node.delay}s`,
              }}
            >
              <NodeIcon className="h-full w-full text-white" />
            </div>
          )
        })}
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link
            href="/auth/login"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
          <h1
            className="mt-2 bg-clip-text text-3xl font-bold text-transparent sm:text-4xl"
            style={{
              backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
            }}
          >
            Get Started with NetNeural
          </h1>
          <p className="mt-2 text-gray-400">
            {step === 1 && 'Choose the plan that fits your operation'}
            {step === 2 && 'Create your account'}
            {step === 3 && 'You\'re all set!'}
          </p>

          {/* Step indicator */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    step > s
                      ? 'text-white'
                      : step === s
                        ? 'text-white'
                        : 'border border-gray-700 text-gray-500'
                  }`}
                  style={{
                    background:
                      step >= s
                        ? `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`
                        : 'transparent',
                  }}
                >
                  {step > s ? <Check className="h-3.5 w-3.5" /> : s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-0.5 w-8 rounded-full transition-all sm:w-16 ${
                      step > s ? 'bg-cyan-500' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Step 1: Plan selection ──────────────────────────────── */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-6 md:grid-cols-3">
              {PLANS.map(renderPlanCard)}
            </div>

            <div className="mt-8 flex justify-center">
              <Button
                onClick={() => { setError(''); setStep(2) }}
                disabled={!selectedPlan}
                className="h-12 w-full max-w-sm rounded-lg px-8 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50"
                style={{
                  background: selectedPlan
                    ? `linear-gradient(135deg, ${selectedPlan.color}, ${colors.secondary})`
                    : undefined,
                  boxShadow: selectedPlan ? `0 4px 20px ${selectedPlan.color}30` : undefined,
                }}
              >
                <span className="flex items-center gap-2">
                  Continue with {selectedPlan?.name || '...'}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-gray-500">
              All plans include a 14-day free trial. No credit card required.
            </p>
          </div>
        )}

        {/* ── Step 2: Account details ─────────────────────────────── */}
        {step === 2 && (
          <div className="mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div
              className="rounded-2xl border border-gray-800/60 p-8 shadow-2xl backdrop-blur-xl"
              style={{ background: 'rgba(17, 24, 39, 0.7)' }}
            >
              {/* Selected plan pill */}
              {selectedPlan && (
                <div className="mb-6 flex items-center justify-between rounded-lg border border-gray-700/50 bg-gray-800/40 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <selectedPlan.icon className="h-4 w-4" style={{ color: selectedPlan.color }} />
                    <span className="text-sm font-medium text-white">{selectedPlan.name}</span>
                    <span className="text-xs text-gray-400">
                      ${selectedPlan.pricePerSensor}/sensor/mo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs text-gray-400 transition-colors hover:text-white"
                  >
                    Change
                  </button>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mb-4 border-red-800/50 bg-red-900/20">
                  <AlertDescription className="text-red-300">{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSignup} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-gray-300">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    required
                    autoComplete="name"
                    className="h-11 w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 text-white placeholder-gray-500 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>

                {/* Organization Name */}
                <div>
                  <label htmlFor="orgName" className="mb-1.5 block text-sm font-medium text-gray-300">
                    Organization Name
                  </label>
                  <input
                    id="orgName"
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Cold Storage"
                    required
                    autoComplete="organization"
                    className="h-11 w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 text-white placeholder-gray-500 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-300">
                    Work Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@acmecold.com"
                    required
                    autoComplete="email"
                    className="h-11 w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 text-white placeholder-gray-500 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="h-11 w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 pr-10 text-white placeholder-gray-500 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordErrors.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5">
                      {passwordErrors.map((err) => (
                        <li key={err} className="text-xs text-amber-400">• {err}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-300">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className="h-11 w-full rounded-lg border border-gray-700 bg-gray-800/60 px-4 text-white placeholder-gray-500 transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
                  />
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="mt-1 text-xs text-red-400">Passwords don&apos;t match</p>
                  )}
                </div>

                {/* Terms */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-gray-800/30">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500/30"
                  />
                  <span className="text-xs text-gray-400">
                    I agree to the{' '}
                    <a href="/privacy" target="_blank" className="text-cyan-400 underline hover:text-cyan-300">
                      Privacy Policy
                    </a>{' '}
                    and{' '}
                    <span className="text-gray-400">Terms of Service</span>
                  </span>
                </label>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setError(''); setStep(1) }}
                    className="h-11 flex-1 rounded-lg border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800"
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={!isStep2Valid || isLoading}
                    className="h-11 flex-[2] rounded-lg text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                      boxShadow: `0 4px 20px ${colors.primary}30`,
                    }}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Creating account...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Create Account
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Step 3: Success ─────────────────────────────────────── */}
        {step === 3 && (
          <div className="mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div
              className="rounded-2xl border border-gray-800/60 p-8 text-center shadow-2xl backdrop-blur-xl"
              style={{ background: 'rgba(17, 24, 39, 0.7)' }}
            >
              <div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: `linear-gradient(135deg, ${colors.primary}20, ${colors.accent}20)` }}
              >
                <Check className="h-8 w-8 text-emerald-400" />
              </div>

              <h2 className="mb-2 text-2xl font-bold text-white">Account Created!</h2>
              <p className="mb-6 text-sm text-gray-400">
                Welcome to NetNeural. Your{' '}
                <span className="font-semibold" style={{ color: selectedPlan?.color }}>
                  {selectedPlan?.name}
                </span>{' '}
                plan is ready. Check your email for a confirmation link, then sign in to get started.
              </p>

              <Button
                onClick={() => router.push('/auth/login')}
                className="h-11 w-full rounded-lg text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110"
                style={{
                  background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                  boxShadow: `0 4px 20px ${colors.primary}30`,
                }}
              >
                Go to Sign In
              </Button>

              <p className="mt-4 text-xs text-gray-500">
                Your 14-day free trial starts when you sign in.
              </p>
            </div>
          </div>
        )}

        {/* Security badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
          <Shield className="h-3.5 w-3.5" style={{ color: colors.accent }} />
          <span>Enterprise-grade security</span>
          <span className="text-gray-700">•</span>
          <span>256-bit encryption</span>
          <span className="text-gray-700">•</span>
          <a href="/privacy" className="underline transition-colors hover:text-gray-300">
            Privacy Policy
          </a>
        </div>
      </div>

      {/* Animation keyframes */}
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

export default function SignupPage() {
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
      <SignupForm />
    </Suspense>
  )
}
