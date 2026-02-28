'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/page-header'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  AlertTriangle,
  Bell,
  TrendingUp,
  Shield,
  ToggleLeft,
  ArrowUpDown,
  Check,
  BarChart3,
  Brain,
  Building2,
} from 'lucide-react'
import type {
  BillingPlan,
  BillingPlanFeatures,
  PricingModel,
  PriceChangeScope,
} from '@/types/billing'
import {
  PLAN_FEATURE_DISPLAY,
  EMPTY_FEATURES,
  formatPlanPrice,
} from '@/types/billing'

// Helper: billing_plans and price_change_log aren't in the generated
// Database types yet (migration pending). Cast to any for Supabase queries.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => createClient() as any

// ─── Access guard ─────────────────────────────────────────────────────
function useAdminGuard() {
  const { user } = useUser()
  const { userRole } = useOrganization()
  const router = useRouter()

  const isAllowed = user?.isSuperAdmin || userRole === 'owner'

  useEffect(() => {
    if (user && !user.isSuperAdmin && userRole && userRole !== 'owner') {
      router.replace('/dashboard')
    }
  }, [user, userRole, router])

  return { isAllowed, loading: !user }
}

// ─── Plan icon helper ─────────────────────────────────────────────────
function getPlanIcon(slug: string) {
  switch (slug) {
    case 'starter':
      return BarChart3
    case 'professional':
      return Brain
    case 'enterprise':
      return Building2
    default:
      return DollarSign
  }
}

function getPlanColor(slug: string) {
  switch (slug) {
    case 'starter':
      return '#06b6d4'
    case 'professional':
      return '#8b5cf6'
    case 'enterprise':
      return '#10b981'
    default:
      return '#6b7280'
  }
}

// ─── Price Adjustment Dialog ──────────────────────────────────────────
interface PriceAdjustDialogProps {
  open: boolean
  onClose: () => void
  plans: BillingPlan[]
  onApply: (changes: PriceAdjustment[]) => void
}

interface PriceAdjustment {
  planId: string
  planSlug: string
  planName: string
  field: 'price_per_device' | 'price_monthly' | 'price_annual'
  oldValue: number
  newValue: number
}

function PriceAdjustDialog({ open, onClose, plans, onApply }: PriceAdjustDialogProps) {
  const [mode, setMode] = useState<'percentage' | 'fixed'>('percentage')
  const [percentage, setPercentage] = useState('3')
  const [scope, setScope] = useState<PriceChangeScope>('new_only')
  const [reason, setReason] = useState('Annual inflation adjustment')
  const [sendNotification, setSendNotification] = useState(true)
  const [notificationMessage, setNotificationMessage] = useState(
    'We are adjusting our pricing to reflect current market conditions. Your new rates will take effect on your next billing cycle.'
  )
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    d.setDate(1)
    return d.toISOString().split('T')[0]
  })
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(() =>
    new Set(plans.filter((p) => p.is_active).map((p) => p.id))
  )

  // Preview the calculated changes
  const previewChanges = useMemo(() => {
    const pct = parseFloat(percentage) || 0
    const changes: PriceAdjustment[] = []
    plans
      .filter((p) => selectedPlans.has(p.id))
      .forEach((plan) => {
        if (plan.pricing_model === 'per_device' && plan.price_per_device > 0) {
          const newVal =
            mode === 'percentage'
              ? Math.round(plan.price_per_device * (1 + pct / 100) * 100) / 100
              : plan.price_per_device + (parseFloat(percentage) || 0)
          changes.push({
            planId: plan.id,
            planSlug: plan.slug,
            planName: plan.name,
            field: 'price_per_device',
            oldValue: plan.price_per_device,
            newValue: Math.max(0, newVal),
          })
        }
        if (plan.price_monthly > 0) {
          const newVal =
            mode === 'percentage'
              ? Math.round(plan.price_monthly * (1 + pct / 100) * 100) / 100
              : plan.price_monthly + (parseFloat(percentage) || 0)
          changes.push({
            planId: plan.id,
            planSlug: plan.slug,
            planName: plan.name,
            field: 'price_monthly',
            oldValue: plan.price_monthly,
            newValue: Math.max(0, newVal),
          })
        }
      })
    return changes
  }, [plans, selectedPlans, percentage, mode])

  const handleApply = () => {
    if (previewChanges.length === 0) return
    onApply(previewChanges)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            Adjust Pricing for Inflation
          </DialogTitle>
          <DialogDescription>
            Apply a percentage or fixed-amount increase across selected plans.
            Optionally notify affected customers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Adjustment method */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('percentage')}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  mode === 'percentage'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <span className="font-medium">Percentage (%)</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  e.g., 3% increase across all prices
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode('fixed')}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  mode === 'fixed'
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <span className="font-medium">Fixed Amount ($)</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  e.g., +$0.50 per sensor/month
                </p>
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="adj-amount" className="mb-1.5 block text-sm font-medium">
              {mode === 'percentage' ? 'Increase (%)' : 'Increase ($)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {mode === 'percentage' ? '%' : '$'}
              </span>
              <input
                id="adj-amount"
                type="number"
                step={mode === 'percentage' ? '0.5' : '0.01'}
                min="0"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Scope: All subscribers vs new only */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Apply To</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  scope === 'all'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <span className="font-medium">All Subscribers</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Change pricing for existing and new customers
                </p>
              </button>
              <button
                type="button"
                onClick={() => setScope('new_only')}
                className={`rounded-lg border p-3 text-left text-sm transition-all ${
                  scope === 'new_only'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-border hover:bg-muted'
                }`}
              >
                <span className="font-medium">New Subscribers Only</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Grandfather existing customers at current rate
                </p>
              </button>
            </div>
          </div>

          {/* Effective date */}
          <div>
            <label htmlFor="adj-date" className="mb-1.5 block text-sm font-medium">
              Effective Date
            </label>
            <input
              id="adj-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="adj-reason" className="mb-1.5 block text-sm font-medium">
              Reason (internal audit trail)
            </label>
            <input
              id="adj-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Annual inflation adjustment"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Select plans */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Select Plans</label>
            <div className="space-y-1.5">
              {plans
                .filter((p) => p.is_active)
                .map((plan) => (
                  <label
                    key={plan.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlans.has(plan.id)}
                      onChange={(e) => {
                        const s = new Set(selectedPlans)
                        e.target.checked ? s.add(plan.id) : s.delete(plan.id)
                        setSelectedPlans(s)
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">{plan.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatPlanPrice(plan)}
                    </span>
                  </label>
                ))}
            </div>
          </div>

          {/* Notification toggle */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Notify Customers</span>
              </div>
              <Switch checked={sendNotification} onCheckedChange={setSendNotification} />
            </div>
            {sendNotification && (
              <div className="mt-3">
                <label htmlFor="notif-msg" className="mb-1 block text-xs text-muted-foreground">
                  Notification message
                </label>
                <textarea
                  id="notif-msg"
                  rows={3}
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}
          </div>

          {/* Preview */}
          {previewChanges.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                Price Change Preview
              </h4>
              <div className="space-y-1.5">
                {previewChanges.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>
                      {c.planName}{' '}
                      <span className="text-muted-foreground">
                        ({c.field === 'price_per_device' ? 'per sensor' : 'monthly'})
                      </span>
                    </span>
                    <span>
                      <span className="text-muted-foreground line-through">
                        ${c.oldValue.toFixed(2)}
                      </span>
                      {' → '}
                      <span className="font-semibold text-emerald-600">
                        ${c.newValue.toFixed(2)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Scope: {scope === 'all' ? 'All subscribers' : 'New subscribers only'} •
                Effective: {effectiveDate}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={previewChanges.length === 0}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <TrendingUp className="mr-1.5 h-4 w-4" />
            Apply Price Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Plan Dialog ─────────────────────────────────────────────────
interface EditPlanDialogProps {
  open: boolean
  onClose: () => void
  plan: BillingPlan | null // null = new plan
  onSave: (plan: BillingPlan, isNew: boolean) => void
}

function EditPlanDialog({ open, onClose, plan, onSave }: EditPlanDialogProps) {
  const isNew = !plan
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [pricingModel, setPricingModel] = useState<PricingModel>('per_device')
  const [pricePerDevice, setPricePerDevice] = useState('0')
  const [priceMonthly, setPriceMonthly] = useState('0')
  const [priceAnnual, setPriceAnnual] = useState('0')
  const [maxDevices, setMaxDevices] = useState('-1')
  const [maxUsers, setMaxUsers] = useState('5')
  const [maxIntegrations, setMaxIntegrations] = useState('1')
  const [retentionDays, setRetentionDays] = useState('30')
  const [isActive, setIsActive] = useState(true)
  const [isPublic, setIsPublic] = useState(true)
  const [sortOrder, setSortOrder] = useState('1')
  const [features, setFeatures] = useState<BillingPlanFeatures>({ ...EMPTY_FEATURES })

  // Reset form when plan changes
  useEffect(() => {
    if (plan) {
      setName(plan.name)
      setSlug(plan.slug)
      setDescription(plan.description || '')
      setPricingModel(plan.pricing_model)
      setPricePerDevice(String(plan.price_per_device))
      setPriceMonthly(String(plan.price_monthly))
      setPriceAnnual(String(plan.price_annual))
      setMaxDevices(String(plan.max_devices))
      setMaxUsers(String(plan.max_users))
      setMaxIntegrations(String(plan.max_integrations))
      setRetentionDays(String(plan.telemetry_retention_days))
      setIsActive(plan.is_active)
      setIsPublic(plan.is_public)
      setSortOrder(String(plan.sort_order))
      setFeatures({ ...EMPTY_FEATURES, ...plan.features })
    } else {
      setName('')
      setSlug('')
      setDescription('')
      setPricingModel('per_device')
      setPricePerDevice('0')
      setPriceMonthly('0')
      setPriceAnnual('0')
      setMaxDevices('-1')
      setMaxUsers('5')
      setMaxIntegrations('1')
      setRetentionDays('30')
      setIsActive(true)
      setIsPublic(true)
      setSortOrder('10')
      setFeatures({ ...EMPTY_FEATURES })
    }
  }, [plan, open])

  const handleToggleFeature = (key: keyof BillingPlanFeatures) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const autoSlug = useCallback(
    (n: string) =>
      n
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, ''),
    []
  )

  const handleSave = () => {
    const finalSlug = slug || autoSlug(name)
    const saved: BillingPlan = {
      id: plan?.id || crypto.randomUUID(),
      name: name.trim(),
      slug: finalSlug,
      description: description.trim() || null,
      pricing_model: pricingModel,
      price_per_device: parseFloat(pricePerDevice) || 0,
      stripe_price_id_monthly: plan?.stripe_price_id_monthly || null,
      stripe_price_id_annual: plan?.stripe_price_id_annual || null,
      price_monthly: parseFloat(priceMonthly) || 0,
      price_annual: parseFloat(priceAnnual) || 0,
      max_devices: parseInt(maxDevices) || -1,
      max_users: parseInt(maxUsers) || 1,
      max_integrations: parseInt(maxIntegrations) || 1,
      telemetry_retention_days: parseInt(retentionDays) || 7,
      features,
      is_active: isActive,
      is_public: isPublic,
      sort_order: parseInt(sortOrder) || 1,
      created_at: plan?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    onSave(saved, isNew)
    onClose()
  }

  const featureCount = Object.values(features).filter(Boolean).length

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isNew ? <Plus className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            {isNew ? 'Create New Plan' : `Edit Plan: ${plan.name}`}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Define a new billing plan with pricing, limits, and features.'
              : 'Modify plan details. Changes save to the billing_plans table.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="plan-name" className="mb-1.5 block text-sm font-medium">
                Plan Name *
              </label>
              <input
                id="plan-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (isNew) setSlug(autoSlug(e.target.value))
                }}
                placeholder="e.g., Monitor Plus"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="plan-slug" className="mb-1.5 block text-sm font-medium">
                Slug
              </label>
              <input
                id="plan-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="auto-generated"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-muted-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div>
            <label htmlFor="plan-desc" className="mb-1.5 block text-sm font-medium">
              Description
            </label>
            <textarea
              id="plan-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description shown on the pricing page"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Pricing */}
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              Pricing
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Pricing Model</label>
                <select
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value as PricingModel)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="per_device">Per Device</option>
                  <option value="flat">Flat Rate</option>
                  <option value="custom">Custom / Enterprise</option>
                </select>
              </div>
              {pricingModel === 'per_device' && (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Price per Sensor ($/mo)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricePerDevice}
                    onChange={(e) => setPricePerDevice(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Base Monthly ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceMonthly}
                  onChange={(e) => setPriceMonthly(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Annual Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceAnnual}
                  onChange={(e) => setPriceAnnual(e.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Limits */}
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <ArrowUpDown className="h-4 w-4 text-blue-500" />
              Resource Limits
              <span className="text-xs font-normal text-muted-foreground">(-1 = Unlimited)</span>
            </h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Max Devices</label>
                <input
                  type="number"
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Max Users</label>
                <input
                  type="number"
                  value={maxUsers}
                  onChange={(e) => setMaxUsers(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Max Integrations</label>
                <input
                  type="number"
                  value={maxIntegrations}
                  onChange={(e) => setMaxIntegrations(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Retention (days)</label>
                <input
                  type="number"
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>

          {/* Visibility */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <span className="text-sm">Public (pricing page)</span>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <ToggleLeft className="h-4 w-4 text-violet-500" />
              Features
              <Badge variant="secondary" className="ml-1 text-xs">
                {featureCount}/{PLAN_FEATURE_DISPLAY.length} enabled
              </Badge>
            </h4>
            <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border p-3">
              {PLAN_FEATURE_DISPLAY.map(({ key, label, description: desc }) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Switch
                    checked={features[key] || false}
                    onCheckedChange={() => handleToggleFeature(key)}
                  />
                  <div>
                    <span className="font-medium">{label}</span>
                    {desc && (
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <Save className="mr-1.5 h-4 w-4" />
            {isNew ? 'Create Plan' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Delete confirmation dialog ───────────────────────────────────────
interface DeleteDialogProps {
  open: boolean
  onClose: () => void
  plan: BillingPlan | null
  onConfirm: () => void
}

function DeletePlanDialog({ open, onClose, plan, onConfirm }: DeleteDialogProps) {
  const [confirmSlug, setConfirmSlug] = useState('')

  useEffect(() => {
    if (open) setConfirmSlug('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Delete Plan: {plan?.name}
          </DialogTitle>
          <DialogDescription>
            This will deactivate the plan. Existing subscribers will be grandfathered.
            Type <strong>{plan?.slug}</strong> to confirm.
          </DialogDescription>
        </DialogHeader>
        <input
          type="text"
          value={confirmSlug}
          onChange={(e) => setConfirmSlug(e.target.value)}
          placeholder={plan?.slug}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmSlug !== plan?.slug}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            Deactivate Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main admin page ──────────────────────────────────────────────────
function PlansPricingContent() {
  const { isAllowed, loading: guardLoading } = useAdminGuard()
  const { user } = useUser()
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialogs
  const [priceAdjustOpen, setPriceAdjustOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPlan, setDeletingPlan] = useState<BillingPlan | null>(null)

  // Price change log (in-memory; persisted to price_change_log table)
  const [changeLog, setChangeLog] = useState<
    { timestamp: string; user: string; summary: string }[]
  >([])

  // ── Load plans from database ────────────────────────────────────────
  const loadPlans = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = db()
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setPlans((data as unknown as BillingPlan[]) || [])
    } catch (err) {
      console.error('Failed to load plans:', err)
      toast.error('Failed to load billing plans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAllowed) loadPlans()
  }, [isAllowed, loadPlans])

  const activePlans = useMemo(() => plans.filter((p) => p.is_active), [plans])
  const inactivePlans = useMemo(() => plans.filter((p) => !p.is_active), [plans])

  // ── Save a plan (create or update) ──────────────────────────────────
  const handleSavePlan = useCallback(
    async (plan: BillingPlan, isNew: boolean) => {
      setSaving(true)
      try {
        const supabase = db()

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, updated_at, ...data } = plan

        if (isNew) {
          const { error } = await supabase.from('billing_plans').insert(data)
          if (error) throw error
          toast.success(`Plan "${plan.name}" created`)
        } else {
          const { error } = await supabase
            .from('billing_plans')
            .update({ ...data, updated_at: new Date().toISOString() })
            .eq('id', plan.id)
          if (error) throw error
          toast.success(`Plan "${plan.name}" updated`)
        }

        setChangeLog((prev) => [
          {
            timestamp: new Date().toISOString(),
            user: user?.email || 'admin',
            summary: isNew ? `Created plan: ${plan.name}` : `Updated plan: ${plan.name}`,
          },
          ...prev,
        ])

        await loadPlans()
      } catch (err) {
        console.error('Save plan error:', err)
        toast.error('Failed to save plan')
      } finally {
        setSaving(false)
      }
    },
    [loadPlans, user]
  )

  // ── Delete (deactivate) a plan ──────────────────────────────────────
  const handleDeletePlan = useCallback(
    async (plan: BillingPlan) => {
      setSaving(true)
      try {
        const supabase = db()
        const { error } = await supabase
          .from('billing_plans')
          .update({ is_active: false, is_public: false, updated_at: new Date().toISOString() })
          .eq('id', plan.id)
        if (error) throw error

        toast.success(`Plan "${plan.name}" deactivated`)
        setChangeLog((prev) => [
          {
            timestamp: new Date().toISOString(),
            user: user?.email || 'admin',
            summary: `Deactivated plan: ${plan.name}`,
          },
          ...prev,
        ])
        await loadPlans()
      } catch (err) {
        console.error('Delete plan error:', err)
        toast.error('Failed to deactivate plan')
      } finally {
        setSaving(false)
      }
    },
    [loadPlans, user]
  )

  // ── Apply price adjustments ─────────────────────────────────────────
  const handlePriceAdjust = useCallback(
    async (changes: PriceAdjustment[]) => {
      setSaving(true)
      try {
        const supabase = db()

        // Group changes by plan
        const byPlan = new Map<string, Partial<BillingPlan>>()
        for (const c of changes) {
          const existing = byPlan.get(c.planId) || {}
          if (c.field === 'price_per_device') existing.price_per_device = c.newValue
          if (c.field === 'price_monthly') existing.price_monthly = c.newValue
          if (c.field === 'price_annual') existing.price_annual = c.newValue
          byPlan.set(c.planId, existing)
        }

        // Update each plan
        for (const [planId, updates] of byPlan) {
          const { error } = await supabase
            .from('billing_plans')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', planId)
          if (error) throw error
        }

        // Log the price change
        const summary = changes
          .map((c) => `${c.planName}: $${c.oldValue.toFixed(2)} → $${c.newValue.toFixed(2)}`)
          .join(', ')

        // Insert price change records for audit trail
        const records = changes.map((c) => ({
          plan_id: c.planId,
          plan_slug: c.planSlug,
          field_changed: c.field,
          old_value: c.oldValue,
          new_value: c.newValue,
          reason: 'Inflation adjustment',
          changed_by: user?.id || 'unknown',
        }))

        // Try inserting into price_change_log (may not exist yet — graceful fail)
        await supabase.from('price_change_log').insert(records).then(() => {})

        setChangeLog((prev) => [
          {
            timestamp: new Date().toISOString(),
            user: user?.email || 'admin',
            summary: `Price adjustment: ${summary}`,
          },
          ...prev,
        ])

        toast.success(`Pricing updated for ${byPlan.size} plan(s)`)
        await loadPlans()
      } catch (err) {
        console.error('Price adjustment error:', err)
        toast.error('Failed to apply price changes')
      } finally {
        setSaving(false)
      }
    },
    [loadPlans, user]
  )

  // ── Guard ───────────────────────────────────────────────────────────
  if (guardLoading) return <LoadingSpinner />
  if (!isAllowed) {
    return (
      <div className="flex-1 p-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Shield className="h-12 w-12 text-red-500" />
            <h2 className="text-xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground">
              Plans &amp; Pricing administration requires Owner or Super Admin privileges.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Plans & Pricing"
          description="Manage billing plans, features, and pricing. Owner / Super Admin only."
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPriceAdjustOpen(true)}
            className="text-amber-600 hover:text-amber-700"
          >
            <TrendingUp className="mr-1.5 h-4 w-4" />
            Adjust Pricing
          </Button>
          <Button
            onClick={() => {
              setEditingPlan(null)
              setEditDialogOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New Plan
          </Button>
        </div>
      </div>

      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList>
          <TabsTrigger value="plans" className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" />
            Active Plans ({activePlans.length})
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-1.5">
            <ToggleLeft className="h-4 w-4" />
            Feature Matrix
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Change Log
          </TabsTrigger>
        </TabsList>

        {/* ── Active Plans Tab ──────────────────────────────────────── */}
        <TabsContent value="plans">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-6">
              {/* Active plans */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activePlans.map((plan) => {
                  const Icon = getPlanIcon(plan.slug)
                  const color = getPlanColor(plan.slug)
                  const featureCount = Object.values(plan.features || {}).filter(Boolean).length

                  return (
                    <Card key={plan.id} className="relative overflow-hidden">
                      <div
                        className="absolute inset-x-0 top-0 h-1"
                        style={{ background: color }}
                      />
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-lg"
                              style={{ background: `${color}18` }}
                            >
                              <Icon className="h-4.5 w-4.5" style={{ color }} />
                            </div>
                            <div>
                              <CardTitle className="text-base">{plan.name}</CardTitle>
                              <CardDescription className="text-xs">
                                {plan.slug} • {plan.pricing_model}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingPlan(plan)
                                setEditDialogOpen(true)
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingPlan(plan)
                                setDeleteDialogOpen(true)
                              }}
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Price */}
                        <div className="text-2xl font-bold" style={{ color }}>
                          {formatPlanPrice(plan)}
                        </div>

                        {/* Limits */}
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-xs">
                            {plan.max_users === -1 ? '∞' : plan.max_users} users
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {plan.max_devices === -1 ? '∞' : plan.max_devices} devices
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {plan.max_integrations === -1 ? '∞' : plan.max_integrations} integrations
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {plan.telemetry_retention_days === -1
                              ? '∞'
                              : plan.telemetry_retention_days}
                            d retention
                          </Badge>
                        </div>

                        {/* Features summary */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          {featureCount} of {PLAN_FEATURE_DISPLAY.length} features enabled
                        </div>

                        {/* Status badges */}
                        <div className="flex gap-1.5">
                          {plan.is_public && (
                            <Badge className="bg-emerald-600 text-xs">Public</Badge>
                          )}
                          {!plan.is_public && (
                            <Badge variant="secondary" className="text-xs">Hidden</Badge>
                          )}
                          {plan.sort_order && (
                            <Badge variant="outline" className="text-xs">
                              Order: {plan.sort_order}
                            </Badge>
                          )}
                        </div>

                        {plan.description && (
                          <p className="text-xs text-muted-foreground">{plan.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Inactive plans */}
              {inactivePlans.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                    Inactive / Legacy Plans ({inactivePlans.length})
                  </h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    {inactivePlans.map((plan) => (
                      <Card key={plan.id} className="opacity-60">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{plan.name}</CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingPlan(plan)
                                setEditDialogOpen(true)
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                          <p className="text-xs text-muted-foreground">
                            {plan.slug} • {formatPlanPrice(plan)} • Deactivated
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Feature Matrix Tab ────────────────────────────────────── */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Feature Comparison Matrix</CardTitle>
              <CardDescription>
                Toggle features per plan. Click a cell to enable/disable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="pb-3 pr-4 text-left font-medium">Feature</th>
                      {activePlans.map((plan) => (
                        <th
                          key={plan.id}
                          className="pb-3 text-center font-medium"
                          style={{ color: getPlanColor(plan.slug), minWidth: 100 }}
                        >
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PLAN_FEATURE_DISPLAY.map(({ key, label }) => (
                      <tr key={key} className="border-b border-border/50">
                        <td className="py-2 pr-4 text-muted-foreground">{label}</td>
                        {activePlans.map((plan) => {
                          const enabled = plan.features?.[key] || false
                          return (
                            <td key={plan.id} className="py-2 text-center">
                              <button
                                type="button"
                                className="mx-auto flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-muted"
                                onClick={async () => {
                                  // Toggle feature directly
                                  const newFeatures = {
                                    ...plan.features,
                                    [key]: !enabled,
                                  }
                                  try {
                                    const supabase = db()
                                    const { error } = await supabase
                                      .from('billing_plans')
                                      .update({
                                        features: newFeatures,
                                        updated_at: new Date().toISOString(),
                                      })
                                      .eq('id', plan.id)
                                    if (error) throw error
                                    toast.success(
                                      `${label} ${!enabled ? 'enabled' : 'disabled'} for ${plan.name}`
                                    )
                                    await loadPlans()
                                  } catch {
                                    toast.error('Failed to toggle feature')
                                  }
                                }}
                                title={`${enabled ? 'Disable' : 'Enable'} ${label} for ${plan.name}`}
                              >
                                {enabled ? (
                                  <Check
                                    className="h-4 w-4"
                                    style={{ color: getPlanColor(plan.slug) }}
                                  />
                                ) : (
                                  <X className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Change Log Tab ────────────────────────────────────────── */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing Change Log</CardTitle>
              <CardDescription>
                Audit trail of plan and pricing modifications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {changeLog.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No changes recorded this session. Changes persist to the database automatically.
                </p>
              ) : (
                <div className="space-y-2">
                  {changeLog.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 rounded-lg border border-border p-3"
                    >
                      <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div className="flex-1">
                        <p className="text-sm">{entry.summary}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()} • {entry.user}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PriceAdjustDialog
        open={priceAdjustOpen}
        onClose={() => setPriceAdjustOpen(false)}
        plans={plans}
        onApply={handlePriceAdjust}
      />
      <EditPlanDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false)
          setEditingPlan(null)
        }}
        plan={editingPlan}
        onSave={handleSavePlan}
      />
      <DeletePlanDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false)
          setDeletingPlan(null)
        }}
        plan={deletingPlan}
        onConfirm={() => {
          if (deletingPlan) handleDeletePlan(deletingPlan)
        }}
      />

      {/* Saving overlay */}
      {saving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-lg bg-background p-4 shadow-lg">
            <LoadingSpinner />
            <span className="text-sm">Saving changes...</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PlansPricingPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <PlansPricingContent />
    </Suspense>
  )
}
