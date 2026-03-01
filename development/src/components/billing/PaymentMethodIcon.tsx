'use client'

import { CreditCard } from 'lucide-react'
import { formatCardBrand } from '@/types/billing'

interface PaymentMethodIconProps {
  brand: string | null
  last4: string | null
  methodType?: string | null
  /** Show the full label (brand + last 4) or just the icon */
  showLabel?: boolean
}

/**
 * Card brand SVG icons as inline components.
 * Falls back to a generic credit card icon for unknown brands.
 */
const BRAND_COLORS: Record<string, string> = {
  visa: 'text-blue-600',
  mastercard: 'text-orange-500',
  amex: 'text-blue-800',
  discover: 'text-orange-600',
  diners: 'text-blue-500',
  jcb: 'text-green-600',
  unionpay: 'text-red-600',
}

/**
 * PaymentMethodIcon displays a card brand icon with optional last-4 digits.
 * Example output: "Visa •••• 4242"
 */
export function PaymentMethodIcon({
  brand,
  last4,
  methodType,
  showLabel = true,
}: PaymentMethodIconProps) {
  const brandKey = brand?.toLowerCase() ?? ''
  const colorClass = BRAND_COLORS[brandKey] ?? 'text-muted-foreground'
  const displayBrand = formatCardBrand(brand)

  // Non-card payment methods
  if (methodType && methodType !== 'card') {
    return (
      <div className="flex items-center gap-1.5">
        <CreditCard className="h-4 w-4 text-muted-foreground" />
        {showLabel && (
          <span className="text-sm capitalize">{methodType.replace(/_/g, ' ')}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <CreditCard className={`h-4 w-4 ${colorClass}`} />
      {showLabel && (
        <span className="text-sm">
          {displayBrand}
          {last4 && (
            <span className="ml-1 text-muted-foreground">
              •••• {last4}
            </span>
          )}
        </span>
      )}
    </div>
  )
}
