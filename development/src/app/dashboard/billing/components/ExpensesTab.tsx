'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  DollarSign,
  TrendingDown,
  Server,
  Bot,
  Activity,
  Globe,
  Wrench,
  Package,
  Download,
  FileDown,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category =
  | 'infrastructure'
  | 'tooling'
  | 'ai'
  | 'monitoring'
  | 'hosting'
  | 'other'
type BillingCycle = 'monthly' | 'annual' | 'one-time'

interface Expense {
  id: string
  name: string
  category: Category
  amount_cents: number
  billing_cycle: BillingCycle
  vendor: string | null
  notes: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

const CATEGORY_META: Record<
  Category,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  infrastructure: {
    label: 'Infrastructure',
    icon: Server,
    color: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  },
  tooling: {
    label: 'Tooling',
    icon: Wrench,
    color: 'text-indigo-700 dark:text-indigo-300',
    bg: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800',
  },
  ai: {
    label: 'AI / ML',
    icon: Bot,
    color: 'text-violet-700 dark:text-violet-300',
    bg: 'bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800',
  },
  monitoring: {
    label: 'Monitoring',
    icon: Activity,
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
  },
  hosting: {
    label: 'Hosting',
    icon: Globe,
    color: 'text-teal-700 dark:text-teal-300',
    bg: 'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800',
  },
  other: {
    label: 'Other',
    icon: Package,
    color: 'text-gray-700 dark:text-gray-300',
    bg: 'bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700',
  },
}

const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  annual: 'Annual',
  'one-time': 'One-time',
}

function fmt(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

/** Convert annual/one-time to monthly equivalent for total */
function toMonthlyEquivalent(cents: number, cycle: BillingCycle): number {
  if (cycle === 'annual') return Math.round(cents / 12)
  if (cycle === 'one-time') return 0
  return cents
}

const EMPTY_FORM = {
  name: '',
  category: 'tooling' as Category,
  amount: '',
  billing_cycle: 'monthly' as BillingCycle,
  vendor: '',
  notes: '',
  is_active: true,
}

function sortExpenses(items: Expense[]): Expense[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return a.name.localeCompare(b.name)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpensesTab() {
  const { toast } = useToast()
  const supabase = createClient()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const load = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)
      const { data, error } = await (supabase as any)
        .from('platform_expenses')
        .select('*')
        .order('sort_order')
        .order('name')
      if (error) {
        toast({
          title: 'Failed to load expenses',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        setExpenses(data || [])
      }
      setLoading(false)
      setRefreshing(false)
    },
    [supabase, toast]
  )

  useEffect(() => {
    load()
  }, [load])

  // ── Computed totals ───────────────────────────────────────────────────────

  const active = expenses.filter((e) => e.is_active)
  const totalMonthlyCents = active.reduce(
    (sum, e) => sum + toMonthlyEquivalent(e.amount_cents, e.billing_cycle),
    0
  )
  const totalAnnualCents = totalMonthlyCents * 12

  const byCat = Object.entries(CATEGORY_META)
    .map(([cat, meta]) => {
      const items = active.filter((e) => e.category === cat)
      const total = items.reduce(
        (s, e) => s + toMonthlyEquivalent(e.amount_cents, e.billing_cycle),
        0
      )
      return { cat: cat as Category, meta, total, count: items.length }
    })
    .filter((g) => g.count > 0)

  // ── Dialog helpers ────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setDialogOpen(true)
  }

  const openEdit = (expense: Expense) => {
    setEditingId(expense.id)
    setForm({
      name: expense.name,
      category: expense.category,
      amount: (expense.amount_cents / 100).toFixed(2),
      billing_cycle: expense.billing_cycle,
      vendor: expense.vendor || '',
      notes: expense.notes || '',
      is_active: expense.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.amount) return
    const parsedAmount = parseFloat(form.amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid non-negative amount.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      category: form.category,
      amount_cents: Math.round(parsedAmount * 100),
      billing_cycle: form.billing_cycle,
      vendor: form.vendor.trim() || null,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    }
    let error: any
    let returnedExpense: Expense | null = null
    if (editingId) {
      const { data, error: updateError } = await (supabase as any)
        .from('platform_expenses')
        .update(payload)
        .eq('id', editingId)
        .select('*')
        .maybeSingle()
      error = updateError
      returnedExpense = (data as Expense | null) || null
    } else {
      const { data, error: insertError } = await (supabase as any)
        .from('platform_expenses')
        .insert(payload)
        .select('*')
        .maybeSingle()
      error = insertError
      returnedExpense = (data as Expense | null) || null
    }
    setSaving(false)
    if (error) {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      if (returnedExpense) {
        setExpenses((prev) => {
          if (editingId) {
            return sortExpenses(
              prev.map((expense) =>
                expense.id === returnedExpense!.id ? returnedExpense! : expense
              )
            )
          }
          return sortExpenses([...prev, returnedExpense])
        })
      }

      toast({ title: editingId ? 'Expense updated' : 'Expense added' })
      setDialogOpen(false)
      load(true)
    }
  }

  const handleToggleActive = async (expense: Expense) => {
    const { error } = await (supabase as any)
      .from('platform_expenses')
      .update({ is_active: !expense.is_active })
      .eq('id', expense.id)
    if (error) {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === expense.id ? { ...e, is_active: !e.is_active } : e
        )
      )
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await (supabase as any)
      .from('platform_expenses')
      .delete()
      .eq('id', deleteId)
    setDeleting(false)
    setDeleteId(null)
    if (error) {
      toast({
        title: 'Delete failed',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({ title: 'Expense removed' })
      load(true)
    }
  }

  // ── CSV Export ────────────────────────────────────────────────────────────

  const exportPdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('NetNeural Platform Expenses', 14, 16)
    doc.setFontSize(10)
    doc.text(
      `Monthly Total: ${fmt(totalMonthlyCents)}  |  Annual: ${fmt(totalAnnualCents)}`,
      14,
      24
    )
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`Exported: ${new Date().toLocaleDateString()}`, 14, 30)
    doc.setTextColor(0, 0, 0)
    autoTable(doc, {
      startY: 36,
      head: [['Name', 'Category', 'Vendor', 'Amount', 'Cycle', 'Active']],
      body: expenses.map((e) => [
        e.name,
        CATEGORY_META[e.category].label,
        e.vendor || '—',
        fmt(e.amount_cents),
        BILLING_CYCLE_LABELS[e.billing_cycle],
        e.is_active ? 'Active' : 'Inactive',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 64, 175] },
    })
    doc.save(`netneural-expenses-${new Date().toISOString().split('T')[0]}.pdf`)
  }

  const exportCsv = () => {
    const header =
      'Name,Category,Vendor,Monthly Cost,Billing Cycle,Active,Notes'
    const rows = expenses.map((e) =>
      [
        `"${e.name}"`,
        e.category,
        `"${e.vendor || ''}"`,
        (e.amount_cents / 100).toFixed(2),
        e.billing_cycle,
        e.is_active ? 'Yes' : 'No',
        `"${e.notes || ''}"`,
      ].join(',')
    )
    const csv = [header, ...rows].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `netneural-expenses-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    a.remove()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Platform Expenses</h2>
          <p className="text-sm text-muted-foreground">
            NetNeural operating costs — SaaS tools, hosting, and services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Monthly Total
            </CardDescription>
            <CardTitle className="text-2xl">{fmt(totalMonthlyCents)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {active.length} active line items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <TrendingDown className="h-4 w-4" />
              Annual Total
            </CardDescription>
            <CardTitle className="text-2xl">{fmt(totalAnnualCents)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Annualised from monthly equivalent
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>By Category</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1">
              {byCat.map(({ cat, meta, total }) => (
                <div
                  key={cat}
                  className="flex items-center justify-between text-xs"
                >
                  <span className={`font-medium ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmt(total)}/mo
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service / Tool</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No expenses recorded. Click <strong>Add Expense</strong> to
                    get started.
                  </TableCell>
                </TableRow>
              )}
              {expenses.map((expense) => {
                const cat = CATEGORY_META[expense.category]
                const Icon = cat.icon
                return (
                  <TableRow
                    key={expense.id}
                    className={expense.is_active ? '' : 'opacity-50'}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{expense.name}</p>
                        {expense.notes && (
                          <p className="text-xs text-muted-foreground">
                            {expense.notes}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`gap-1 text-xs ${cat.color} ${cat.bg}`}
                      >
                        <Icon className="h-3 w-3" />
                        {cat.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {expense.vendor || '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmt(expense.amount_cents)}
                      {expense.billing_cycle === 'annual' && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({fmt(Math.round(expense.amount_cents / 12))}/mo)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {BILLING_CYCLE_LABELS[expense.billing_cycle]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleToggleActive(expense)}
                        className="cursor-pointer"
                        title={
                          expense.is_active
                            ? 'Click to deactivate'
                            : 'Click to activate'
                        }
                      >
                        <Badge
                          variant={expense.is_active ? 'default' : 'secondary'}
                        >
                          {expense.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(expense)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(expense.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Expense' : 'Add Expense'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Supabase Pro"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v as Category }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_META).map(([v, m]) => (
                      <SelectItem key={v} value={v}>
                        <span className="flex items-center gap-2">
                          <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                          {m.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Billing Cycle *</Label>
                <Select
                  value={form.billing_cycle}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, billing_cycle: v as BillingCycle }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="one-time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (USD) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    className="pl-6"
                    placeholder="0.00"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Vendor</Label>
                <Input
                  placeholder="e.g. Supabase"
                  value={form.vendor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vendor: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes about this expense"
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_active"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.checked }))
                }
                className="h-4 w-4 rounded border"
              />
              <Label htmlFor="is_active" className="cursor-pointer font-normal">
                Active (include in totals)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.amount}
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the expense record. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
