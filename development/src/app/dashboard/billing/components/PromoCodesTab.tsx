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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import {
  Plus,
  RefreshCw,
  Tag,
  Inbox,
  Percent,
  DollarSign,
  Power,
  PowerOff,
  Copy,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { useUser } from '@/contexts/UserContext'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

interface PromoCode {
  id: string
  code: string
  description: string | null
  discount_percent: number | null
  discount_amount_cents: number | null
  duration_months: number | null
  max_redemptions: number | null
  current_redemptions: number
  organization_id: string | null
  valid_from: string
  valid_until: string | null
  is_active: boolean
  stripe_coupon_id: string | null
  created_by: string | null
  created_at: string
}

interface OrgOption {
  id: string
  name: string
}

export function PromoCodesTab() {
  const { fmt } = useDateFormatter()
  const { user } = useUser()
  const [promos, setPromos] = useState<PromoCode[]>([])
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const supabase = getSupabase() as any
      const [{ data: promoRows }, { data: orgRows }] = await Promise.all([
        supabase
          .from('promotional_codes')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('organizations')
          .select('id, name')
          .order('name'),
      ])
      setPromos(promoRows || [])
      setOrgs(orgRows || [])
    } catch (err) {
      console.error('Failed to load promo codes:', err)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadData()
      setLoading(false)
    }
    init()
  }, [loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleToggleActive = async (promo: PromoCode) => {
    try {
      const supabase = getSupabase() as any
      const { error } = await supabase
        .from('promotional_codes')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id)

      if (error) throw error

      toast.success(
        promo.is_active
          ? `Promo "${promo.code}" deactivated`
          : `Promo "${promo.code}" activated`
      )
      await loadData()
    } catch (err) {
      console.error('Failed to toggle promo:', err)
      toast.error('Failed to update promo code')
    }
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success(`Copied "${code}" to clipboard`)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const activePromos = promos.filter((p) => p.is_active)
  const totalRedemptions = promos.reduce((s, p) => s + p.current_redemptions, 0)

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Promos</CardDescription>
            <CardTitle className="text-2xl">{promos.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl text-green-600">{activePromos.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Redemptions</CardDescription>
            <CardTitle className="text-2xl">{totalRedemptions}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="flex items-center justify-center">
          <CreatePromoDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            orgs={orgs}
            userId={user?.id}
            onComplete={loadData}
          />
        </Card>
      </div>

      {/* Promo table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Promotional Codes
            </CardTitle>
            <CardDescription>
              Create, manage, and track promotional discount codes
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {promos.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Inbox className="mb-2 h-8 w-8" />
              <p className="text-sm">No promotional codes yet</p>
              <p className="text-xs">Create your first promo code above</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-center">Redemptions</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promos.map((promo) => {
                    const isExpired =
                      promo.valid_until && new Date(promo.valid_until) < new Date()
                    const isMaxedOut =
                      promo.max_redemptions !== null &&
                      promo.current_redemptions >= promo.max_redemptions

                    return (
                      <TableRow
                        key={promo.id}
                        className={!promo.is_active ? 'opacity-60' : ''}
                      >
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono font-bold">
                              {promo.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopyCode(promo.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          {promo.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {promo.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {promo.discount_percent ? (
                            <span className="flex items-center gap-1 font-medium">
                              <Percent className="h-3 w-3" />
                              {promo.discount_percent}%
                            </span>
                          ) : promo.discount_amount_cents ? (
                            <span className="flex items-center gap-1 font-medium">
                              <DollarSign className="h-3 w-3" />
                              {(promo.discount_amount_cents / 100).toFixed(2)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {promo.duration_months
                            ? `${promo.duration_months} month${promo.duration_months > 1 ? 's' : ''}`
                            : 'Forever'}
                        </TableCell>
                        <TableCell>
                          {promo.organization_id ? (
                            <Badge variant="outline" className="text-xs">
                              Org-specific
                            </Badge>
                          ) : (
                            <Badge
                              className="bg-blue-100 text-blue-800 text-xs dark:bg-blue-900 dark:text-blue-200"
                            >
                              Global
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">
                            {promo.current_redemptions}
                          </span>
                          {promo.max_redemptions !== null && (
                            <span className="text-muted-foreground">
                              /{promo.max_redemptions}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {promo.valid_until
                            ? fmt.shortDate(promo.valid_until)
                            : 'No expiry'}
                        </TableCell>
                        <TableCell>
                          {!promo.is_active ? (
                            <Badge variant="secondary">Inactive</Badge>
                          ) : isExpired ? (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Expired
                            </Badge>
                          ) : isMaxedOut ? (
                            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                              Maxed Out
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(promo)}
                            title={promo.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {promo.is_active ? (
                              <>
                                <PowerOff className="mr-1 h-3 w-3" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Power className="mr-1 h-3 w-3" />
                                Activate
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Create Promo Code Dialog
// ═══════════════════════════════════════════════════════════════════════
function CreatePromoDialog({
  open,
  onOpenChange,
  orgs,
  userId,
  onComplete,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  orgs: OrgOption[]
  userId?: string
  onComplete: () => Promise<void>
}) {
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [durationMonths, setDurationMonths] = useState('')
  const [maxRedemptions, setMaxRedemptions] = useState('')
  const [orgId, setOrgId] = useState('global')
  const [validUntil, setValidUntil] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setCode('')
    setDescription('')
    setDiscountType('percent')
    setDiscountValue('')
    setDurationMonths('')
    setMaxRedemptions('')
    setOrgId('global')
    setValidUntil('')
  }

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let result = 'NN-'
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCode(result)
  }

  const handleSubmit = async () => {
    if (!code || !discountValue) {
      toast.error('Code and discount value are required')
      return
    }

    const value = parseFloat(discountValue)
    if (isNaN(value) || value <= 0) {
      toast.error('Enter a valid discount value')
      return
    }

    if (discountType === 'percent' && value > 100) {
      toast.error('Percentage cannot exceed 100%')
      return
    }

    setSubmitting(true)
    try {
      const supabase = getSupabase() as any

      const insertData: Record<string, unknown> = {
        code: code.toUpperCase().trim(),
        description: description || null,
        discount_percent: discountType === 'percent' ? Math.round(value) : null,
        discount_amount_cents:
          discountType === 'amount' ? Math.round(value * 100) : null,
        duration_months: durationMonths ? parseInt(durationMonths, 10) : null,
        max_redemptions: maxRedemptions ? parseInt(maxRedemptions, 10) : null,
        organization_id: orgId === 'global' ? null : orgId,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        created_by: userId,
      }

      const { error } = await supabase
        .from('promotional_codes')
        .insert(insertData)

      if (error) {
        if (error.message?.includes('duplicate')) {
          toast.error(`Promo code "${code}" already exists`)
        } else {
          throw error
        }
        setSubmitting(false)
        return
      }

      // Audit log
      await supabase.from('user_audit_log').insert({
        user_id: userId,
        action_category: 'organization_management',
        action_type: 'promo_code_created',
        resource_type: 'promotional_code',
        resource_name: code.toUpperCase(),
        changes: insertData,
        status: 'success',
      })

      toast.success(`Promo code "${code}" created`)
      resetForm()
      onOpenChange(false)
      await onComplete()
    } catch (err) {
      console.error('Failed to create promo code:', err)
      toast.error('Failed to create promo code')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Promo Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-purple-500" />
            Create Promotional Code
          </DialogTitle>
          <DialogDescription>
            Create a new discount code. Codes can be percentage or fixed amount,
            global or org-specific.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Code</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., WELCOME20"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <Button variant="outline" type="button" onClick={generateCode} title="Generate random code">
                Generate
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input
              placeholder="e.g., Welcome discount for new customers"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Discount Type</Label>
              <Select
                value={discountType}
                onValueChange={(v: any) => setDiscountType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="amount">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{discountType === 'percent' ? 'Percent Off' : 'Amount Off (USD)'}</Label>
              <div className="relative">
                {discountType === 'percent' ? (
                  <Percent className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                ) : (
                  <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                  type="number"
                  min="1"
                  max={discountType === 'percent' ? '100' : undefined}
                  step={discountType === 'percent' ? '1' : '0.01'}
                  placeholder={discountType === 'percent' ? '20' : '10.00'}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duration (months)</Label>
              <Input
                type="number"
                min="1"
                placeholder="∞ (forever)"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Redemptions</Label>
              <Input
                type="number"
                min="1"
                placeholder="∞ (unlimited)"
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (all organizations)</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} only
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expires On (optional)</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Code'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
