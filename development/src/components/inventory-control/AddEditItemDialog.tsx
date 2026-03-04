/**
 * Add/Edit Inventory Item Dialog
 *
 * Full form for creating or updating an inventory item with all fields:
 * identification, quantities, pricing, hardware details, vendor/manufacturer, and tracking.
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
import { Loader2, Save } from 'lucide-react'
import type {
  InventoryItem,
  InventoryFormValues,
  HardwareCategory,
  Vendor,
} from './types'
import { CATEGORY_LABELS, DEFAULT_INVENTORY_FORM } from './types'

interface AddEditItemDialogProps {
  open: boolean
  onClose: () => void
  onSave: (values: InventoryFormValues, editId?: string) => Promise<void>
  editItem?: InventoryItem | null
  vendors: Vendor[]
}

export function AddEditItemDialog({
  open,
  onClose,
  onSave,
  editItem,
  vendors,
}: AddEditItemDialogProps) {
  const [form, setForm] = useState<InventoryFormValues>(DEFAULT_INVENTORY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editItem) {
      setForm({
        sku: editItem.sku,
        name: editItem.name,
        description: editItem.description,
        category: editItem.category,
        quantity_total: editItem.quantity_total.toString(),
        reorder_threshold: editItem.reorder_threshold.toString(),
        manufacturing_cost: editItem.manufacturing_cost.toFixed(2),
        wholesale_price: editItem.wholesale_price.toFixed(2),
        retail_price: editItem.retail_price.toFixed(2),
        currency: editItem.currency,
        model_number: editItem.model_number,
        hardware_version: editItem.hardware_version,
        firmware_version: editItem.firmware_version,
        serial_prefix: editItem.serial_prefix,
        manufacturer_id: editItem.manufacturer_id || '',
        vendor_id: editItem.vendor_id || '',
        supplier: editItem.supplier,
        warehouse_location: editItem.warehouse_location,
        batch_number: editItem.batch_number,
        manufacture_date: editItem.manufacture_date || '',
        notes: editItem.notes,
      })
    } else {
      setForm(DEFAULT_INVENTORY_FORM)
    }
  }, [editItem, open])

  const update = (field: keyof InventoryFormValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!form.name || !form.sku) return
    setSaving(true)
    try {
      await onSave(form, editItem?.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const manufacturers = vendors.filter(
    (v) => v.type === 'manufacturer' || v.type === 'oem_partner'
  )
  const supplierVendors = vendors.filter(
    (v) => v.type === 'vendor' || v.type === 'distributor'
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
          </DialogTitle>
          <DialogDescription>
            {editItem
              ? 'Update the details for this inventory item'
              : 'Add a new hardware item to your inventory'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Section: Identification */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Identification
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input
                  id="sku"
                  placeholder="NN-MS-001"
                  value={form.sku}
                  onChange={(e) => update('sku', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="Modular Sensor v3"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    update('category', v as HardwareCategory)
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model Number</Label>
                <Input
                  id="model"
                  placeholder="MS-V3-2026"
                  value={form.model_number}
                  onChange={(e) => update('model_number', e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  placeholder="Brief description of this hardware item..."
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Section: Quantities */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Quantities
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="qty">Total Quantity</Label>
                <Input
                  id="qty"
                  type="number"
                  min="0"
                  value={form.quantity_total}
                  onChange={(e) => update('quantity_total', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorder">Reorder Threshold</Label>
                <Input
                  id="reorder"
                  type="number"
                  min="0"
                  value={form.reorder_threshold}
                  onChange={(e) => update('reorder_threshold', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: Pricing */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pricing
            </h4>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="mfg_cost">Manufacturing Cost</Label>
                <Input
                  id="mfg_cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.manufacturing_cost}
                  onChange={(e) => update('manufacturing_cost', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wholesale">Wholesale Price</Label>
                <Input
                  id="wholesale"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.wholesale_price}
                  onChange={(e) => update('wholesale_price', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="retail">Retail Price</Label>
                <Input
                  id="retail"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.retail_price}
                  onChange={(e) => update('retail_price', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => update('currency', v)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="CAD">CAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Section: Vendor / Manufacturer */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Vendor / Manufacturer
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Select
                  value={form.manufacturer_id || '_none'}
                  onValueChange={(v) =>
                    update('manufacturer_id', v === '_none' ? '' : v)
                  }
                >
                  <SelectTrigger id="manufacturer">
                    <SelectValue placeholder="Select manufacturer..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {manufacturers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor / Supplier</Label>
                <Select
                  value={form.vendor_id || '_none'}
                  onValueChange={(v) =>
                    update('vendor_id', v === '_none' ? '' : v)
                  }
                >
                  <SelectTrigger id="vendor">
                    <SelectValue placeholder="Select vendor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {supplierVendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier_text">Supplier (free text)</Label>
                <Input
                  id="supplier_text"
                  placeholder="Legacy supplier name"
                  value={form.supplier}
                  onChange={(e) => update('supplier', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: Hardware Details */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Hardware Details
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="hw_ver">Hardware Version</Label>
                <Input
                  id="hw_ver"
                  placeholder="v3.0"
                  value={form.hardware_version}
                  onChange={(e) => update('hardware_version', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fw_ver">Firmware Version</Label>
                <Input
                  id="fw_ver"
                  placeholder="1.2.0"
                  value={form.firmware_version}
                  onChange={(e) => update('firmware_version', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serial_pfx">Serial Prefix</Label>
                <Input
                  id="serial_pfx"
                  placeholder="NN-"
                  value={form.serial_prefix}
                  onChange={(e) => update('serial_prefix', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Section: Tracking */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tracking
            </h4>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="warehouse">Warehouse Location</Label>
                <Input
                  id="warehouse"
                  placeholder="Warehouse A, Shelf 3"
                  value={form.warehouse_location}
                  onChange={(e) => update('warehouse_location', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch">Batch Number</Label>
                <Input
                  id="batch"
                  placeholder="B2026-03-001"
                  value={form.batch_number}
                  onChange={(e) => update('batch_number', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfg_date">Manufacture Date</Label>
                <Input
                  id="mfg_date"
                  type="date"
                  value={form.manufacture_date}
                  onChange={(e) => update('manufacture_date', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes..."
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !form.name || !form.sku}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {editItem ? 'Update Item' : 'Add Item'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
