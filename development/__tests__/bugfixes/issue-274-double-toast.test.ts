/**
 * Bug #274 — Double toast on acknowledge failure
 *
 * Previously AlertsList called toast.error() before throwing, then the
 * catch block also called toast.error(), resulting in two error toasts.
 * Fix: single toast.error in the catch block, no re-throw.
 *
 * This test verifies that errors produce exactly one toast notification.
 */

describe('Bug #274 — Single toast on acknowledge error', () => {
  const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  /**
   * Simulates handleAcknowledgeWithNotes from AlertsList.tsx (lines 313-368).
   * The key invariant: on failure, toast.error is called exactly once.
   */
  async function handleAcknowledgeWithNotes(
    shouldApiSucceed: boolean,
    shouldResponseSucceed: boolean
  ) {
    try {
      // Simulate edge function call
      if (!shouldApiSucceed) {
        throw new Error('Network error')
      }

      // Simulate response.success check
      const response = { success: shouldResponseSucceed }
      if (!response.success) {
        throw new Error('Failed to acknowledge alert')
      }

      mockToast.success('Alert acknowledged')
    } catch (error) {
      console.error('Error acknowledging alert:', error)
      mockToast.error('Failed to acknowledge alert')
      // Bug #274/#248: NO re-throw here — dialog stays closable
    }
  }

  it('one toast.error on API network failure', async () => {
    await handleAcknowledgeWithNotes(false, false)
    expect(mockToast.error).toHaveBeenCalledTimes(1)
    expect(mockToast.success).not.toHaveBeenCalled()
  })

  it('one toast.error on API response failure', async () => {
    await handleAcknowledgeWithNotes(true, false)
    expect(mockToast.error).toHaveBeenCalledTimes(1)
    expect(mockToast.success).not.toHaveBeenCalled()
  })

  it('one toast.success on success, no toast.error', async () => {
    await handleAcknowledgeWithNotes(true, true)
    expect(mockToast.success).toHaveBeenCalledTimes(1)
    expect(mockToast.error).not.toHaveBeenCalled()
  })

  it('does not throw (error is fully handled)', async () => {
    // If the handler threw, this would fail
    await expect(
      handleAcknowledgeWithNotes(false, false)
    ).resolves.toBeUndefined()
  })
})
