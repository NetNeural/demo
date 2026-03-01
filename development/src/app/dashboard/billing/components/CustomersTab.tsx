'use client'

import { CustomerTable } from '@/components/admin/CustomerTable'

/**
 * Customers tab — wraps the existing CustomerTable component
 * for display inside the Billing Administration page.
 * The parent page handles permission and org guards.
 */
export function CustomersTab() {
  return (
    <div className="space-y-6">
      <CustomerTable />
    </div>
  )
}
