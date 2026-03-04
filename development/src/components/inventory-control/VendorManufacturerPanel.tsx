/**
 * Vendor & Manufacturer Management Panel
 *
 * CRUD for vendors, manufacturers, distributors, and OEM partners.
 * Tracks contact info, addresses, payment terms, lead times, quality ratings,
 * and which product categories each vendor supplies.
 */
'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Building,
  Star,
  Globe,
  Mail,
  Phone,
  Loader2,
  Save,
  Factory,
} from 'lucide-react'
import type {
  Vendor,
  VendorFormValues,
  VendorType,
  VendorStatus,
  HardwareCategory,
} from './types'
import {
  VENDOR_TYPE_LABELS,
  VENDOR_STATUS_CONFIG,
  CATEGORY_LABELS,
  DEFAULT_VENDOR_FORM,
} from './types'

interface VendorManufacturerPanelProps {
  vendors: Vendor[]
  onSave: (values: VendorFormValues, editId?: string) => Promise<void>
  onDelete: (vendor: Vendor) => Promise<void>
}

function QualityStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  )
}

export function VendorManufacturerPanel({
  vendors,
  onSave,
  onDelete,
}: VendorManufacturerPanelProps) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<VendorType | 'all'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editVendor, setEditVendor] = useState<Vendor | null>(null)
  const [form, setForm] = useState<VendorFormValues>(DEFAULT_VENDOR_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Vendor | null>(null)

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase()
    const matchSearch =
      !search ||
      v.name.toLowerCase().includes(q) ||
      v.contact_name.toLowerCase().includes(q) ||
      v.contact_email.toLowerCase().includes(q) ||
      v.city.toLowerCase().includes(q) ||
      v.country.toLowerCase().includes(q)
    const matchType = typeFilter === 'all' || v.type === typeFilter
    return matchSearch && matchType
  })

  const openAdd = () => {
    setEditVendor(null)
    setForm(DEFAULT_VENDOR_FORM)
    setDialogOpen(true)
  }

  const openEdit = (vendor: Vendor) => {
    setEditVendor(vendor)
    setForm({
      name: vendor.name,
      type: vendor.type,
      status: vendor.status,
      contact_name: vendor.contact_name,
      contact_email: vendor.contact_email,
      contact_phone: vendor.contact_phone,
      website: vendor.website,
      address_line1: vendor.address_line1,
      address_line2: vendor.address_line2,
      city: vendor.city,
      state_province: vendor.state_province,
      postal_code: vendor.postal_code,
      country: vendor.country,
      tax_id: vendor.tax_id,
      payment_terms: vendor.payment_terms,
      lead_time_days: vendor.lead_time_days.toString(),
      quality_rating: vendor.quality_rating.toString(),
      categories: [...vendor.categories],
      notes: vendor.notes,
    })
    setDialogOpen(true)
  }

  const update = (field: keyof VendorFormValues, value: string | HardwareCategory[]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const toggleCategory = (cat: HardwareCategory) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }))
  }

  const handleSubmit = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      await onSave(form, editVendor?.id)
      setDialogOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    await onDelete(deleteConfirm)
    setDeleteConfirm(null)
  }

  // Counts by type
  const manufacturerCount = vendors.filter(
    (v) => v.type === 'manufacturer' || v.type === 'oem_partner'
  ).length
  const vendorCount = vendors.filter(
    (v) => v.type === 'vendor' || v.type === 'distributor'
  ).length

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Partners
            </CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Manufacturers
            </CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{manufacturerCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Vendors / Distributors
            </CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendorCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors / manufacturers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as VendorType | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(VENDOR_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Vendor / Manufacturer
        </Button>
      </div>

      {/* Vendor Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12">
          <Building className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">
            {vendors.length === 0
              ? 'No vendors or manufacturers yet'
              : 'No results match your search'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your vendors, manufacturers, and OEM partners
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Lead Time</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Categories</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((vendor) => {
                const statusCfg = VENDOR_STATUS_CONFIG[vendor.status]
                return (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {VENDOR_TYPE_LABELS[vendor.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {vendor.contact_name && (
                          <p>{vendor.contact_name}</p>
                        )}
                        {vendor.contact_email && (
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {vendor.contact_email}
                          </p>
                        )}
                        {vendor.contact_phone && (
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {vendor.contact_phone}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[vendor.city, vendor.state_province, vendor.country]
                        .filter(Boolean)
                        .join(', ')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {vendor.lead_time_days > 0
                        ? `${vendor.lead_time_days} days`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <QualityStars rating={vendor.quality_rating} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {vendor.categories.map((cat) => (
                          <Badge
                            key={cat}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {CATEGORY_LABELS[cat]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusCfg.variant}>
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(vendor)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(vendor)}
                          title="Delete"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editVendor ? 'Edit Vendor / Manufacturer' : 'Add Vendor / Manufacturer'}
            </DialogTitle>
            <DialogDescription>
              Manage your supply chain partners
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Basic Info */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Basic Information
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="v_name">Name *</Label>
                  <Input
                    id="v_name"
                    placeholder="Acme Manufacturing Co."
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_type">Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => update('type', v as VendorType)}
                  >
                    <SelectTrigger id="v_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(VENDOR_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => update('status', v as VendorStatus)}
                  >
                    <SelectTrigger id="v_status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(VENDOR_STATUS_CONFIG).map(
                        ([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            {cfg.label}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_website">Website</Label>
                  <Input
                    id="v_website"
                    placeholder="https://example.com"
                    value={form.website}
                    onChange={(e) => update('website', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Contact
              </h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="v_contact">Contact Name</Label>
                  <Input
                    id="v_contact"
                    placeholder="John Smith"
                    value={form.contact_name}
                    onChange={(e) => update('contact_name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_email">Email</Label>
                  <Input
                    id="v_email"
                    type="email"
                    placeholder="john@example.com"
                    value={form.contact_email}
                    onChange={(e) => update('contact_email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_phone">Phone</Label>
                  <Input
                    id="v_phone"
                    placeholder="+1 (555) 123-4567"
                    value={form.contact_phone}
                    onChange={(e) => update('contact_phone', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Address
              </h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="v_addr1">Address Line 1</Label>
                  <Input
                    id="v_addr1"
                    placeholder="123 Industrial Blvd"
                    value={form.address_line1}
                    onChange={(e) => update('address_line1', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_addr2">Address Line 2</Label>
                  <Input
                    id="v_addr2"
                    placeholder="Suite 100"
                    value={form.address_line2}
                    onChange={(e) => update('address_line2', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_city">City</Label>
                  <Input
                    id="v_city"
                    placeholder="San Francisco"
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_state">State / Province</Label>
                  <Input
                    id="v_state"
                    placeholder="CA"
                    value={form.state_province}
                    onChange={(e) => update('state_province', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_postal">Postal Code</Label>
                  <Input
                    id="v_postal"
                    placeholder="94105"
                    value={form.postal_code}
                    onChange={(e) => update('postal_code', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_country">Country</Label>
                  <Input
                    id="v_country"
                    placeholder="US"
                    value={form.country}
                    onChange={(e) => update('country', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Business Details */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Business Details
              </h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="v_taxid">Tax ID / EIN</Label>
                  <Input
                    id="v_taxid"
                    placeholder="XX-XXXXXXX"
                    value={form.tax_id}
                    onChange={(e) => update('tax_id', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_terms">Payment Terms</Label>
                  <Select
                    value={form.payment_terms}
                    onValueChange={(v) => update('payment_terms', v)}
                  >
                    <SelectTrigger id="v_terms">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Prepaid">Prepaid</SelectItem>
                      <SelectItem value="COD">COD</SelectItem>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 45">Net 45</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                      <SelectItem value="Net 90">Net 90</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_lead">Lead Time (days)</Label>
                  <Input
                    id="v_lead"
                    type="number"
                    min="0"
                    value={form.lead_time_days}
                    onChange={(e) => update('lead_time_days', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v_rating">Quality Rating</Label>
                  <Select
                    value={form.quality_rating}
                    onValueChange={(v) => update('quality_rating', v)}
                  >
                    <SelectTrigger id="v_rating">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 — Poor</SelectItem>
                      <SelectItem value="2">2 — Below Average</SelectItem>
                      <SelectItem value="3">3 — Average</SelectItem>
                      <SelectItem value="4">4 — Good</SelectItem>
                      <SelectItem value="5">5 — Excellent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Product Categories */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Product Categories Supplied
              </h4>
              <div className="flex flex-wrap gap-2">
                {(
                  Object.entries(CATEGORY_LABELS) as [
                    HardwareCategory,
                    string,
                  ][]
                ).map(([key, label]) => {
                  const selected = form.categories.includes(key)
                  return (
                    <Button
                      key={key}
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleCategory(key)}
                      type="button"
                    >
                      {label}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="v_notes">Notes</Label>
              <Textarea
                id="v_notes"
                placeholder="Additional notes about this vendor..."
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !form.name}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {editVendor ? 'Update' : 'Add'} Partner
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(o) => !o && setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteConfirm?.name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
