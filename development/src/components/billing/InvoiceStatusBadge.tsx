'use client'

import { Badge } from '@/components/ui/badge'
import type { InvoiceStatus } from '@/types/billing'
import { formatInvoiceStatus } from '@/types/billing'
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Ban,
  FileEdit,
} from 'lucide-react'

/** Color map for invoice status badges */
const STATUS_STYLES: Record<InvoiceStatus, string> = {
  paid: 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200',
  open: 'bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-200',
  draft: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200',
  void: 'bg-gray-100 text-gray-500 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400',
  uncollectible:
    'bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200',
}

const STATUS_ICONS: Record<InvoiceStatus, React.ReactNode> = {
  paid: <CheckCircle2 className="mr-1 h-3 w-3" />,
  open: <Circle className="mr-1 h-3 w-3" />,
  draft: <FileEdit className="mr-1 h-3 w-3" />,
  void: <Ban className="mr-1 h-3 w-3" />,
  uncollectible: <AlertTriangle className="mr-1 h-3 w-3" />,
}

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
  /** Show an "Overdue" variant for open invoices past their due date */
  overdue?: boolean
  /** Show icon alongside label */
  showIcon?: boolean
}

/**
 * Color-coded badge for invoice status.
 * Matches the spec: paid=green, open=blue, overdue=red, void=gray, draft=yellow
 */
export function InvoiceStatusBadge({
  status,
  overdue = false,
  showIcon = true,
}: InvoiceStatusBadgeProps) {
  // Overdue is a special sub-case of 'open'
  if (overdue && status === 'open') {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200">
        {showIcon && <AlertTriangle className="mr-1 h-3 w-3" />}
        Overdue
      </Badge>
    )
  }

  return (
    <Badge className={STATUS_STYLES[status]}>
      {showIcon && STATUS_ICONS[status]}
      {formatInvoiceStatus(status)}
    </Badge>
  )
}
