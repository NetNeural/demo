'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Layers,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  Save,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIER_BG_COLORS } from '@/types/reseller'

interface ResellerTier {
  id: string
  name: string
  min_sensors: number
  max_sensors: number | null
  discount_pct: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface TierForm {
  name: string
  min_sensors: string
  max_sensors: string
  discount_pct: string
  sort_order: string
}

const emptyForm: TierForm = {
  name: '',
  min_sensors: '0',
  max_sensors: '',
  discount_pct: '10',
  sort_order: '99',
}

function tierToForm(tier: ResellerTier): TierForm {
  return {
    name: tier.name,
    min_sensors: String(tier.min_sensors),
    max_sensors: tier.max_sensors != null ? String(tier.max_sensors) : '',
    discount_pct: String(+(tier.discount_pct * 100).toFixed(2)),
    sort_order: String(tier.sort_order),
  }
}

export function TierManagement() {
  const [tiers, setTiers] = useState<ResellerTier[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTier, setEditingTier] = useState<ResellerTier | null>(null)
  const [form, setForm] = useState<TierForm>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<ResellerTier | null>(null)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  const getAuthHeaders = useCallback(async () => {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return {
      Authorization: `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
    }
  }, [])

  const fetchTiers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const headers = await getAuthHeaders()
      const res = await fetch(
        `${supabaseUrl}/functions/v1/manage-reseller-tiers`,
        { method: 'GET', headers }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to fetch tiers')
      setTiers(json.tiers ?? [])
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setLoading(false)
    }
  }, [supabaseUrl, getAuthHeaders])

  useEffect(() => {
    fetchTiers()
  }, [fetchTiers])

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Tier name is required'
    const min = parseInt(form.min_sensors)
    if (isNaN(min) || min < 0) return 'Min sensors must be 0 or greater'
    const max = form.max_sensors.trim()
      ? parseInt(form.max_sensors)
      : null
    if (max !== null && (isNaN(max) || max <= min))
      return 'Max sensors must be greater than min sensors'
    const disc = parseFloat(form.discount_pct)
    if (isNaN(disc) || disc < 0 || disc > 100)
      return 'Discount must be between 0% and 100%'
    const order = parseInt(form.sort_order)
    if (isNaN(order)) return 'Sort order must be a number'
    return null
  }

  const handleSave = async () => {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    try {
      setSaving(true)
      setFormError(null)
      const headers = await getAuthHeaders()
      const payload = {
        name: form.name.trim(),
        min_sensors: parseInt(form.min_sensors),
        max_sensors: form.max_sensors.trim()
          ? parseInt(form.max_sensors)
          : null,
        discount_pct: parseFloat(form.discount_pct) / 100,
        sort_order: parseInt(form.sort_order),
      }

      const isEdit = !!editingTier
      const res = await fetch(
        `${supabaseUrl}/functions/v1/manage-reseller-tiers`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers,
          body: JSON.stringify(
            isEdit ? { id: editingTier.id, ...payload } : payload
          ),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save tier')

      setDialogOpen(false)
      setEditingTier(null)
      setForm(emptyForm)
      await fetchTiers()
    } catch (err) {
      setFormError(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tier: ResellerTier) => {
    try {
      setSaving(true)
      const headers = await getAuthHeaders()
      const res = await fetch(
        `${supabaseUrl}/functions/v1/manage-reseller-tiers`,
        {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ id: tier.id }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to deactivate tier')
      setDeleteConfirm(null)
      await fetchTiers()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  const handleReactivate = async (tier: ResellerTier) => {
    try {
      setSaving(true)
      const headers = await getAuthHeaders()
      const res = await fetch(
        `${supabaseUrl}/functions/v1/manage-reseller-tiers`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ id: tier.id, is_active: true }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to reactivate tier')
      await fetchTiers()
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  const openCreate = () => {
    setEditingTier(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (tier: ResellerTier) => {
    setEditingTier(tier)
    setForm(tierToForm(tier))
    setFormError(null)
    setDialogOpen(true)
  }

  const activeTiers = tiers.filter((t) => t.is_active)
  const inactiveTiers = tiers.filter((t) => !t.is_active)

  if (loading) {
    return (
      <Card className="border-white/[0.08] bg-gray-900/60">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="border-white/[0.08] bg-gray-900/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <Layers className="h-4 w-4 text-cyan-400" />
            Reseller Tier Configuration
          </CardTitle>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Tier
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {activeTiers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No tiers configured. Click &quot;Add Tier&quot; to create the first one.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/[0.08] hover:bg-transparent">
                  <TableHead className="text-gray-400">Order</TableHead>
                  <TableHead className="text-gray-400">Tier Name</TableHead>
                  <TableHead className="text-gray-400">Sensor Range</TableHead>
                  <TableHead className="text-gray-400">Discount %</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-right text-gray-400">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTiers.map((tier) => (
                  <TableRow
                    key={tier.id}
                    className="border-white/[0.06] hover:bg-white/[0.02]"
                  >
                    <TableCell className="text-sm text-gray-400">
                      {tier.sort_order}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'font-medium',
                          TIER_BG_COLORS[tier.name] ??
                            'bg-gray-700 text-gray-300'
                        )}
                      >
                        {tier.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-300">
                      {tier.min_sensors.toLocaleString()}
                      {' – '}
                      {tier.max_sensors != null
                        ? tier.max_sensors.toLocaleString()
                        : '∞'}
                    </TableCell>
                    <TableCell className="font-semibold text-white">
                      {(tier.discount_pct * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-500/15 text-emerald-400">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(tier)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(tier)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Inactive tiers */}
          {inactiveTiers.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Inactive Tiers
              </p>
              <div className="space-y-1">
                {inactiveTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">{tier.name}</span>
                      <span className="text-xs text-gray-600">
                        {tier.min_sensors}–
                        {tier.max_sensors ?? '∞'} sensors ·{' '}
                        {(tier.discount_pct * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReactivate(tier)}
                      disabled={saving}
                      className="h-7 gap-1 text-xs text-gray-400 hover:text-emerald-400"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reactivate
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/[0.08] bg-gray-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingTier ? 'Edit Tier' : 'Create New Tier'}
            </DialogTitle>
            <DialogDescription>
              {editingTier
                ? `Editing "${editingTier.name}" tier. Changes affect all resellers.`
                : 'Add a new tier to the reseller discount program.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tier-name" className="text-gray-300">
                Tier Name
              </Label>
              <Input
                id="tier-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Diamond"
                className="border-white/[0.08] bg-gray-800 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="min-sensors" className="text-gray-300">
                  Min Sensors
                </Label>
                <Input
                  id="min-sensors"
                  type="number"
                  min="0"
                  value={form.min_sensors}
                  onChange={(e) =>
                    setForm({ ...form, min_sensors: e.target.value })
                  }
                  className="border-white/[0.08] bg-gray-800 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-sensors" className="text-gray-300">
                  Max Sensors{' '}
                  <span className="text-gray-500">(empty = ∞)</span>
                </Label>
                <Input
                  id="max-sensors"
                  type="number"
                  min="0"
                  value={form.max_sensors}
                  onChange={(e) =>
                    setForm({ ...form, max_sensors: e.target.value })
                  }
                  placeholder="Unlimited"
                  className="border-white/[0.08] bg-gray-800 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="discount-pct" className="text-gray-300">
                  Discount %
                </Label>
                <div className="relative">
                  <Input
                    id="discount-pct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.discount_pct}
                    onChange={(e) =>
                      setForm({ ...form, discount_pct: e.target.value })
                    }
                    className="border-white/[0.08] bg-gray-800 pr-8 text-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sort-order" className="text-gray-300">
                  Sort Order
                </Label>
                <Input
                  id="sort-order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm({ ...form, sort_order: e.target.value })
                  }
                  className="border-white/[0.08] bg-gray-800 text-white"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="mb-1 text-xs font-medium text-gray-400">Preview</p>
              <p className="text-sm text-gray-200">
                <span className="font-semibold text-white">
                  {form.name || '—'}
                </span>
                {' · '}
                {form.min_sensors || '0'}–{form.max_sensors || '∞'} sensors
                {' · '}
                <span className="font-semibold text-cyan-400">
                  {form.discount_pct || '0'}% discount
                </span>
              </p>
            </div>

            {formError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-white/[0.08]"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {editingTier ? 'Save Changes' : 'Create Tier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="border-white/[0.08] bg-gray-900 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Deactivate Tier</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate the{' '}
              <span className="font-semibold text-white">
                {deleteConfirm?.name}
              </span>{' '}
              tier? Resellers currently at this tier will be re-evaluated during
              the next tier engine run. You can reactivate it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="border-white/[0.08]"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3.5 w-3.5" />
              )}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
