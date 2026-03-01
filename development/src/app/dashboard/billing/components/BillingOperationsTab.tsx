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
  FileText,
  CreditCard,
  RefreshCw,
  AlertTriangle,
  Inbox,
  DollarSign,
  Gift,
  Settings2,
  RotateCcw,
  History,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { useUser } from '@/contexts/UserContext'

let _supabase: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!_supabase) _supabase = createClient()
  return _supabase
}

interface OrgOption {
  id: string
  name: string
  slug: string
}

/** Recent admin action for the activity feed */
interface AdminAction {
  id: string
  action_type: string
  resource_type: string
  resource_name: string | null
  changes: Record<string, unknown>
  created_at: string
  status: string
}

export function BillingOperationsTab() {
  const { fmt } = useDateFormatter()
  const { user } = useUser()
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [recentActions, setRecentActions] = useState<AdminAction[]>([])
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const supabase = getSupabase() as any

      // Fetch orgs for dropdowns
      const { data: orgRows } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .order('name')

      setOrgs(orgRows || [])

      // Fetch recent billing admin actions from audit log
      const { data: auditRows } = await supabase
        .from('user_audit_log')
        .select('id, action_type, resource_type, resource_name, changes, created_at, status')
        .in('action_type', [
          'manual_invoice_created',
          'credit_issued',
          'subscription_override',
          'refund_initiated',
          'plan_change',
        ])
        .order('created_at', { ascending: false })
        .limit(20)

      setRecentActions(auditRows || [])
    } catch (err) {
      console.error('Failed to load operations data:', err)
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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="grid gap-4 md:grid-cols-4">
        <ManualInvoiceDialog
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
          orgs={orgs}
          userId={user?.id}
          onComplete={loadData}
        />
        <IssueCreditDialog
          open={creditOpen}
          onOpenChange={setCreditOpen}
          orgs={orgs}
          userId={user?.id}
          onComplete={loadData}
        />
        <SubscriptionOverrideDialog
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          orgs={orgs}
          userId={user?.id}
          onComplete={loadData}
        />
        <Card className="flex flex-col items-center justify-center p-4">
          <RotateCcw className="mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Refunds</p>
          <p className="mt-1 text-xs text-muted-foreground text-center">
            Use the Payments tab to initiate refunds on individual payments
          </p>
        </Card>
      </div>

      {/* Recent admin actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Billing Actions
          </CardTitle>
          <CardDescription>
            Audit trail of admin billing operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentActions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-muted-foreground">
              <Inbox className="mb-2 h-8 w-8" />
              <p className="text-sm">No billing admin actions yet</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell className="text-sm">
                        {fmt.shortDate(action.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {action.action_type.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {action.resource_name || action.resource_type}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {action.changes
                          ? JSON.stringify(action.changes).slice(0, 80)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            action.status === 'success'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }
                        >
                          {action.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
// Manual Invoice Dialog
// ═══════════════════════════════════════════════════════════════════════
function ManualInvoiceDialog({
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
  const [orgId, setOrgId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setOrgId('')
    setAmount('')
    setDescription('')
    setDueDate('')
    setReason('')
  }

  const handleSubmit = async () => {
    if (!orgId || !amount || !description || !reason) {
      toast.error('All fields are required')
      return
    }

    const amountCents = Math.round(parseFloat(amount) * 100)
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    setSubmitting(true)
    try {
      const supabase = getSupabase() as any

      // Create the invoice
      const { error: invoiceErr } = await supabase.from('invoices').insert({
        organization_id: orgId,
        amount_cents: amountCents,
        currency: 'usd',
        status: 'open',
        period_start: new Date().toISOString(),
        period_end: dueDate ? new Date(dueDate).toISOString() : null,
      })
      if (invoiceErr) throw invoiceErr

      // Audit log
      await supabase.from('user_audit_log').insert({
        user_id: userId,
        organization_id: orgId,
        action_category: 'organization_management',
        action_type: 'manual_invoice_created',
        resource_type: 'invoice',
        resource_name: description,
        changes: {
          amount_cents: amountCents,
          description,
          due_date: dueDate || null,
          reason,
        },
        status: 'success',
      })

      toast.success(`Manual invoice created for $${(amountCents / 100).toFixed(2)}`)
      resetForm()
      onOpenChange(false)
      await onComplete()
    } catch (err) {
      console.error('Failed to create invoice:', err)
      toast.error('Failed to create manual invoice')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="flex flex-col items-center justify-center p-4">
            <FileText className="mb-2 h-8 w-8 text-blue-500" />
            <p className="text-sm font-medium">Manual Invoice</p>
            <p className="mt-1 text-xs text-muted-foreground text-center">
              Create one-off invoice for any org
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            Create Manual Invoice
          </DialogTitle>
          <DialogDescription>
            Create a one-off invoice for any organization. This will appear in
            their invoice history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Organization</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              placeholder="e.g., Custom integration setup fee"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Due Date (optional)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Admin Reason</Label>
            <Textarea
              placeholder="Why is this invoice being created? (audit trail)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Issue Credit Dialog
// ═══════════════════════════════════════════════════════════════════════
function IssueCreditDialog({
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
  const [orgId, setOrgId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setOrgId('')
    setAmount('')
    setReason('')
    setExpiresAt('')
  }

  const handleSubmit = async () => {
    if (!orgId || !amount || !reason) {
      toast.error('Organization, amount, and reason are required')
      return
    }

    const amountCents = Math.round(parseFloat(amount) * 100)
    if (isNaN(amountCents) || amountCents <= 0) {
      toast.error('Enter a valid amount')
      return
    }

    setSubmitting(true)
    try {
      const supabase = getSupabase() as any

      const { error } = await supabase.from('account_credits').insert({
        organization_id: orgId,
        amount_cents: amountCents,
        remaining_cents: amountCents,
        reason,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        issued_by: userId,
      })
      if (error) throw error

      // Audit log
      await supabase.from('user_audit_log').insert({
        user_id: userId,
        organization_id: orgId,
        action_category: 'organization_management',
        action_type: 'credit_issued',
        resource_type: 'account_credit',
        resource_name: `$${(amountCents / 100).toFixed(2)} credit`,
        changes: {
          amount_cents: amountCents,
          reason,
          expires_at: expiresAt || null,
        },
        status: 'success',
      })

      toast.success(`$${(amountCents / 100).toFixed(2)} credit issued`)
      resetForm()
      onOpenChange(false)
      await onComplete()
    } catch (err) {
      console.error('Failed to issue credit:', err)
      toast.error('Failed to issue credit')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="flex flex-col items-center justify-center p-4">
            <Gift className="mb-2 h-8 w-8 text-green-500" />
            <p className="text-sm font-medium">Issue Credit</p>
            <p className="mt-1 text-xs text-muted-foreground text-center">
              Apply account credit to an org
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-green-500" />
            Issue Account Credit
          </DialogTitle>
          <DialogDescription>
            Apply a credit to an organization&apos;s account. Credits can be used
            to offset future invoices.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Organization</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Credit Amount (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Textarea
              placeholder="e.g., Service outage compensation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expires On (optional)</Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Issuing...' : 'Issue Credit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Subscription Override Dialog
// ═══════════════════════════════════════════════════════════════════════
function SubscriptionOverrideDialog({
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
  const [orgId, setOrgId] = useState('')
  const [action, setAction] = useState<'change_plan' | 'extend_trial' | 'pause' | 'resume'>('change_plan')
  const [planId, setPlanId] = useState('')
  const [trialDays, setTrialDays] = useState('')
  const [reason, setReason] = useState('')
  const [plans, setPlans] = useState<{ id: string; name: string; slug: string }[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Load plans on first open
  useEffect(() => {
    if (open && plans.length === 0) {
      const load = async () => {
        const supabase = getSupabase() as any
        const { data } = await supabase
          .from('billing_plans')
          .select('id, name, slug')
          .eq('is_active', true)
          .order('sort_order')
        setPlans(data || [])
      }
      load()
    }
  }, [open, plans.length])

  const resetForm = () => {
    setOrgId('')
    setAction('change_plan')
    setPlanId('')
    setTrialDays('')
    setReason('')
  }

  const handleSubmit = async () => {
    if (!orgId || !reason) {
      toast.error('Organization and reason are required')
      return
    }

    setSubmitting(true)
    try {
      const supabase = getSupabase() as any
      const orgName = orgs.find((o) => o.id === orgId)?.name || orgId

      if (action === 'change_plan') {
        if (!planId) {
          toast.error('Select a plan')
          setSubmitting(false)
          return
        }

        const { error } = await supabase
          .from('subscriptions')
          .update({ plan_id: planId, updated_at: new Date().toISOString() })
          .eq('organization_id', orgId)

        if (error) throw error

        // Update org tier
        const plan = plans.find((p) => p.id === planId)
        if (plan) {
          await supabase
            .from('organizations')
            .update({ subscription_tier: plan.slug })
            .eq('id', orgId)
        }

        toast.success(`Plan changed for ${orgName}`)
      } else if (action === 'extend_trial') {
        const days = parseInt(trialDays, 10)
        if (isNaN(days) || days <= 0) {
          toast.error('Enter valid trial days')
          setSubmitting(false)
          return
        }

        const newEnd = new Date()
        newEnd.setDate(newEnd.getDate() + days)

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'trialing',
            current_period_end: newEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', orgId)

        if (error) throw error
        toast.success(`Trial extended by ${days} days for ${orgName}`)
      } else if (action === 'pause') {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'incomplete',
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', orgId)

        if (error) throw error
        toast.success(`Billing paused for ${orgName}`)
      } else if (action === 'resume') {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: new Date().toISOString(),
          })
          .eq('organization_id', orgId)

        if (error) throw error
        toast.success(`Billing resumed for ${orgName}`)
      }

      // Audit log
      await supabase.from('user_audit_log').insert({
        user_id: userId,
        organization_id: orgId,
        action_category: 'organization_management',
        action_type: 'subscription_override',
        resource_type: 'subscription',
        resource_name: orgName,
        changes: {
          action,
          plan_id: planId || null,
          trial_days: trialDays || null,
          reason,
        },
        status: 'success',
      })

      resetForm()
      onOpenChange(false)
      await onComplete()
    } catch (err) {
      console.error('Failed to override subscription:', err)
      toast.error('Failed to apply subscription override')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="flex flex-col items-center justify-center p-4">
            <Settings2 className="mb-2 h-8 w-8 text-amber-500" />
            <p className="text-sm font-medium">Subscription Override</p>
            <p className="mt-1 text-xs text-muted-foreground text-center">
              Change plan, extend trial, pause/resume
            </p>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-amber-500" />
            Subscription Override
          </DialogTitle>
          <DialogDescription>
            Manually change an organization&apos;s subscription. All changes are
            logged for audit compliance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Organization</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action} onValueChange={(v: any) => setAction(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="change_plan">Change Plan</SelectItem>
                <SelectItem value="extend_trial">Extend Trial</SelectItem>
                <SelectItem value="pause">Pause Billing</SelectItem>
                <SelectItem value="resume">Resume Billing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {action === 'change_plan' && (
            <div className="space-y-1.5">
              <Label>New Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {action === 'extend_trial' && (
            <div className="space-y-1.5">
              <Label>Extra Days</Label>
              <Input
                type="number"
                min="1"
                placeholder="e.g., 14"
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
            </div>
          )}

          {(action === 'pause' || action === 'resume') && (
            <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  {action === 'pause'
                    ? 'Pausing will set the subscription to incomplete. The customer will not be billed until resumed.'
                    : 'Resuming will reactivate billing. The customer will be charged at the next billing cycle.'}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Admin Reason</Label>
            <Textarea
              placeholder="Why is this override being applied? (audit trail)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Applying...' : 'Apply Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
