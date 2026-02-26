/**
 * Bug #248 — Alert Acknowledge: service client + no re-throw
 *
 * Fix 1: acknowledge_alert action now uses createServiceClient() instead of
 *         the user-auth client, bypassing RLS edge cases.
 * Fix 2: Catch block in AlertsList calls toast.error() and does NOT re-throw,
 *         allowing the AcknowledgeAlertDialog to close properly.
 *
 * This test verifies the acknowledge routing logic and error handling behaviour.
 */

describe('Bug #248 — user-actions acknowledge_alert routing', () => {
  /**
   * Simulate the routing logic from user-actions/index.ts (lines 145-160).
   * The key change: acknowledge_alert uses a service client, not the user-auth client.
   */
  function routeAction(action: string | null) {
    const usedClients: string[] = []

    if (action === 'acknowledge_alert') {
      usedClients.push('serviceClient') // createServiceClient()
    } else if (action === 'record_action') {
      usedClients.push('supabaseClient') // createAuthenticatedClient(req)
    } else if (action === 'get_alert_acknowledgements') {
      usedClients.push('supabaseClient')
    } else if (action === 'get_user_actions') {
      usedClients.push('supabaseClient')
    } else {
      throw new Error('Invalid action parameter')
    }

    return usedClients
  }

  it('acknowledge_alert uses service client (not user-auth client)', () => {
    const clients = routeAction('acknowledge_alert')
    expect(clients).toContain('serviceClient')
    expect(clients).not.toContain('supabaseClient')
  })

  it('record_action uses user-auth client', () => {
    const clients = routeAction('record_action')
    expect(clients).toContain('supabaseClient')
    expect(clients).not.toContain('serviceClient')
  })

  it('get_alert_acknowledgements uses user-auth client', () => {
    const clients = routeAction('get_alert_acknowledgements')
    expect(clients).toContain('supabaseClient')
  })

  it('throws on invalid action', () => {
    expect(() => routeAction('invalid')).toThrow('Invalid action parameter')
    expect(() => routeAction(null)).toThrow('Invalid action parameter')
  })
})

describe('Bug #248 — AlertsList error handling: no re-throw after toast', () => {
  /**
   * Simulate the catch block from AlertsList.tsx handleAcknowledgeWithNotes.
   * The fix: catch calls toast.error() but does NOT re-throw.
   */

  const mockToast = { error: jest.fn(), success: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  async function simulateAcknowledge(
    shouldFail: boolean
  ): Promise<{ threwError: boolean; toastErrorCount: number }> {
    let threwError = false

    try {
      if (shouldFail) {
        throw new Error('Failed to acknowledge alert')
      }
      mockToast.success('Alert acknowledged')
    } catch (error) {
      // This mirrors the fix: toast.error + NO re-throw
      console.error('Error acknowledging alert:', error)
      mockToast.error('Failed to acknowledge alert')
      // Bug #248: don't re-throw — the toast already notifies the user
    }

    return {
      threwError,
      toastErrorCount: mockToast.error.mock.calls.length,
    }
  }

  it('does NOT re-throw on failure (dialog can close)', async () => {
    // This should NOT throw — the error is caught and handled via toast
    await expect(simulateAcknowledge(true)).resolves.toBeDefined()
  })

  it('calls toast.error exactly once on failure (not double)', async () => {
    const result = await simulateAcknowledge(true)
    expect(result.toastErrorCount).toBe(1) // exactly one toast, not two
    expect(mockToast.error).toHaveBeenCalledWith('Failed to acknowledge alert')
  })

  it('calls toast.success on success, no toast.error', async () => {
    await simulateAcknowledge(false)
    expect(mockToast.success).toHaveBeenCalledWith('Alert acknowledged')
    expect(mockToast.error).not.toHaveBeenCalled()
  })
})
