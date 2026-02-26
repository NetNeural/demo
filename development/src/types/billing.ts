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
