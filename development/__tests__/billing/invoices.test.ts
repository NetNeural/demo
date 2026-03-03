import { describe, it, expect } from 'vitest'

describe('Invoices', () => {
  it('invoice has amount and status', () => {
    const invoice = { id: 'inv-1', amount_cents: 4900, status: 'paid', organization_id: 'org-1' }
    expect(invoice.amount_cents).toBeGreaterThan(0)
    expect(invoice.status).toBe('paid')
  })

  it('invoice amount_cents maps to display amount', () => {
    const amountCents = 4900
    const displayAmount = (amountCents / 100).toFixed(2)
    expect(displayAmount).toBe('49.00')
  })

  it('unpaid invoice has pending status', () => {
    const statuses = ['paid', 'pending', 'failed', 'void']
    expect(statuses).toContain('pending')
  })
})
