/**
 * Tier Features - Feature Flag System
 * 
 * Provides utilities for checking what features are enabled for a given
 * subscription tier or organization. This is the single source of truth
 * for feature gating across the platform.
 * 
 * @see #314 - Subscription Tier Data Model & Feature Flag System
 */

import { createClient } from '@/lib/supabase/client'
import type { SubscriptionTier } from '@/types/organization'

// ============================================================================
// Feature Key Constants
// ============================================================================

/**
 * All available feature keys in the platform.
 * Use these constants instead of magic strings.
 */
export const FEATURE_KEYS = {
  DEVICE_MONITORING: 'device_monitoring',
  ALERT_NOTIFICATIONS: 'alert_notifications',
  DASHBOARD_ANALYTICS: 'dashboard_analytics',
  DATA_EXPORT: 'data_export',
  CUSTOM_BRANDING: 'custom_branding',
  API_ACCESS: 'api_access',
  AI_DETECTION: 'ai_detection',
  PREDICTIVE_AI: 'predictive_ai',
  FLEET_ANALYTICS: 'fleet_analytics',
  ADVANCED_ALERTS: 'advanced_alerts',
  SSO: 'sso',
  AUDIT_LOGS: 'audit_logs',
  DATA_RETENTION_EXTENDED: 'data_retention_extended',
  MULTI_LOCATION: 'multi_location',
  FIRMWARE_MANAGEMENT: 'firmware_management',
  PRIORITY_SUPPORT: 'priority_support',
  UNLIMITED_USERS: 'unlimited_users',
  CUSTOM_INTEGRATIONS: 'custom_integrations',
  WHITE_LABEL: 'white_label',
  DEDICATED_INFRA: 'dedicated_infra',
} as const

export type FeatureKey = (typeof FEATURE_KEYS)[keyof typeof FEATURE_KEYS]

// ============================================================================
// Types
// ============================================================================

export interface TierFeature {
  feature_key: string
  enabled: boolean
  description: string | null
}

export interface TierFeaturesMap {
  [featureKey: string]: boolean
}

// ============================================================================
// Static Feature Map (fallback when DB is unavailable)
// ============================================================================

/**
 * Static feature definitions per tier. Used as fallback when
 * the database is unreachable (e.g., during static export builds).
 */
const STATIC_TIER_FEATURES: { [tier: string]: TierFeaturesMap } = {
  free: {
    device_monitoring: true,
    alert_notifications: false,
    dashboard_analytics: false,
    data_export: false,
    custom_branding: false,
    api_access: false,
    ai_detection: false,
    predictive_ai: false,
    fleet_analytics: false,
    advanced_alerts: false,
    sso: false,
    audit_logs: false,
    data_retention_extended: false,
    multi_location: false,
    firmware_management: false,
    priority_support: false,
    unlimited_users: false,
    custom_integrations: false,
    white_label: false,
    dedicated_infra: false,
  },
  starter: {
    device_monitoring: true,
    alert_notifications: true,
    dashboard_analytics: true,
    data_export: false,
    custom_branding: false,
    api_access: false,
    ai_detection: false,
    predictive_ai: false,
    fleet_analytics: false,
    advanced_alerts: false,
    sso: false,
    audit_logs: false,
    data_retention_extended: false,
    multi_location: false,
    firmware_management: false,
    priority_support: false,
    unlimited_users: false,
    custom_integrations: false,
    white_label: false,
    dedicated_infra: false,
  },
  professional: {
    device_monitoring: true,
    alert_notifications: true,
    dashboard_analytics: true,
    data_export: true,
    custom_branding: true,
    api_access: true,
    ai_detection: true,
    predictive_ai: false,
    fleet_analytics: true,
    advanced_alerts: true,
    sso: false,
    audit_logs: true,
    data_retention_extended: true,
    multi_location: true,
    firmware_management: true,
    priority_support: false,
    unlimited_users: false,
    custom_integrations: true,
    white_label: false,
    dedicated_infra: false,
  },
  enterprise: {
    device_monitoring: true,
    alert_notifications: true,
    dashboard_analytics: true,
    data_export: true,
    custom_branding: true,
    api_access: true,
    ai_detection: true,
    predictive_ai: true,
    fleet_analytics: true,
    advanced_alerts: true,
    sso: true,
    audit_logs: true,
    data_retention_extended: true,
    multi_location: true,
    firmware_management: true,
    priority_support: true,
    unlimited_users: true,
    custom_integrations: true,
    white_label: true,
    dedicated_infra: true,
  },
  reseller: {
    device_monitoring: true,
    alert_notifications: true,
    dashboard_analytics: true,
    data_export: true,
    custom_branding: true,
    api_access: true,
    ai_detection: true,
    predictive_ai: true,
    fleet_analytics: true,
    advanced_alerts: true,
    sso: true,
    audit_logs: true,
    data_retention_extended: true,
    multi_location: true,
    firmware_management: true,
    priority_support: true,
    unlimited_users: true,
    custom_integrations: true,
    white_label: true,
    dedicated_infra: true,
  },
}

// ============================================================================
// Client-side Feature Lookup Functions
// ============================================================================

/**
 * Fetch all feature flags for a given subscription tier from the database.
 * Falls back to static map if the database call fails.
 */
export async function getTierFeatures(
  tier: SubscriptionTier | string
): Promise<TierFeaturesMap> {
  try {
    const supabase = createClient()
    // Cast to 'any' until types are regenerated with tier_features table
    const { data, error } = await (supabase as any)
      .from('tier_features')
      .select('feature_key, enabled')
      .eq('tier', tier) as { data: { feature_key: string; enabled: boolean }[] | null; error: any }

    if (error || !data || data.length === 0) {
      console.warn(
        `[getTierFeatures] DB lookup failed for tier "${tier}", using static fallback`,
        error?.message
      )
      return STATIC_TIER_FEATURES[tier] ?? STATIC_TIER_FEATURES['starter']!
    }

    const featuresMap: TierFeaturesMap = {}
    for (const row of data) {
      featuresMap[row.feature_key] = row.enabled
    }
    return featuresMap
  } catch {
    return STATIC_TIER_FEATURES[tier] ?? STATIC_TIER_FEATURES['starter']!
  }
}

/**
 * Fetch all feature flags for an organization by its ID.
 * Looks up the org's subscription_tier, then returns its features.
 */
export async function getOrgFeatures(orgId: string): Promise<TierFeaturesMap> {
  try {
    const supabase = createClient()
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('subscription_tier')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      console.warn(
        `[getOrgFeatures] Could not find org "${orgId}"`,
        orgError?.message
      )
      return STATIC_TIER_FEATURES['starter']!
    }

    const tier = org.subscription_tier || 'starter'
    return getTierFeatures(tier)
  } catch {
    return STATIC_TIER_FEATURES['starter']!
  }
}

/**
 * Quick check: does the given tier have a specific feature enabled?
 */
export function tierHasFeature(
  tier: SubscriptionTier | string,
  featureKey: FeatureKey | string
): boolean {
  const tierMap = STATIC_TIER_FEATURES[tier]
  if (!tierMap) return false
  return tierMap[featureKey] ?? false
}

/**
 * Get the static feature map for a tier (synchronous, no DB call).
 * Useful for SSR/static builds where async isn't available.
 */
export function getStaticTierFeatures(
  tier: SubscriptionTier | string
): TierFeaturesMap {
  return STATIC_TIER_FEATURES[tier] ?? STATIC_TIER_FEATURES['starter']!
}

/**
 * Get all features across all tiers (for admin views).
 */
export async function getAllTierFeatures(): Promise<
  Record<string, TierFeaturesMap>
> {
  try {
    const supabase = createClient()
    // Cast to 'any' until types are regenerated with tier_features table
    const { data, error } = await (supabase as any)
      .from('tier_features')
      .select('tier, feature_key, enabled')
      .order('tier')
      .order('feature_key') as { data: { tier: string; feature_key: string; enabled: boolean }[] | null; error: any }

    if (error || !data) {
      console.warn('[getAllTierFeatures] DB lookup failed, using static fallback')
      return { ...STATIC_TIER_FEATURES }
    }

    const result: Record<string, TierFeaturesMap> = {}
    for (const row of data) {
      if (!result[row.tier]) result[row.tier] = {}
      result[row.tier]![row.feature_key] = row.enabled
    }
    return result
  } catch {
    return { ...STATIC_TIER_FEATURES }
  }
}

/**
 * Get all unique feature keys defined in the system.
 */
export function getAllFeatureKeys(): string[] {
  return Object.values(FEATURE_KEYS)
}

/**
 * Get feature display name from key.
 */
export function getFeatureDisplayName(featureKey: string): string {
  const displayNames: Record<string, string> = {
    device_monitoring: 'Device Monitoring',
    alert_notifications: 'Alert Notifications',
    dashboard_analytics: 'Dashboard Analytics',
    data_export: 'Data Export',
    custom_branding: 'Custom Branding',
    api_access: 'API Access',
    ai_detection: 'AI Detection',
    predictive_ai: 'Predictive AI',
    fleet_analytics: 'Fleet Analytics',
    advanced_alerts: 'Advanced Alerts',
    sso: 'Single Sign-On (SSO)',
    audit_logs: 'Audit Logs',
    data_retention_extended: 'Extended Data Retention',
    multi_location: 'Multi-Location',
    firmware_management: 'Firmware Management',
    priority_support: 'Priority Support',
    unlimited_users: 'Unlimited Users',
    custom_integrations: 'Custom Integrations',
    white_label: 'White Label',
    dedicated_infra: 'Dedicated Infrastructure',
  }
  return (
    displayNames[featureKey] ||
    featureKey
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  )
}

/**
 * Compare two tiers — returns features the upgrade tier gains.
 * Useful for upgrade prompts.
 */
export function getUpgradeFeatures(
  currentTier: SubscriptionTier | string,
  upgradeTier: SubscriptionTier | string
): string[] {
  const current = STATIC_TIER_FEATURES[currentTier] || {}
  const upgrade = STATIC_TIER_FEATURES[upgradeTier] || {}

  return Object.keys(upgrade).filter(
    (key) => upgrade[key] && !current[key]
  )
}
