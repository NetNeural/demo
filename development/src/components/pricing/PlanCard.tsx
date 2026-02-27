'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check } from 'lucide-react'
import type { BillingPlan } from '@/types/billing'

interface PlanCardProps {
  plan: BillingPlan
  isPopular?: boolean
  isCurrentPlan?: boolean
  isLoading?: boolean
  billingInterval: 'monthly' | 'annual'
  sensorCount: number
  onSelectPlan: (plan: BillingPlan) => void
}

/** Key highlights per plan slug */
const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  monitor: [
    'Real-time temperature dashboard',
    'HACCP compliance logging',
    'Email & SMS alerts',
    'Manual report export',
    '30-day data retention',
    'Up to 5 team members',
  ],
  protect: [
    'Everything in Monitor, plus:',
    'AI anomaly detection',
    'Predictive failure alerts',
    'Multi-site dashboard',
    'API access & webhooks',
    '1-year data retention',
    'Up to 25 team members',
  ],
  command: [
    'Everything in Protect, plus:',
    'AI energy optimization',
    'Chain benchmarking',
    'ESG & carbon analytics',
    'Custom integrations',
    'Dedicated support & SLA',
    'Unlimited retention & users',
  ],
}

export function PlanCard({
  plan,
  isPopular = false,
  isCurrentPlan = false,
  isLoading = false,
  billingInterval,
  sensorCount,
  onSelectPlan,
}: PlanCardProps) {
  const pricePerSensor = plan.price_per_device
  const effectivePrice = pricePerSensor
  const monthlyCost = effectivePrice * sensorCount
  const highlights = PLAN_HIGHLIGHTS[plan.slug] || []

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border-2 bg-card p-6 shadow-sm transition-all hover:shadow-md',
        isPopular ? 'border-blue-500 shadow-blue-100' : 'border-border',
        isCurrentPlan && 'ring-2 ring-green-500 ring-offset-2'
      )}
    >
      {/* Popular badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-blue-600 px-3 py-1 text-white hover:bg-blue-600">
            Most Popular
          </Badge>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <Badge className="bg-green-600 px-3 py-1 text-white hover:bg-green-600">
            Current Plan
          </Badge>
        </div>
      )}

      {/* Plan name */}
      <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>

      {/* Plan description */}
      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

      {/* Pricing */}
      <div className="mt-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-extrabold tracking-tight text-foreground">
            ${effectivePrice.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">/sensor/mo</span>
        </div>
        {billingInterval === 'annual' && (
          <p className="mt-1 text-sm text-muted-foreground">
            ${(effectivePrice * 12).toFixed(2)}{' '}
            <span className="text-xs">/sensor/year</span>
          </p>
        )}
        <div className="mt-3 rounded-lg bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">
            Est. {billingInterval === 'annual' ? 'annual' : 'monthly'} cost for{' '}
            {sensorCount} sensor{sensorCount !== 1 ? 's' : ''}
          </p>
          <p className="text-2xl font-bold text-foreground">
            $
            {billingInterval === 'annual'
              ? (monthlyCost * 12).toFixed(2)
              : monthlyCost.toFixed(2)}
            <span className="text-sm font-normal text-muted-foreground">
              /{billingInterval === 'annual' ? 'yr' : 'mo'}
            </span>
          </p>
          {billingInterval === 'annual' && (
            <p className="mt-1 text-xs text-muted-foreground">
              (${monthlyCost.toFixed(2)}/mo equivalent)
            </p>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-6">
        <Button
          className="w-full"
          variant={isPopular ? 'default' : 'outline'}
          size="lg"
          disabled={isCurrentPlan || isLoading}
          onClick={() => onSelectPlan(plan)}
        >
          {isCurrentPlan
            ? 'Current Plan'
            : isLoading
              ? 'Redirecting...'
              : 'Get Started'}
        </Button>
      </div>

      {/* Feature highlights */}
      <ul className="mt-6 flex-1 space-y-3">
        {highlights.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            {i === 0 && (plan.slug === 'protect' || plan.slug === 'command') ? (
              <span className="font-medium text-muted-foreground">
                {feature}
              </span>
            ) : (
              <>
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span className="text-foreground">{feature}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
