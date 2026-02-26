/**
 * Billing Plan Types
 * Defines interfaces for the billing_plans table and feature flags
 */

/** Feature flags stored in the billing_plans.features JSONB column */
export interface BillingPlanFeatures {
  ai_analytics: boolean
  pdf_export: boolean
  mfa: boolean
  custom_branding: boolean
  api_access: boolean
  priority_support: boolean
  sla: boolean
  audit_log: boolean
  webhook_integrations: boolean
  email_alerts: boolean
  dashboard: boolean
  telemetry_charts: boolean
  // Enterprise-only
  dedicated_support?: boolean
  custom_integrations?: boolean
  on_premise?: boolean
}

/** Database row from billing_plans table */
export interface BillingPlan {
  id: string
  name: string
  slug: string
  stripe_price_id_monthly: string | null
  stripe_price_id_annual: string | null
  price_monthly: number
  price_annual: number
  max_devices: number      // -1 = unlimited
  max_users: number         // -1 = unlimited
  max_integrations: number  // -1 = unlimited
  telemetry_retention_days: number
  features: BillingPlanFeatures
  is_active: boolean
  is_public: boolean
  sort_order: number
  description: string | null
  created_at: string
  updated_at: string
}

/** Slugs matching the seed data */
export type BillingPlanSlug = 'free' | 'starter' | 'professional' | 'enterprise'

/** Feature display metadata for plan comparison UI */
export interface PlanFeatureDisplay {
  key: keyof BillingPlanFeatures
  label: string
  description?: string
}

/** All displayable features for the comparison table */
export const PLAN_FEATURE_DISPLAY: PlanFeatureDisplay[] = [
  { key: 'dashboard', label: 'Dashboard', description: 'Real-time device monitoring dashboard' },
  { key: 'telemetry_charts', label: 'Telemetry Charts', description: 'Historical telemetry visualization' },
  { key: 'email_alerts', label: 'Email Alerts', description: 'Alert notifications via email' },
  { key: 'webhook_integrations', label: 'Webhook Integrations', description: 'Connect to external services' },
  { key: 'audit_log', label: 'Audit Log', description: 'Track all user actions' },
  { key: 'api_access', label: 'API Access', description: 'Programmatic access via REST API' },
  { key: 'mfa', label: 'Multi-Factor Auth', description: 'TOTP/authenticator app support' },
  { key: 'pdf_export', label: 'PDF Export', description: 'Export reports as PDF' },
  { key: 'custom_branding', label: 'Custom Branding', description: 'Logo, colors, and login page customization' },
  { key: 'ai_analytics', label: 'AI Analytics', description: 'Anomaly detection and predictive maintenance' },
  { key: 'priority_support', label: 'Priority Support', description: 'Faster response times' },
  { key: 'sla', label: 'SLA Guarantee', description: 'Uptime and response time guarantees' },
]

/**
 * Format plan price for display.
 * Enterprise (price 0 with slug 'enterprise') shows "Custom".
 * Free shows "Free".
 */
export function formatPlanPrice(plan: BillingPlan, interval: 'monthly' | 'annual' = 'monthly'): string {
  if (plan.slug === 'enterprise') return 'Custom'
  const price = interval === 'monthly' ? plan.price_monthly : plan.price_annual
  if (price === 0) return 'Free'
  return `$${price}/${interval === 'monthly' ? 'mo' : 'yr'}`
}

/**
 * Check if a resource limit means "unlimited" (-1)
 */
export function isUnlimited(limit: number): boolean {
  return limit === -1
}

/**
 * Format a resource limit for display
 */
export function formatLimit(limit: number): string {
  return isUnlimited(limit) ? 'Unlimited' : limit.toLocaleString()
}

// ============================================================================
// Subscriptions & Invoices (#243)
// ============================================================================

/** Subscription status enum matching DB */
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'

/** Invoice status enum matching DB */
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'

/** Database row from subscriptions table */
export interface Subscription {
  id: string
  organization_id: string
  plan_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

/** Subscription with joined billing plan data */
export interface SubscriptionWithPlan extends Subscription {
  billing_plan: BillingPlan
}

/** Database row from invoices table */
export interface Invoice {
  id: string
  organization_id: string
  subscription_id: string | null
  stripe_invoice_id: string | null
  amount_cents: number
  currency: string
  status: InvoiceStatus
  invoice_url: string | null
  pdf_url: string | null
  period_start: string | null
  period_end: string | null
  created_at: string
}

/**
 * Format invoice amount from cents to display string
 * e.g., 2900 → "$29.00"
 */
export function formatInvoiceAmount(amountCents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountCents / 100)
}

/**
 * Human-readable subscription status label
 */
export function formatSubscriptionStatus(status: SubscriptionStatus): string {
  const labels: Record<SubscriptionStatus, string> = {
    active: 'Active',
    past_due: 'Past Due',
    canceled: 'Canceled',
    trialing: 'Trialing',
    incomplete: 'Incomplete',
  }
  return labels[status]
}

/**
 * Human-readable invoice status label
 */
export function formatInvoiceStatus(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    draft: 'Draft',
    open: 'Open',
    paid: 'Paid',
    void: 'Void',
    uncollectible: 'Uncollectible',
  }
  return labels[status]
}

/**
 * Check if a subscription is in a billable/active state
 */
export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing'
}
