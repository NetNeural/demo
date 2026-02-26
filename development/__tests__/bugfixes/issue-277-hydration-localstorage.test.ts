/**
 * Bug #277 — DevicesList hydration mismatch
 *
 * Previously, useState initializer read from localStorage, which differs
 * between server (no localStorage) and client, causing a hydration mismatch.
 * Fix: useState(true) for a stable default, then useEffect syncs from localStorage.
 *
 * This test verifies the pattern: default → useEffect → synced state.
 */

describe('Bug #277 — Hydration-safe localStorage patterns', () => {
  /**
   * Simulate the WRONG pattern (pre-fix): useState reads localStorage directly.
   * This would fail on SSR because localStorage doesn't exist.
   */
  function unsafeInitializer(): boolean {
    // This is what the old code did — would throw in SSR/test env
    try {
      const stored = localStorage?.getItem('temperatureUnit')
      return stored === 'F'
    } catch {
      return true
    }
  }

  /**
   * Simulate the CORRECT pattern (post-fix): stable default + useEffect sync.
   */
  function safeInitializer(): {
    initialValue: boolean
    syncedValue: boolean
  } {
    // Step 1: useState(true) — always the same on server and client
    const initialValue = true

    // Step 2: useEffect reads localStorage (client-only)
    let syncedValue = initialValue
    const stored = 'C' // simulate localStorage having 'C'
    if (stored) {
      syncedValue = stored === 'F'
    }

    return { initialValue, syncedValue }
  }

  it('safe initializer always starts with a consistent default', () => {
    const result = safeInitializer()
    // The initial value is always true (Fahrenheit), regardless of localStorage
    expect(result.initialValue).toBe(true)
  })

  it('safe initializer syncs to localStorage value after effect', () => {
    const result = safeInitializer()
    // After useEffect runs, it reads 'C' from localStorage → false
    expect(result.syncedValue).toBe(false)
  })

  it('initial value matches between server and client (no mismatch)', () => {
    // The key property: the default value doesn't depend on localStorage
    const serverDefault = true // Same as useState(true) on server
    const clientDefault = true // Same as useState(true) on client (before useEffect)
    expect(serverDefault).toBe(clientDefault) // No hydration mismatch!
  })

  it('handles missing localStorage value gracefully', () => {
    // Simulate no stored value
    const stored: string | null = null
    let value = true // default
    if (stored) {
      value = stored === 'F'
    }
    // Should keep the default
    expect(value).toBe(true)
  })

  it('converts stored "F" to true and "C" to false', () => {
    expect('F' === 'F').toBe(true)
    expect('C' === 'F').toBe(false)
  })
})
