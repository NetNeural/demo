'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PlanCard } from '@/components/pricing/PlanCard'
import { FeatureComparisonTable } from '@/components/pricing/FeatureComparisonTable'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Thermometer, Shield, Zap, ChevronDown } from 'lucide-react'
import type { BillingPlan } from '@/types/billing'

// Lazy singleton
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

export default function PricingPage() {
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>(
    'monthly'
  )
  const [sensorCount, setSensorCount] = useState(10)
  const [showComparison, setShowComparison] = useState(false)
  const [currentPlanSlug, setCurrentPlanSlug] = useState<string | null>(null)

  // Fetch active plans from billing_plans table
  useEffect(() => {
    async function fetchPlans() {
      try {
        const supabase = getSupabase()
        // Cast needed: billing_plans table not yet in generated DB types
        const { data, error } = await (supabase as any)
          .from('billing_plans')
          .select('*')
          .eq('is_active', true)
          .eq('is_public', true)
          .order('sort_order', { ascending: true })

        if (error) {
          console.error('Error fetching plans:', error)
          return
        }

        setPlans((data as BillingPlan[]) || [])
      } catch (err) {
        console.error('Failed to fetch plans:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPlans()
  }, [])

  // Check if user is logged in and what plan they're on
  useEffect(() => {
    async function checkCurrentPlan() {
      try {
        const supabase = getSupabase()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        // Get user's org subscription
        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (!membership) return

        // Cast needed: subscriptions table not yet in generated DB types
        const { data: subscription } = await (supabase as any)
          .from('subscriptions')
          .select('plan_id, billing_plan:plan_id(slug)')
          .eq('organization_id', membership.organization_id)
          .eq('status', 'active')
          .limit(1)
          .single()

        if (subscription?.billing_plan) {
          setCurrentPlanSlug(
            (subscription.billing_plan as unknown as { slug: string }).slug
          )
        }
      } catch {
        // User not logged in or no subscription — that's fine
      }
    }

    checkCurrentPlan()
  }, [])

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)

  const handleSelectPlan = async (plan: BillingPlan) => {
    // If not logged in, redirect to login with plan preselected
    const supabase = getSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = `/auth/login?plan=${plan.slug}`
      return
    }

    // Logged in → create Stripe Checkout session
    setCheckoutLoading(plan.id)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId: plan.id,
            billingInterval,
            sensorCount,
          }),
        }
      )

      const result = await res.json()
      if (result?.data?.url) {
        window.location.href = result.data.url
      } else {
        console.error('Checkout error:', result)
        alert(result?.message || 'Unable to start checkout. Please try again.')
      }
    } catch (err) {
      console.error('Checkout failed:', err)
      alert('Unable to start checkout. Please try again.')
    } finally {
      setCheckoutLoading(null)
    }
  }

  const planIcons: Record<string, React.ReactNode> = {
    monitor: <Thermometer className="h-8 w-8 text-emerald-600" />,
    protect: <Shield className="h-8 w-8 text-blue-600" />,
    command: <Zap className="h-8 w-8 text-purple-600" />,
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading plans...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="border-b bg-gradient-to-b from-blue-50/50 to-background px-4 py-16 text-center dark:from-blue-950/20">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Simple per-sensor pricing
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Pay only for what you monitor. No hidden fees, no long-term contracts.
          Start with any plan and scale as you grow.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span
            className={`text-sm font-medium ${billingInterval === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Monthly
          </span>
          <Switch
            checked={billingInterval === 'annual'}
            onCheckedChange={(checked) =>
              setBillingInterval(checked ? 'annual' : 'monthly')
            }
          />
          <span
            className={`text-sm font-medium ${billingInterval === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Annual
          </span>

        </div>

        {/* Sensor count slider */}
        <div className="mx-auto mt-6 max-w-md">
          <label className="mb-2 block text-sm text-muted-foreground">
            How many sensors?{' '}
            <span className="font-semibold text-foreground">{sensorCount}</span>
          </label>
          <Slider
            value={[sensorCount]}
            onValueChange={([val]) => setSensorCount(val ?? 10)}
            min={1}
            max={500}
            step={1}
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>100</span>
            <span>250</span>
            <span>500</span>
          </div>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isPopular={plan.slug === 'professional'}
              isCurrentPlan={plan.slug === currentPlanSlug}
              isLoading={checkoutLoading === plan.id}
              billingInterval={billingInterval}
              sensorCount={sensorCount}
              onSelectPlan={handleSelectPlan}
            />
          ))}
        </div>

        {/* Compare all features toggle */}
        <div className="mt-12 text-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setShowComparison(!showComparison)}
            className="gap-2"
          >
            {showComparison ? 'Hide' : 'Compare all'} features
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showComparison ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>

        {/* Feature comparison table */}
        {showComparison && plans.length > 0 && (
          <div className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
            <FeatureComparisonTable plans={plans} />
          </div>
        )}

        {/* FAQ / Social proof section */}
        <div className="mx-auto mt-16 max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Trusted by food service & cold chain operators
          </h2>
          <p className="mt-3 text-muted-foreground">
            Sentinel by NetNeural helps restaurants, grocery chains, and
            logistics companies stay compliant and reduce waste with real-time
            IoT monitoring.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-foreground">99.9%</p>
              <p className="text-sm text-muted-foreground">Uptime SLA</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{'<'}30s</p>
              <p className="text-sm text-muted-foreground">Alert latency</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">HACCP</p>
              <p className="text-sm text-muted-foreground">Compliant</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Questions? Need a custom plan for 500+ sensors?
          </p>
          <Button variant="outline" className="mt-3" asChild>
            <a href="mailto:sales@netneural.ai">Contact Sales</a>
          </Button>
        </div>
      </div>
    </div>
  )
}
