// ============================================================
// Project Hydra – Reseller Ecosystem Types
// Stories: #326–#399
// ============================================================

export interface ResellerTier {
  id: string
  name: string // 'Starter' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  min_sensors: number
  max_sensors: number | null
  discount_pct: number // e.g. 0.15 = 15%
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ResellerSensorCount {
  organization_id: string
  direct_sensors: number
  downstream_sensors: number
  effective_total: number
  current_tier_id: string | null
  next_tier_id: string | null
  sensors_to_next_tier: number | null
  last_calculated_at: string
}

export interface ResellerTierEngineResult {
  org_id: string
  org_name: string
  current_tier: string
  current_tier_id: string
  discount_pct: number
  effective_total: number
  direct_sensors: number
  downstream_sensors: number
  sensors_to_next_tier: number
  next_tier_name: string | null
  next_tier_discount: number | null
  grace_active: boolean
  tier_locked_until: string | null
  tier_lock_reason: string | null
}

export interface ResellerPayout {
  id: string
  invoice_id: string | null
  organization_id: string
  payout_amount: number
  spread_pct: number
  sensor_count: number
  subscription_price: number
  status: 'pending' | 'paid' | 'failed'
  period_start: string | null
  period_end: string | null
  calculated_at: string
  paid_at: string | null
  created_at: string
}

export interface BillingSplitResult {
  subscription_price: number
  payouts: BillingPayoutLevel[]
  total_reseller_payout: number
  netneural_amount: number
  netneural_pct: number
  floor_violated: boolean
  floor_pct: number
}

export interface BillingPayoutLevel {
  org_id: string
  org_name: string
  depth: number
  tier_name: string
  discount_pct: number
  spread_pct: number
  payout_amount: number
  floor_applied: boolean
}

export interface ResellerInvitation {
  id: string
  inviter_org_id: string
  invitee_email: string
  token: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  invited_by_user: string | null
  accepted_org_id: string | null
  expires_at: string
  created_at: string
  accepted_at: string | null
  revoked_at: string | null
}

export interface ResellerBranding {
  id: string
  organization_id: string
  company_display_name: string | null
  tagline: string | null
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  support_email: string | null
  signup_headline: string | null
  signup_subtitle: string | null
  created_at: string
  updated_at: string
}

export interface SignupAttribution {
  id: string
  reseller_org_id: string
  reseller_slug: string
  new_org_id: string | null
  new_user_id: string | null
  invitation_id: string | null
  created_at: string
}

export interface ResellerTreeNode {
  id: string
  name: string
  slug: string
  parent_id: string | null
  depth: number
  path: string[]
  // Enriched from reseller_sensor_counts
  sensor_count?: number
  tier_name?: string
  tier_discount?: number
  children?: ResellerTreeNode[]
}

export type SupportModel = 'self' | 'hybrid' | 'netneural'

/** Tier color coding for UI */
export const TIER_COLORS: Record<string, string> = {
  Starter: '#6b7280', // gray
  Bronze: '#b45309', // amber-700
  Silver: '#64748b', // slate
  Gold: '#d97706', // amber-600
  Platinum: '#7c3aed', // violet
}

export const TIER_BG_COLORS: Record<string, string> = {
  Starter: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Bronze:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  Silver: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  Gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  Platinum:
    'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
}
