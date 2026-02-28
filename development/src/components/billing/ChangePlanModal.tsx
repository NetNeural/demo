'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Check,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react'
import type { BillingPlan, BillingPlanSlug } from '@/types/billing'
import { logClientAction } from '@/lib/audit-client'

// Lazy singleton
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

/** Tier sort order — higher = more features */
const TIER_RANK: Record<string, number> = {
  starter: 1,
  professional: 2,
  enterprise: 3,
}

/** Key features per tier for the comparison */
const TIER_HIGHLIGHTS: Record<string, string[]> = {
  starter: [
    'Real-time monitoring',
    'HACCP compliance logs',
    'Email & SMS alerts',
    'Up to 3 team members',
    '90-day data retention',
  ],
  professional: [
    'AI anomaly detection',
    'Predictive failure alerts',
    'Multi-site dashboard',
    'API access & webhooks',
    '1-year data retention',
    'Up to 25 team members',
  ],
  enterprise: [
    'AI energy optimization',
    'Chain & ESG benchmarking',
    'Custom integrations',
    'Dedicated support & SLA',
    'Unlimited retention & users',
  ],
}

interface ChangePlanModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPlanSlug: string | null
  organizationId: string
  onPlanChanged?: () => void
}

export function ChangePlanModal({
  open,
  onOpenChange,
  currentPlanSlug,
  organizationId,
  onPlanChanged,
}: ChangePlanModalProps) {
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch available plans
  useEffect(() => {
    if (!open) return
    async function fetchPlans() {
      try {
        setLoading(true)
        const supabase = getSupabase()
        const { data } = await (supabase as any)
          .from('billing_plans')
          .select('*')
          .eq('is_active', true)
          .eq('is_public', true)
          .order('sort_order', { ascending: true })
        setPlans((data as BillingPlan[]) || [])
      } catch {
        setError('Failed to load plans')
      } finally {
        setLoading(false)
      }
    }
    fetchPlans()
    // Reset state when opening
    setSelectedSlug(null)
    setConfirming(false)
    setError(null)
  }, [open])

  const selectedPlan = useMemo(
    () => plans.find((p) => p.slug === selectedSlug) || null,
    [plans, selectedSlug]
  )

  const currentRank = TIER_RANK[currentPlanSlug || ''] || 0
  const selectedRank = TIER_RANK[selectedSlug || ''] || 0
  const isUpgrade = selectedRank > currentRank
  const isDowngrade = selectedRank < currentRank

  /** Features the user will LOSE when downgrading */
  const lostFeatures = useMemo(() => {
    if (!isDowngrade || !selectedSlug || !currentPlanSlug) return []
    const lost: string[] = []
    // Collect highlights from tiers above the selected tier
    for (const [slug, rank] of Object.entries(TIER_RANK)) {
      if (rank > (TIER_RANK[selectedSlug] || 0) && rank <= currentRank) {
        lost.push(...(TIER_HIGHLIGHTS[slug] || []))
      }
    }
    return lost
  }, [isDowngrade, selectedSlug, currentPlanSlug, currentRank])

  const handleSelect = (slug: string) => {
    if (slug === currentPlanSlug) return
    setSelectedSlug(slug)
    setConfirming(false)
    setError(null)
  }

  const handleConfirm = async () => {
    if (!selectedPlan) return

    // Enterprise → contact sales
    if (selectedPlan.slug === 'enterprise') {
      window.location.href =
        'mailto:sales@netneural.ai?subject=Enterprise%20Plan%20Inquiry'
      return
    }

    setActionLoading(true)
    setError(null)

    try {
      const supabase = getSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setError('Please log in to change your plan.')
        return
      }

      // Call stripe-checkout edge function for upgrade
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            planId: selectedPlan.id,
            billingInterval: 'monthly',
          }),
        }
      )

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(
          errBody?.error || errBody?.message || 'Failed to create checkout session'
        )
      }

      const result = await res.json()
      const checkoutUrl = result?.data?.url || result?.url

      if (!checkoutUrl) {
        throw new Error('No checkout URL returned')
      }

      // Audit log
      await logClientAction({
        organizationId,
        actionCategory: 'organization_management',
        actionType: isUpgrade ? 'plan_upgrade_initiated' : 'plan_downgrade_initiated',
        resourceType: 'subscription',
        resourceName: selectedPlan.name,
        changes: {
          from_plan: currentPlanSlug,
          to_plan: selectedPlan.slug,
          direction: isUpgrade ? 'upgrade' : 'downgrade',
        },
      })

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Something went wrong'
      )
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Change Plan</DialogTitle>
          <DialogDescription>
            Select a new plan for your organization. Changes take effect
            immediately for upgrades; downgrades apply at the end of your
            billing period.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Plan cards */}
            <div className="grid gap-3 sm:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.slug === currentPlanSlug
                const isSelected = plan.slug === selectedSlug
                const rank = TIER_RANK[plan.slug] || 0

                return (
                  <button
                    key={plan.id}
                    onClick={() => handleSelect(plan.slug)}
                    disabled={isCurrent}
                    className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                      isCurrent
                        ? 'cursor-default border-muted bg-muted/30'
                        : isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'cursor-pointer border-border hover:border-primary/50'
                    }`}
                  >
                    {isCurrent && (
                      <Badge
                        variant="secondary"
                        className="absolute -top-2 right-2 text-xs"
                      >
                        Current
                      </Badge>
                    )}
                    {plan.slug === 'professional' && !isCurrent && (
                      <Badge className="absolute -top-2 right-2 text-xs bg-primary">
                        Popular
                      </Badge>
                    )}
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="mt-1 text-lg font-bold">
                      {plan.pricing_model === 'custom'
                        ? 'Custom'
                        : `$${plan.price_per_device}/sensor/mo`}
                    </p>
                    <ul className="mt-3 space-y-1">
                      {(TIER_HIGHLIGHTS[plan.slug] || [])
                        .slice(0, 4)
                        .map((feat) => (
                          <li
                            key={feat}
                            className="flex items-start gap-1.5 text-xs text-muted-foreground"
                          >
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-green-500" />
                            {feat}
                          </li>
                        ))}
                    </ul>
                    {rank > currentRank && !isCurrent && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                        <ArrowUpRight className="h-3 w-3" /> Upgrade
                      </div>
                    )}
                    {rank < currentRank && !isCurrent && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                        <ArrowDownRight className="h-3 w-3" /> Downgrade
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Downgrade warning */}
            {isDowngrade && lostFeatures.length > 0 && selectedSlug && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">
                    You will lose access to these features:
                  </p>
                  <ul className="mt-2 list-disc pl-4 text-sm">
                    {lostFeatures.map((feat) => (
                      <li key={feat}>{feat}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm">
                    Downgrade takes effect at the end of your current billing
                    period.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Confirmation area */}
            {selectedSlug && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">
                    {isUpgrade ? 'Upgrade' : 'Switch'} to{' '}
                    <span className="font-bold">
                      {selectedPlan?.name}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedPlan?.slug === 'enterprise'
                      ? 'Contact our sales team for custom pricing'
                      : isUpgrade
                        ? 'You will be redirected to Stripe to complete payment'
                        : 'Change applies at the end of your billing period'}
                  </p>
                </div>
                {!confirming ? (
                  <Button
                    onClick={() =>
                      isDowngrade ? setConfirming(true) : handleConfirm()
                    }
                    disabled={actionLoading}
                    variant={isDowngrade ? 'outline' : 'default'}
                  >
                    {actionLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {selectedPlan?.slug === 'enterprise'
                      ? 'Contact Sales'
                      : isUpgrade
                        ? 'Upgrade Now'
                        : 'Downgrade'}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirming(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleConfirm}
                      disabled={actionLoading}
                    >
                      {actionLoading && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Confirm Downgrade
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
