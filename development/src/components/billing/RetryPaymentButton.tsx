'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { RefreshCw, AlertTriangle } from 'lucide-react'

// Lazy singleton
let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

interface RetryPaymentButtonProps {
  paymentId: string
  stripePaymentIntent: string | null
  retryCount: number
  lastRetryAt: string | null
  onRetryComplete?: (success: boolean, message: string) => void
}

/** Max retries allowed per 24h window */
const MAX_RETRIES_24H = 3

/**
 * RetryPaymentButton shows a button to retry a failed payment.
 * Includes a confirmation dialog and rate limiting.
 */
export function RetryPaymentButton({
  paymentId,
  stripePaymentIntent,
  retryCount,
  lastRetryAt,
  onRetryComplete,
}: RetryPaymentButtonProps) {
  const [loading, setLoading] = useState(false)

  // Check if retry is allowed (rate limit: max 3 per 24h)
  const isRateLimited = (() => {
    if (retryCount >= MAX_RETRIES_24H && lastRetryAt) {
      const lastRetry = new Date(lastRetryAt)
      const now = new Date()
      const hoursSinceLastRetry =
        (now.getTime() - lastRetry.getTime()) / (1000 * 60 * 60)
      return hoursSinceLastRetry < 24
    }
    return false
  })()

  // No payment intent to retry
  if (!stripePaymentIntent) {
    return null
  }

  const handleRetry = async () => {
    setLoading(true)
    try {
      const supabase = getSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        onRetryComplete?.(false, 'Not authenticated')
        return
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/functions/v1/retry-payment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paymentId }),
        }
      )

      const result = await res.json()

      if (res.ok) {
        onRetryComplete?.(true, 'Payment retry initiated successfully')
      } else {
        onRetryComplete?.(
          false,
          result?.error ?? result?.message ?? 'Retry failed'
        )
      }
    } catch (err) {
      onRetryComplete?.(
        false,
        err instanceof Error ? err.message : 'An error occurred'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || isRateLimited}
          title={
            isRateLimited
              ? `Retry limit reached (${MAX_RETRIES_24H} per 24h). Try again later.`
              : 'Retry this payment'
          }
        >
          <RefreshCw
            className={`mr-1 h-3 w-3 ${loading ? 'animate-spin' : ''}`}
          />
          Retry
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Retry Payment
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will attempt to charge the payment method on file again. The
            customer&apos;s card will be charged if successful.
            {retryCount > 0 && (
              <span className="mt-2 block text-sm font-medium text-amber-600">
                This payment has been retried {retryCount} time
                {retryCount > 1 ? 's' : ''} already.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRetry} disabled={loading}>
            {loading ? 'Retrying...' : 'Confirm Retry'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
