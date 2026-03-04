/**
 * Issue Hardware Dialog
 *
 * Dialog to issue hardware from inventory to a customer organization.
 * Tracks quantity, serial numbers, pricing, shipping, and notes.
 */
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Truck, AlertCircle } from 'lucide-react'
import type { InventoryItem, IssuanceFormValues } from './types'
import { DEFAULT_ISSUANCE_FORM, CATEGORY_LABELS } from './types'

interface Organization {
  id: string
  name: string
}

interface IssueHardwareDialogProps {
  open: boolean
  onClose: () => void
  onIssue: (values: IssuanceFormValues) => Promise<void>
  item: InventoryItem | null
  organizations: Organization[]
}

function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function IssueHardwareDialog({
  open,
  onClose,
  onIssue,
  item,
  organizations,
}: IssueHardwareDialogProps) {
  const [form, setForm] = useState<IssuanceFormValues>(DEFAULT_ISSUANCE_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setForm({
        ...DEFAULT_ISSUANCE_FORM,
        inventory_item_id: item.id,
        unit_price: item.retail_price.toFixed(2),
      })
    } else {
      setForm(DEFAULT_ISSUANCE_FORM)
    }
  }, [item, open])

  const update = (field: keyof IssuanceFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const quantity = parseInt(form.quantity, 10) || 0
  const unitPrice = parseFloat(form.unit_price) || 0
  const totalPrice = quantity * unitPrice
  const maxQty = item?.quantity_available || 0

  const handleSubmit = async () => {
    if (!form.customer_org_id || quantity <= 0 || quantity > maxQty) return
    setSaving(true)
    try {
      await onIssue(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Hardware to Customer</DialogTitle>
          <DialogDescription>
            Ship inventory to a customer organization
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Item Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Item Being Issued
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    SKU: {item.sku} · Model: {item.model_number}
                  </p>
                  <div className="mt-1 flex gap-2">
                    <Badge variant="outline">
                      {CATEGORY_LABELS[item.category]}
                    </Badge>
                    {item.manufacturer_name && (
                      <Badge variant="secondary">
                        Mfg: {item.manufacturer_name}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    {item.quantity_available}
                  </p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer Organization *</Label>
            <Select
              value={form.customer_org_id || '_none'}
              onValueChange={(v) =>
                update('customer_org_id', v === '_none' ? '' : v)
              }
            >
              <SelectTrigger id="customer">
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Select —</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity & Pricing */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="issue_qty">Quantity *</Label>
              <Input
                id="issue_qty"
                type="number"
                min="1"
                max={maxQty}
                value={form.quantity}
                onChange={(e) => update('quantity', e.target.value)}
              />
              {quantity > maxQty && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  Exceeds available ({maxQty})
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_price">Unit Price</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                min="0"
                value={form.unit_price}
                onChange={(e) => update('unit_price', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <div className="flex h-10 items-center rounded-md border bg-muted px-3 font-mono">
                {formatCurrency(totalPrice, item.currency)}
              </div>
            </div>
          </div>

          {/* Serial Numbers */}
          <div className="space-y-2">
            <Label htmlFor="serials">Serial Numbers</Label>
            <Textarea
              id="serials"
              placeholder="One per line, e.g.&#10;NN-MS-00001&#10;NN-MS-00002"
              value={form.serial_numbers}
              onChange={(e) => update('serial_numbers', e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Enter serial numbers for each unit (one per line)
            </p>
          </div>

          {/* Tracking & Notes */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking Number</Label>
              <Input
                id="tracking"
                placeholder="Shipping tracking number"
                value={form.tracking_number}
                onChange={(e) => update('tracking_number', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="issue_notes">Notes</Label>
            <Textarea
              id="issue_notes"
              placeholder="Special instructions, PO number, etc."
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              saving ||
              !form.customer_org_id ||
              quantity <= 0 ||
              quantity > maxQty
            }
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Truck className="mr-2 h-4 w-4" />
                Issue {quantity} Unit{quantity !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
