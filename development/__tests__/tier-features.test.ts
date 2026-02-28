/**
 * Tier Features & Feature Flag Tests
 *
 * Tests for the subscription tier data model and feature flag system.
 * Validates static feature maps, lookup functions, upgrade comparisons,
 * and feature display utilities.
 *
 * @see #314 - Subscription Tier Data Model & Feature Flag System
 */

import {
  FEATURE_KEYS,
  tierHasFeature,
  getStaticTierFeatures,
  getUpgradeFeatures,
  getFeatureDisplayName,
  getAllFeatureKeys,
  type TierFeaturesMap,
} from '@/lib/tier-features'

describe('Tier Features System', () => {
  // ========================================================================
  // FEATURE_KEYS constants
  // ========================================================================
  describe('FEATURE_KEYS', () => {
    test('contains all 20 expected feature keys', () => {
      expect(Object.keys(FEATURE_KEYS)).toHaveLength(20)
    })

    test('keys match their string values', () => {
      expect(FEATURE_KEYS.DEVICE_MONITORING).toBe('device_monitoring')
      expect(FEATURE_KEYS.AI_DETECTION).toBe('ai_detection')
      expect(FEATURE_KEYS.SSO).toBe('sso')
      expect(FEATURE_KEYS.WHITE_LABEL).toBe('white_label')
      expect(FEATURE_KEYS.DEDICATED_INFRA).toBe('dedicated_infra')
    })
  })

  // ========================================================================
  // getStaticTierFeatures
  // ========================================================================
  describe('getStaticTierFeatures', () => {
    test('returns features for starter tier', () => {
      const features = getStaticTierFeatures('starter')
      expect(features).toBeDefined()
      expect(features.device_monitoring).toBe(true)
      expect(features.ai_detection).toBe(false)
      expect(features.sso).toBe(false)
    })

    test('returns features for professional tier', () => {
      const features = getStaticTierFeatures('professional')
      expect(features.device_monitoring).toBe(true)
      expect(features.ai_detection).toBe(true)
      expect(features.fleet_analytics).toBe(true)
      expect(features.sso).toBe(false)
      expect(features.predictive_ai).toBe(false)
    })

    test('returns features for enterprise tier', () => {
      const features = getStaticTierFeatures('enterprise')
      expect(features.device_monitoring).toBe(true)
      expect(features.ai_detection).toBe(true)
      expect(features.sso).toBe(true)
      expect(features.predictive_ai).toBe(true)
      expect(features.white_label).toBe(true)
      expect(features.dedicated_infra).toBe(true)
    })

    test('enterprise has all features enabled', () => {
      const features = getStaticTierFeatures('enterprise')
      const allEnabled = Object.values(features).every((v) => v === true)
      expect(allEnabled).toBe(true)
    })

    test('falls back to starter for unknown tier', () => {
      const features = getStaticTierFeatures('nonexistent')
      const starterFeatures = getStaticTierFeatures('starter')
      expect(features).toEqual(starterFeatures)
    })

    test('returns features for free tier', () => {
      const features = getStaticTierFeatures('free')
      expect(features.device_monitoring).toBe(true)
      expect(features.alert_notifications).toBe(false)
    })

    test('returns features for reseller tier', () => {
      const features = getStaticTierFeatures('reseller')
      // Reseller gets same as enterprise
      const allEnabled = Object.values(features).every((v) => v === true)
      expect(allEnabled).toBe(true)
    })

    test('all tiers have same number of feature keys', () => {
      const tiers = ['free', 'starter', 'professional', 'enterprise', 'reseller']
      const keyCounts = tiers.map(
        (t) => Object.keys(getStaticTierFeatures(t)).length
      )
      // All should have same count
      expect(new Set(keyCounts).size).toBe(1)
    })
  })

  // ========================================================================
  // tierHasFeature
  // ========================================================================
  describe('tierHasFeature', () => {
    test('starter has device_monitoring', () => {
      expect(tierHasFeature('starter', 'device_monitoring')).toBe(true)
    })

    test('starter does not have ai_detection', () => {
      expect(tierHasFeature('starter', 'ai_detection')).toBe(false)
    })

    test('professional has ai_detection', () => {
      expect(tierHasFeature('professional', 'ai_detection')).toBe(true)
    })

    test('professional does not have sso', () => {
      expect(tierHasFeature('professional', 'sso')).toBe(false)
    })

    test('enterprise has sso', () => {
      expect(tierHasFeature('enterprise', 'sso')).toBe(true)
    })

    test('returns false for unknown tier', () => {
      expect(tierHasFeature('unknown', 'device_monitoring')).toBe(false)
    })

    test('returns false for unknown feature', () => {
      expect(tierHasFeature('enterprise', 'nonexistent_feature')).toBe(false)
    })

    test('works with FEATURE_KEYS constants', () => {
      expect(
        tierHasFeature('enterprise', FEATURE_KEYS.PREDICTIVE_AI)
      ).toBe(true)
      expect(
        tierHasFeature('starter', FEATURE_KEYS.PREDICTIVE_AI)
      ).toBe(false)
    })
  })

  // ========================================================================
  // Tier hierarchy (features are additive)
  // ========================================================================
  describe('tier feature hierarchy', () => {
    test('professional has all starter features plus more', () => {
      const starter = getStaticTierFeatures('starter')
      const professional = getStaticTierFeatures('professional')

      // Every feature enabled in starter must be enabled in professional
      for (const [key, value] of Object.entries(starter)) {
        if (value) {
          expect(professional[key]).toBe(true)
        }
      }

      // Professional must have more features than starter
      const starterCount = Object.values(starter).filter(Boolean).length
      const professionalCount = Object.values(professional).filter(Boolean).length
      expect(professionalCount).toBeGreaterThan(starterCount)
    })

    test('enterprise has all professional features plus more', () => {
      const professional = getStaticTierFeatures('professional')
      const enterprise = getStaticTierFeatures('enterprise')

      for (const [key, value] of Object.entries(professional)) {
        if (value) {
          expect(enterprise[key]).toBe(true)
        }
      }

      const professionalCount = Object.values(professional).filter(Boolean).length
      const enterpriseCount = Object.values(enterprise).filter(Boolean).length
      expect(enterpriseCount).toBeGreaterThan(professionalCount)
    })
  })

  // ========================================================================
  // getUpgradeFeatures
  // ========================================================================
  describe('getUpgradeFeatures', () => {
    test('starter → professional gains features', () => {
      const gained = getUpgradeFeatures('starter', 'professional')
      expect(gained.length).toBeGreaterThan(0)
      expect(gained).toContain('ai_detection')
      expect(gained).toContain('data_export')
      expect(gained).toContain('api_access')
    })

    test('professional → enterprise gains SSO and predictive AI', () => {
      const gained = getUpgradeFeatures('professional', 'enterprise')
      expect(gained).toContain('sso')
      expect(gained).toContain('predictive_ai')
      expect(gained).toContain('priority_support')
    })

    test('enterprise → enterprise gains nothing', () => {
      const gained = getUpgradeFeatures('enterprise', 'enterprise')
      expect(gained).toHaveLength(0)
    })

    test('enterprise → starter gains nothing (downgrade)', () => {
      const gained = getUpgradeFeatures('enterprise', 'starter')
      expect(gained).toHaveLength(0)
    })

    test('free → enterprise gains all except device_monitoring', () => {
      const gained = getUpgradeFeatures('free', 'enterprise')
      // Free only has device_monitoring, so enterprise gains everything else
      expect(gained.length).toBe(19)
      expect(gained).not.toContain('device_monitoring')
    })
  })

  // ========================================================================
  // getFeatureDisplayName
  // ========================================================================
  describe('getFeatureDisplayName', () => {
    test('returns proper display names', () => {
      expect(getFeatureDisplayName('device_monitoring')).toBe('Device Monitoring')
      expect(getFeatureDisplayName('ai_detection')).toBe('AI Detection')
      expect(getFeatureDisplayName('sso')).toBe('Single Sign-On (SSO)')
      expect(getFeatureDisplayName('data_export')).toBe('Data Export')
    })

    test('generates fallback name for unknown features', () => {
      const name = getFeatureDisplayName('some_new_feature')
      expect(name).toBe('Some New Feature')
    })
  })

  // ========================================================================
  // getAllFeatureKeys
  // ========================================================================
  describe('getAllFeatureKeys', () => {
    test('returns all 20 feature keys', () => {
      const keys = getAllFeatureKeys()
      expect(keys).toHaveLength(20)
    })

    test('includes expected values', () => {
      const keys = getAllFeatureKeys()
      expect(keys).toContain('device_monitoring')
      expect(keys).toContain('sso')
      expect(keys).toContain('dedicated_infra')
    })
  })

  // ========================================================================
  // Feature count per tier
  // ========================================================================
  describe('feature counts per tier', () => {
    test('free: 1 feature', () => {
      const features = getStaticTierFeatures('free')
      const enabledCount = Object.values(features).filter(Boolean).length
      expect(enabledCount).toBe(1)
    })

    test('starter: 3 features', () => {
      const features = getStaticTierFeatures('starter')
      const enabledCount = Object.values(features).filter(Boolean).length
      expect(enabledCount).toBe(3)
    })

    test('professional: 14 features', () => {
      const features = getStaticTierFeatures('professional')
      const enabledCount = Object.values(features).filter(Boolean).length
      expect(enabledCount).toBe(14)
    })

    test('enterprise: all 20 features', () => {
      const features = getStaticTierFeatures('enterprise')
      const enabledCount = Object.values(features).filter(Boolean).length
      expect(enabledCount).toBe(20)
    })
  })
})
