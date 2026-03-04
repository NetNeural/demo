'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CreditCard,
  Plus,
  Star,
  AlertTriangle,
  Wifi,
  Building2,
  Banknote,
} from 'lucide-react'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

interface PaymentMethod {
  id: string
  stripe_payment_method_id: string
  card_brand: string | null
  card_last4: string | null
  card_exp_month: number | null
  card_exp_year: number | null
  payment_method_type: string
  wallet_type: string | null
  is_default: boolean
}

interface PaymentMethodsCardProps {
  organizationId: string
  /** Called to open the Stripe Customer Portal — parent manages this */
  onManageSubscription: () => void
  portalLoading?: boolean
}

const BRAND_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
}

function CardBrandIcon({ brand }: { brand: string | null }) {
  const normalized = brand?.toLowerCase() ?? ''
  const color =
    normalized === 'visa'
      ? 'text-blue-600'
      : normalized === 'mastercard'
        ? 'text-red-500'
        : normalized === 'amex'
          ? 'text-cyan-600'
          : 'text-muted-foreground'

  return <CreditCard className={`h-5 w-5 ${color}`} />
}

function isExpired(month: number | null, year: number | null): boolean {
  if (!month || !year) return false
  const now = new Date()
  const expiry = new Date(year, month - 1, 1)
  // expired if the expiry month is BEFORE this month
  return expiry < new Date(now.getFullYear(), now.getMonth(), 1)
}

export function PaymentMethodsCard({
  organizationId,
  onManageSubscription,
  portalLoading = false,
}: PaymentMethodsCardProps) {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMethods = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabase()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (supabase as any)
        .from('customer_payment_methods')
        .select(
          'id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, payment_method_type, wallet_type, is_default'
        )
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (err) throw err
      setMethods(data ?? [])
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Failed to load payment methods'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchMethods()
  }, [fetchMethods])

  const renderMethodRow = (pm: PaymentMethod) => {
    const expired = isExpired(pm.card_exp_month, pm.card_exp_year)
    const brandLabel = pm.card_brand
      ? (BRAND_LABELS[pm.card_brand.toLowerCase()] ?? pm.card_brand)
      : null

    let displayName = ''
    let subLabel = ''

    if (pm.payment_method_type === 'us_bank_account') {
      displayName = 'Bank account'
      subLabel = pm.card_last4 ? `••••${pm.card_last4}` : ''
    } else if (pm.wallet_type === 'apple_pay') {
      displayName = 'Apple Pay'
      subLabel = brandLabel ? `via ${brandLabel}` : ''
    } else if (pm.wallet_type === 'google_pay') {
      displayName = 'Google Pay'
      subLabel = brandLabel ? `via ${brandLabel}` : ''
    } else {
      displayName = brandLabel ?? 'Card'
      subLabel = pm.card_last4 ? `•••• •••• •••• ${pm.card_last4}` : ''
    }

    const expiryLabel =
      pm.card_exp_month && pm.card_exp_year
        ? `${String(pm.card_exp_month).padStart(2, '0')}/${String(pm.card_exp_year).slice(-2)}`
        : null

    const MethodIcon =
      pm.payment_method_type === 'us_bank_account'
        ? Banknote
        : pm.wallet_type
          ? Wifi
          : CreditCard

    return (
      <div
        key={pm.id}
        data-testid="payment-method-row"
        className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
          expired
            ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
            : 'bg-muted/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <CardBrandIcon brand={pm.card_brand} />
          <div>
            <p className="text-sm font-medium">
              {displayName}{' '}
              {subLabel && (
                <span className="font-mono text-muted-foreground">
                  {subLabel}
                </span>
              )}
            </p>
            {expiryLabel && (
              <p
                className={`text-xs ${expired ? 'font-medium text-red-600' : 'text-muted-foreground'}`}
              >
                {expired ? '⚠ Expired' : 'Expires'} {expiryLabel}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pm.is_default && (
            <Badge variant="secondary" className="text-xs">
              <Star className="mr-1 h-3 w-3" />
              Default
            </Badge>
          )}
          {expired && (
            <Badge variant="destructive" className="text-xs">
              Expired
            </Badge>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card data-testid="payment-methods-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-lg">Payment Methods</CardTitle>
          <CardDescription>Cards and accounts used for billing</CardDescription>
        </div>
        <Button
          data-testid="add-payment-method-btn"
          variant="outline"
          size="sm"
          onClick={onManageSubscription}
          disabled={portalLoading}
        >
          <Plus className="mr-2 h-4 w-4" />
          {portalLoading ? 'Opening...' : 'Add / Manage'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : methods.length === 0 ? (
          <div
            data-testid="no-payment-method"
            className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No payment method on file</p>
              <p className="text-xs text-muted-foreground">
                Add a card to enable automatic billing at the end of your trial.
              </p>
            </div>
            <Button
              data-testid="add-first-payment-method-btn"
              size="sm"
              onClick={onManageSubscription}
              disabled={portalLoading}
            >
              <Plus className="mr-2 h-4 w-4" />
              {portalLoading ? 'Opening...' : 'Add Payment Method'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {methods.map(renderMethodRow)}
            <p className="pt-1 text-xs text-muted-foreground">
              To add, remove, or change your default payment method, use the{' '}
              <button
                onClick={onManageSubscription}
                className="underline hover:text-foreground"
              >
                billing portal
              </button>
              .
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
