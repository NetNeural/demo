'use client'

import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import { PLAN_FEATURE_DISPLAY } from '@/types/billing'
import type { BillingPlan } from '@/types/billing'

interface FeatureComparisonTableProps {
  plans: BillingPlan[]
}

/** Group features by tier for section headers */
const FEATURE_GROUPS = [
  {
    title: 'Core — Starter',
    description: 'Compliance & visibility essentials',
    keys: [
      'dashboard',
      'compliance_logs',
      'haccp_export',
      'email_alerts',
      'sms_alerts',
      'manual_report_export',
    ],
  },
  {
    title: 'Advanced — Professional',
    description: 'Operational intelligence',
    keys: [
      'ai_analytics',
      'predictive_alerts',
      'multi_site_dashboard',
      'role_based_access',
      'api_access',
      'automated_audit_reporting',
      'pdf_export',
      'mfa',
      'audit_log',
      'webhook_integrations',
    ],
  },
  {
    title: 'Enterprise',
    description: 'Optimization & sustainability',
    keys: [
      'ai_optimization',
      'chain_benchmarking',
      'esg_reporting',
      'carbon_analytics',
      'custom_integrations',
      'dedicated_support',
      'sla',
      'custom_branding',
      'priority_support',
    ],
  },
]

/** Build a lookup from feature key → display info */
const featureDisplayMap = new Map(PLAN_FEATURE_DISPLAY.map((f) => [f.key, f]))

export function FeatureComparisonTable({ plans }: FeatureComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b">
            <th className="py-4 pr-4 text-sm font-medium text-muted-foreground">
              Feature
            </th>
            {plans.map((plan) => (
              <th
                key={plan.id}
                className={cn(
                  'px-4 py-4 text-center text-sm font-semibold',
                  plan.slug === 'professional' && 'text-blue-600'
                )}
              >
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Resource limits section */}
          <tr>
            <td
              colSpan={plans.length + 1}
              className="pb-2 pt-6 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Plan Limits
            </td>
          </tr>
          <LimitRow
            label="Team Members"
            plans={plans}
            getValue={(p) => formatLimit(p.max_users)}
          />
          <LimitRow
            label="Integrations"
            plans={plans}
            getValue={(p) => formatLimit(p.max_integrations)}
          />
          <LimitRow
            label="Data Retention"
            plans={plans}
            getValue={(p) => formatRetention(p.telemetry_retention_days)}
          />

          {/* Feature groups */}
          {FEATURE_GROUPS.map((group) => (
            <FeatureGroup
              key={group.title}
              title={group.title}
              description={group.description}
              featureKeys={group.keys}
              plans={plans}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FeatureGroup({
  title,
  description,
  featureKeys,
  plans,
}: {
  title: string
  description: string
  featureKeys: string[]
  plans: BillingPlan[]
}) {
  return (
    <>
      <tr>
        <td colSpan={plans.length + 1} className="pb-2 pt-6">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">
            — {description}
          </span>
        </td>
      </tr>
      {featureKeys.map((key) => {
        const display = featureDisplayMap.get(
          key as keyof BillingPlan['features']
        )
        if (!display) return null
        return (
          <tr key={key} className="border-b border-border/50">
            <td className="py-3 pr-4">
              <div className="text-sm font-medium text-foreground">
                {display.label}
              </div>
              {display.description && (
                <div className="text-xs text-muted-foreground">
                  {display.description}
                </div>
              )}
            </td>
            {plans.map((plan) => {
              const hasFeature =
                plan.features[key as keyof BillingPlan['features']]
              return (
                <td key={plan.id} className="px-4 py-3 text-center">
                  {hasFeature ? (
                    <Check className="mx-auto h-5 w-5 text-green-600" />
                  ) : (
                    <X className="mx-auto h-5 w-5 text-gray-300" />
                  )}
                </td>
              )
            })}
          </tr>
        )
      })}
    </>
  )
}

function LimitRow({
  label,
  plans,
  getValue,
}: {
  label: string
  plans: BillingPlan[]
  getValue: (plan: BillingPlan) => string
}) {
  return (
    <tr className="border-b border-border/50">
      <td className="py-3 pr-4 text-sm font-medium text-foreground">{label}</td>
      {plans.map((plan) => (
        <td
          key={plan.id}
          className="px-4 py-3 text-center text-sm font-medium text-foreground"
        >
          {getValue(plan)}
        </td>
      ))}
    </tr>
  )
}

function formatLimit(limit: number): string {
  if (limit === -1) return 'Unlimited'
  return limit.toLocaleString()
}

function formatRetention(days: number): string {
  if (days === -1) return 'Unlimited'
  if (days >= 365)
    return `${Math.floor(days / 365)} year${days >= 730 ? 's' : ''}`
  return `${days} days`
}
