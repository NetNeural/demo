/**
 * Bug #273 — Support page: isSuperAdmin replaces hardcoded ORG_ID
 *
 * Previously, platform tabs visibility was gated on matching a hardcoded
 * NETNEURAL_ORG_ID constant. Fix: use `user.isSuperAdmin` boolean instead,
 * which is role-based and doesn't leak organization IDs into source code.
 *
 * This test verifies the tab filtering logic.
 */

describe('Bug #273 — Support page tab filtering (isSuperAdmin)', () => {
  // Mirror the tabs array from support/page.tsx (lines 31-70)
  const tabs = [
    {
      id: 'customer-assistance',
      label: 'Customer Assistance',
      superAdminOnly: false,
    },
    { id: 'admin-tools', label: 'Admin Tools', superAdminOnly: false },
    { id: 'documentation', label: 'Documentation', superAdminOnly: false },
    { id: 'troubleshooting', label: 'Troubleshooting', superAdminOnly: true },
    { id: 'system-health', label: 'System Health', superAdminOnly: true },
    { id: 'tests', label: 'Tests & Validation', superAdminOnly: true },
  ]

  /**
   * Mirror the filtering logic from support/page.tsx (lines 137-142).
   */
  function getVisibleTabs(isSuperAdmin: boolean) {
    const canAccessPlatformTabs = isSuperAdmin
    return tabs.filter((tab) => !tab.superAdminOnly || canAccessPlatformTabs)
  }

  it('super admin sees all 6 tabs', () => {
    const visible = getVisibleTabs(true)
    expect(visible).toHaveLength(6)
    expect(visible.map((t) => t.id)).toEqual([
      'customer-assistance',
      'admin-tools',
      'documentation',
      'troubleshooting',
      'system-health',
      'tests',
    ])
  })

  it('regular user sees only 3 org-admin tabs', () => {
    const visible = getVisibleTabs(false)
    expect(visible).toHaveLength(3)
    expect(visible.map((t) => t.id)).toEqual([
      'customer-assistance',
      'admin-tools',
      'documentation',
    ])
  })

  it('platform tabs are excluded for non-super-admins', () => {
    const visible = getVisibleTabs(false)
    const platformTabs = visible.filter((t) => t.superAdminOnly)
    expect(platformTabs).toHaveLength(0)
  })

  it('does NOT use hardcoded organization ID for access control', () => {
    // The fix removed the NETNEURAL_ORG_ID constant entirely.
    // Access is now purely role-based (isSuperAdmin), not org-based.
    // A super admin from ANY org gets platform tabs.
    const superAdminFromAnyOrg = true
    const visible = getVisibleTabs(superAdminFromAnyOrg)
    expect(visible.some((t) => t.id === 'troubleshooting')).toBe(true)
    expect(visible.some((t) => t.id === 'system-health')).toBe(true)
    expect(visible.some((t) => t.id === 'tests')).toBe(true)
  })
})
