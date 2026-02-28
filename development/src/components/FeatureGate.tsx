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
import { getFeatureDisplayName, getStaticTierFeatures } from '@/lib/tier-features'
import { Lock, ArrowUpRight } from 'lucide-react'

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
    <div className="relative rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Lock className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">
        {featureName}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Available on the{' '}
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${requiredTierInfo.badge}`}>
          {requiredTierInfo.label}
        </span>{' '}
        plan.{' '}
        {currentTier !== requiredTier && (
          <>
            You&apos;re on{' '}
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tierInfo.badge}`}>
              {tierInfo.label}
            </span>.
          </>
        )}
      </p>
      <a
        href="/dashboard/settings?tab=subscription"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        <ArrowUpRight className="h-4 w-4" />
        Upgrade Plan
      </a>
    </div>
  )
}

export default FeatureGate
