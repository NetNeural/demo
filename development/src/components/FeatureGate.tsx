'use client'

/**
 * FeatureGate - Conditional rendering based on subscription tier features
 * 
 * Wraps children that should only render when a feature is enabled
 * for the current organization's tier. Optionally shows an upgrade
 * prompt when the feature is gated.
 * 
 * @example
 * ```tsx
 * <FeatureGate feature="ai_detection">
 *   <AIDetectionPanel />
 * </FeatureGate>
 * 
 * <FeatureGate feature="sso" fallback={<UpgradeBanner feature="sso" />}>
 *   <SSOSettings />
 * </FeatureGate>
 * ```
 * 
 * @see #314 - Subscription Tier Data Model & Feature Flag System
 */

import React from 'react'
import { useOrgTier, getTierDisplayInfo, type FeatureKey } from '@/hooks/useOrgTier'
import { getFeatureDisplayName } from '@/lib/tier-features'

// ============================================================================
// FeatureGate Component
// ============================================================================

interface FeatureGateProps {
  /** The feature key to check */
  feature: FeatureKey | string
  /** Content to render when the feature is enabled */
  children: React.ReactNode
  /** Optional fallback when the feature is disabled */
  fallback?: React.ReactNode
  /** If true, shows a default upgrade prompt when feature is disabled */
  showUpgradePrompt?: boolean
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = false,
}: FeatureGateProps) {
  const { hasFeature, tier } = useOrgTier()

  if (hasFeature(feature)) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (showUpgradePrompt) {
    return <DefaultUpgradePrompt feature={feature} currentTier={tier} />
  }

  return null
}

// ============================================================================
// Default Upgrade Prompt
// ============================================================================

interface DefaultUpgradePromptProps {
  feature: string
  currentTier: string
}

function DefaultUpgradePrompt({
  feature,
  currentTier,
}: DefaultUpgradePromptProps) {
  const featureName = getFeatureDisplayName(feature)
  const tierInfo = getTierDisplayInfo(currentTier)

  // Determine which tier unlocks this feature
  const tierOrder = ['free', 'starter', 'professional', 'enterprise']
  const { getStaticTierFeatures } = require('@/lib/tier-features')
  let requiredTier = 'enterprise'
  for (const t of tierOrder) {
    const features = getStaticTierFeatures(t)
    if (features[feature]) {
      requiredTier = t
      break
    }
  }
  const requiredTierInfo = getTierDisplayInfo(requiredTier)

  return (
    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
        <svg
          className="h-6 w-6 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {featureName}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        This feature requires the{' '}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${requiredTierInfo.badge}`}>
          {requiredTierInfo.label}
        </span>{' '}
        plan. You&apos;re currently on{' '}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tierInfo.badge}`}>
          {tierInfo.label}
        </span>.
      </p>
      <a
        href="/dashboard/plans-pricing"
        className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        View Plans & Upgrade
      </a>
    </div>
  )
}

export default FeatureGate
