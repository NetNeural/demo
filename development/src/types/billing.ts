/**
 * Billing Plan Types
 * Defines interfaces for the billing_plans table and feature flags
 */

/** Feature flags stored in the billing_plans.features JSONB column */
export interface BillingPlanFeatures {
  // Core (all plans)
  dashboard: boolean
  telemetry_charts: boolean
  email_alerts: boolean
  sms_alerts: boolean
  compliance_logs: boolean
  haccp_export: boolean
  manual_report_export: boolean
  // Protect+ features
  ai_analytics: boolean
  predictive_alerts: boolean
  multi_site_dashboard: boolean
  role_based_access: boolean
  api_access: boolean
  automated_audit_reporting: boolean
  pdf_export: boolean
  mfa: boolean
  audit_log: boolean
  webhook_integrations: boolean
  // Command features
  ai_optimization: boolean
  chain_benchmarking: boolean
  esg_reporting: boolean
  carbon_analytics: boolean
  custom_integrations: boolean
  dedicated_support: boolean
  sla: boolean
  custom_branding: boolean
  priority_support: boolean
}

/** Pricing model type */
export type PricingModel = 'flat' | 'per_device' | 'custom'

/** Database row from billing_plans table */
export interface BillingPlan {
  id: string
  name: string
  slug: string
  pricing_model: PricingModel
  price_per_device: number // per-sensor monthly price (e.g., $2, $4, $6)
  stripe_price_id_monthly: string | null
  stripe_price_id_annual: string | null
  price_monthly: number // base monthly price (0 for per-device plans)
  price_annual: number // base annual price (0 for per-device plans)
  max_devices: number // -1 = unlimited
  max_users: number // -1 = unlimited
  max_integrations: number // -1 = unlimited
  telemetry_retention_days: number // -1 = unlimited
  features: BillingPlanFeatures
  is_active: boolean
  is_public: boolean
  sort_order: number
  description: string | null
  created_at: string
  updated_at: string
}

/** Slugs matching the active seed data (per-sensor pricing model) */
export type BillingPlanSlug = 'monitor' | 'protect' | 'command'

/** Legacy slugs (deactivated, kept for historical subscription references) */
export type LegacyBillingPlanSlug =
  | 'free'
  | 'starter'
  | 'professional'
  | 'enterprise'

/** Feature display metadata for plan comparison UI */
export interface PlanFeatureDisplay {
  key: keyof BillingPlanFeatures
  label: string
  description?: string
}

/** All displayable features for the comparison table */
export const PLAN_FEATURE_DISPLAY: PlanFeatureDisplay[] = [
  // Monitor (all plans)
  {
    key: 'dashboard',
    label: 'Real-time Monitoring',
    description: 'Live temperature and sensor dashboard',
  },
  {
    key: 'compliance_logs',
    label: 'Compliance Logs',
    description: 'Automated HACCP-ready compliance logging',
  },
  {
    key: 'haccp_export',
    label: 'HACCP Export',
    description: 'Export compliance data for auditors',
  },
  {
    key: 'email_alerts',
    label: 'Email Alerts',
    description: 'Alert notifications via email',
  },
  {
    key: 'sms_alerts',
    label: 'SMS Alerts',
    description: 'Alert notifications via SMS',
  },
  {
    key: 'manual_report_export',
    label: 'Report Export',
    description: 'Manual data export and reporting',
  },
  // Protect+
  {
    key: 'ai_analytics',
    label: 'AI Anomaly Detection',
    description: 'Detect anomalies like doors left open',
  },
  {
    key: 'predictive_alerts',
    label: 'Predictive Alerts',
    description: 'Predict equipment failures before they happen',
  },
  {
    key: 'multi_site_dashboard',
    label: 'Multi-site Dashboard',
    description: 'Monitor all locations from one view',
  },
  {
    key: 'role_based_access',
    label: 'Role-based Access',
    description: 'Granular permissions per user',
  },
  {
    key: 'api_access',
    label: 'API Access',
    description: 'Programmatic access via REST API',
  },
  {
    key: 'automated_audit_reporting',
    label: 'Automated Audit Reports',
    description: 'Scheduled compliance reports',
  },
  {
    key: 'pdf_export',
    label: 'PDF Export',
    description: 'Export reports as PDF',
  },
  {
    key: 'mfa',
    label: 'Multi-Factor Auth',
    description: 'TOTP/authenticator app support',
  },
  {
    key: 'audit_log',
    label: 'Audit Log',
    description: 'Track all user actions',
  },
  {
    key: 'webhook_integrations',
    label: 'Webhook Integrations',
    description: 'Connect to external services',
  },
  // Command
  {
    key: 'ai_optimization',
    label: 'AI Optimization',
    description: 'Energy and equipment runtime optimization insights',
  },
  {
    key: 'chain_benchmarking',
    label: 'Chain Benchmarking',
    description: 'Compare performance across all locations',
  },
  {
    key: 'esg_reporting',
    label: 'ESG Reporting',
    description: 'Environmental, Social, and Governance dashboard',
  },
  {
    key: 'carbon_analytics',
    label: 'Carbon Analytics',
    description: 'Carbon impact tracking and reporting',
  },
  {
    key: 'custom_integrations',
    label: 'Custom Integrations',
    description: 'Custom API and system integrations',
  },
  {
    key: 'dedicated_support',
    label: 'Dedicated Support',
    description: 'Named account manager and support engineer',
  },
  {
    key: 'sla',
    label: 'SLA Guarantee',
    description: 'Uptime and response time guarantees',
  },
  {
    key: 'custom_branding',
    label: 'Custom Branding',
    description: 'Logo, colors, and login page customization',
  },
  {
    key: 'priority_support',
    label: 'Priority Support',
    description: 'Faster response times',
  },
]

/**
 * Format plan price for display.
 * Per-device plans show "$X/sensor/mo".
 * Flat-rate plans show "$X/mo" or "$X/yr".
 * Custom plans show "Custom".
 */
export function formatPlanPrice(
  plan: BillingPlan,
  interval: 'monthly' | 'annual' = 'monthly'
): string {
  if (plan.pricing_model === 'custom') return 'Custom'
  if (plan.pricing_model === 'per_device') {
    return `$${plan.price_per_device}/sensor/mo`
  }
  // Legacy flat-rate plans
  if (plan.slug === 'enterprise') return 'Custom'
  const price = interval === 'monthly' ? plan.price_monthly : plan.price_annual
  if (price === 0) return 'Free'
  return `$${price}/${interval === 'monthly' ? 'mo' : 'yr'}`
}

/**
 * Calculate monthly cost for a per-device plan given sensor count.
 */
export function calculateMonthlyCost(
  plan: BillingPlan,
  deviceCount: number
): number {
  if (plan.pricing_model === 'per_device') {
    return plan.price_per_device * deviceCount + plan.price_monthly
  }
  return plan.price_monthly
}

/**
 * Format the calculated monthly cost for display.
 */
export function formatMonthlyCost(
  plan: BillingPlan,
  deviceCount: number
): string {
  if (plan.pricing_model === 'custom') return 'Custom'
  const cost = calculateMonthlyCost(plan, deviceCount)
  return `$${cost.toFixed(2)}/mo`
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
export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'trialing'
  | 'incomplete'

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
export function formatInvoiceAmount(
  amountCents: number,
  currency = 'usd'
): string {
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

// ============================================================================
// Usage Metering (#244)
// ============================================================================

/** Metric types tracked by the usage metering system */
export type UsageMetricType =
  | 'device_count'
  | 'user_count'
  | 'api_calls'
  | 'storage_bytes'
  | 'edge_function_invocations'

/** Database row from usage_metrics table */
export interface UsageMetric {
  id: string
  organization_id: string
  metric_type: UsageMetricType
  current_value: number
  period_start: string
  period_end: string
  created_at: string
  updated_at: string
}

/** Result from the check_org_quota SQL function / usage-check edge function */
export interface QuotaCheckResult {
  current_usage: number
  plan_limit: number
  usage_percent: number
  is_warning: boolean // >= 80%
  is_exceeded: boolean // >= 100%
  is_unlimited: boolean // plan_limit = -1
  plan_name: string
}

/** Full usage-check API response */
export interface UsageCheckResponse {
  organization_id: string
  subscription: {
    id: string
    status: SubscriptionStatus
    plan: BillingPlan
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
  quotas: Record<UsageMetricType, QuotaCheckResult>
  summary: {
    has_warning: boolean
    has_exceeded: boolean
  }
  checked_at: string
}

/** Display metadata for usage metrics in the UI */
export interface UsageMetricDisplay {
  type: UsageMetricType
  label: string
  icon: string
  unit: string
}

/** All displayable usage metrics */
export const USAGE_METRIC_DISPLAY: UsageMetricDisplay[] = [
  { type: 'device_count', label: 'Devices', icon: 'cpu', unit: 'devices' },
  { type: 'user_count', label: 'Team Members', icon: 'users', unit: 'users' },
  { type: 'api_calls', label: 'API Calls', icon: 'zap', unit: 'calls/mo' },
  {
    type: 'storage_bytes',
    label: 'Storage',
    icon: 'hard-drive',
    unit: 'bytes',
  },
  {
    type: 'edge_function_invocations',
    label: 'Edge Functions',
    icon: 'cloud',
    unit: 'invocations/mo',
  },
]

/**
 * Format a quota percentage for display with color context
 */
export function getQuotaStatus(
  result: QuotaCheckResult
): 'ok' | 'warning' | 'exceeded' | 'unlimited' {
  if (result.is_unlimited) return 'unlimited'
  if (result.is_exceeded) return 'exceeded'
  if (result.is_warning) return 'warning'
  return 'ok'
}

/**
 * Format storage bytes for human-readable display
 */
export function formatStorageBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

// ============================================================================
// Plans & Pricing Administration (#314)
// ============================================================================

/** Price change application scope */
export type PriceChangeScope = 'all' | 'new_only'

/** Price change record for audit trail */
export interface PriceChangeRecord {
  id: string
  plan_id: string
  plan_slug: string
  field_changed: 'price_per_device' | 'price_monthly' | 'price_annual'
  old_value: number
  new_value: number
  scope: PriceChangeScope
  reason: string
  effective_date: string
  notification_sent: boolean
  notification_message: string | null
  changed_by: string
  created_at: string
}

/** Draft plan edit (in-memory before save) */
export interface PlanDraft {
  id: string | null // null = new plan
  name: string
  slug: string
  pricing_model: PricingModel
  price_per_device: number
  price_monthly: number
  price_annual: number
  max_devices: number
  max_users: number
  max_integrations: number
  telemetry_retention_days: number
  features: BillingPlanFeatures
  is_active: boolean
  is_public: boolean
  sort_order: number
  description: string
}

/** Empty feature set (all off) */
export const EMPTY_FEATURES: BillingPlanFeatures = {
  dashboard: false,
  telemetry_charts: false,
  email_alerts: false,
  sms_alerts: false,
  compliance_logs: false,
  haccp_export: false,
  manual_report_export: false,
  ai_analytics: false,
  predictive_alerts: false,
  multi_site_dashboard: false,
  role_based_access: false,
  api_access: false,
  automated_audit_reporting: false,
  pdf_export: false,
  mfa: false,
  audit_log: false,
  webhook_integrations: false,
  ai_optimization: false,
  chain_benchmarking: false,
  esg_reporting: false,
  carbon_analytics: false,
  custom_integrations: false,
  dedicated_support: false,
  sla: false,
  custom_branding: false,
  priority_support: false,
}
