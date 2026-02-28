'use client'

/**
 * useOrgTier - React hook for organization tier and feature flags
 * 
 * Provides the current organization's subscription tier, feature flags,
 * and helper functions for feature gating in UI components.
 * 
 * @example
 * ```tsx
 * const { tier, hasFeature, features, isLoading } = useOrgTier()
 * 
 * if (!hasFeature('ai_detection')) {
 *   return <UpgradePrompt feature="ai_detection" />
 * }
 * ```
 * 
 * @see #314 - Subscription Tier Data Model & Feature Flag System
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import {
  getTierFeatures,
  getStaticTierFeatures,
  getUpgradeFeatures,
  getFeatureDisplayName,
  FEATURE_KEYS,
  type TierFeaturesMap,
  type FeatureKey,
} from '@/lib/tier-features'
import type { SubscriptionTier } from '@/types/organization'

// ============================================================================
// Types
// ============================================================================

export interface UseOrgTierResult {
  /** Current organization's subscription tier */
  tier: SubscriptionTier
  /** Map of feature_key → enabled boolean */
  features: TierFeaturesMap
  /** Check if a specific feature is enabled */
  hasFeature: (featureKey: FeatureKey | string) => boolean
  /** Get features that would be gained by upgrading to a target tier */
  upgradeFeatures: (targetTier: SubscriptionTier | string) => string[]
  /** Get human-readable display name for a feature key */
  featureDisplayName: (featureKey: string) => string
  /** Whether the features are still loading from DB */
  isLoading: boolean
  /** Error message if DB lookup failed */
  error: string | null
  /** Refresh features from the database */
  refresh: () => Promise<void>
}

// ============================================================================
// Tier display metadata
// ============================================================================

export interface TierDisplayInfo {
  label: string
  color: string
  badge: string
  description: string
}

const TIER_DISPLAY: Record<string, TierDisplayInfo> = {
  free: {
    label: 'Free',
    color: 'gray',
    badge: 'bg-gray-100 text-gray-700',
    description: 'Basic monitoring only',
  },
  starter: {
    label: 'Monitor',
    color: 'blue',
    badge: 'bg-blue-100 text-blue-700',
    description: 'Essential IoT monitoring',
  },
  professional: {
    label: 'Protect+',
    color: 'purple',
    badge: 'bg-purple-100 text-purple-700',
    description: 'Advanced protection & analytics',
  },
  enterprise: {
    label: 'Command',
    color: 'amber',
    badge: 'bg-amber-100 text-amber-700',
    description: 'Full platform control',
  },
  reseller: {
    label: 'Reseller',
    color: 'emerald',
    badge: 'bg-emerald-100 text-emerald-700',
    description: 'Reseller partner tier',
  },
}

/**
 * Get display info for a subscription tier.
 */
export function getTierDisplayInfo(
  tier: SubscriptionTier | string
): TierDisplayInfo {
  return (
    TIER_DISPLAY[tier] || {
      label: tier.charAt(0).toUpperCase() + tier.slice(1),
      color: 'gray',
      badge: 'bg-gray-100 text-gray-700',
      description: '',
    }
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useOrgTier(): UseOrgTierResult {
  const { currentOrganization } = useOrganization()
  const tier = (currentOrganization?.subscription_tier ||
    'starter') as SubscriptionTier

  // Start with static features for instant rendering (no flicker)
  const [features, setFeatures] = useState<TierFeaturesMap>(() =>
    getStaticTierFeatures(tier)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFeatures = useCallback(async () => {
    if (!tier) return
    setIsLoading(true)
    setError(null)
    try {
      const dbFeatures = await getTierFeatures(tier)
      setFeatures(dbFeatures)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load tier features'
      setError(msg)
      // Keep static fallback
    } finally {
      setIsLoading(false)
    }
  }, [tier])

  // Load from DB when tier changes
  useEffect(() => {
    loadFeatures()
  }, [loadFeatures])

  // Update static features immediately when tier changes (before DB loads)
  useEffect(() => {
    setFeatures(getStaticTierFeatures(tier))
  }, [tier])

  const hasFeature = useCallback(
    (featureKey: FeatureKey | string): boolean => {
      return features[featureKey] ?? false
    },
    [features]
  )

  const upgradeFeaturesFn = useCallback(
    (targetTier: SubscriptionTier | string): string[] => {
      return getUpgradeFeatures(tier, targetTier)
    },
    [tier]
  )

  const featureDisplayName = useCallback(
    (featureKey: string): string => getFeatureDisplayName(featureKey),
    []
  )

  return useMemo(
    () => ({
      tier,
      features,
      hasFeature,
      upgradeFeatures: upgradeFeaturesFn,
      featureDisplayName,
      isLoading,
      error,
      refresh: loadFeatures,
    }),
    [
      tier,
      features,
      hasFeature,
      upgradeFeaturesFn,
      featureDisplayName,
      isLoading,
      error,
      loadFeatures,
    ]
  )
}

// Re-export feature keys for convenience
export { FEATURE_KEYS }
export type { FeatureKey, TierFeaturesMap }
