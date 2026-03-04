'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/contexts/UserContext'
import { isPlatformAdmin } from '@/lib/permissions'
import { edgeFunctions } from '@/lib/edge-functions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  Users,
  Briefcase,
  FileText,
  CalendarDays,
  Percent,
  Network,
} from 'lucide-react'

interface Application {
  id: string
  status: string
  applicant_name: string
  applicant_email: string
  applicant_phone: string | null
  applicant_title: string | null
  company_legal_name: string
  company_address: string
  company_website: string | null
  company_tax_id: string | null
  estimated_customers: number
  target_market: string | null
  business_model: string | null
  preferred_billing: string | null
  additional_notes: string | null
  review_notes: string | null
  reviewed_at: string | null
  github_issue_url: string | null
  created_at: string
  organization_id: string
  organization?: { name: string; slug: string }
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string; icon: React.ReactNode }> = {
  submitted: {
    label: 'Submitted',
    variant: 'outline',
    className: 'border-amber-500 text-amber-600',
    icon: <Clock className="h-3 w-3" />,
  },
  under_review: {
    label: 'Under Review',
    variant: 'outline',
    className: 'border-blue-500 text-blue-600',
    icon: <Clock className="h-3 w-3" />,
  },
  approved: {
    label: 'Approved',
    variant: 'default',
    className: 'bg-green-600',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  rejected: {
    label: 'Rejected',
    variant: 'destructive',
    icon: <XCircle className="h-3 w-3" />,
  },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, variant: 'outline' as const, icon: null }
  return (
    <Badge variant={cfg.variant} className={`gap-1 ${cfg.className ?? ''}`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  )
}

export default function ResellerApplicationsPage() {
  const supabase = createClient()
  const { user } = useUser()
  const isSuperAdmin = isPlatformAdmin(user)

  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  // Approve dialog
  const [approveApp, setApproveApp] = useState<Application | null>(null)
  const [revenueShare, setRevenueShare] = useState('20')
  const [maxChildOrgs, setMaxChildOrgs] = useState('10')
  const [approving, setApproving] = useState(false)

  // Reject dialog
  const [rejectApp, setRejectApp] = useState<Application | null>(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const loadApplications = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('reseller_agreement_applications')
        .select('*, organization:organizations(name, slug)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications((data || []) as Application[])
    } catch (err) {
      console.error('Failed to load reseller applications:', err)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (isSuperAdmin) loadApplications()
  }, [isSuperAdmin, loadApplications])

  const handleApprove = useCallback(async () => {
    if (!approveApp || !user) return
    setApproving(true)
    try {
      await edgeFunctions.call('reseller-agreement-review', {
        method: 'POST',
        body: {
          applicationId: approveApp.id,
          action: 'approve',
          revenueShare: parseFloat(revenueShare) || 20,
          maxChildOrgs: parseInt(maxChildOrgs) || 10,
        },
      })
      toast.success(`${approveApp.company_legal_name} approved — account upgraded, email sent`)
      setApproveApp(null)
      await loadApplications()
    } catch (err) {
      console.error('Approve error:', err)
      toast.error('Failed to approve application')
    } finally {
      setApproving(false)
    }
  }, [approveApp, user, revenueShare, maxChildOrgs, loadApplications])

  const handleReject = useCallback(async () => {
    if (!rejectApp || !user) return
    setRejecting(true)
    try {
      await edgeFunctions.call('reseller-agreement-review', {
        method: 'POST',
        body: {
          applicationId: rejectApp.id,
          action: 'reject',
          reviewNotes: rejectNotes.trim() || undefined,
        },
      })
      toast.success(`Application from ${rejectApp.company_legal_name} rejected — email sent`)
      setRejectApp(null)
      setRejectNotes('')
      await loadApplications()
    } catch (err) {
      console.error('Reject error:', err)
      toast.error('Failed to reject application')
    } finally {
      setRejecting(false)
    }
  }, [rejectApp, rejectNotes, user, loadApplications])

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
        <div className="space-y-3 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">Super Admin Only</p>
          <p className="text-sm text-muted-foreground">Reseller application review is restricted to platform super admins.</p>
        </div>
      </div>
    )
  }

  const pending = applications.filter((a) => ['submitted', 'under_review'].includes(a.status))
  const historical = applications.filter((a) => !['submitted', 'under_review'].includes(a.status))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Reseller Applications</h3>
        <p className="text-sm text-muted-foreground">
          Review and approve or reject incoming reseller partnership requests.
        </p>
      </div>

      {/* Pending */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Pending Review</span>
          {pending.length > 0 && (
            <Badge variant="outline" className="border-amber-500 text-amber-600">{pending.length}</Badge>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500" />
              No pending applications
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                onApprove={() => { setApproveApp(app); setRevenueShare('20'); setMaxChildOrgs('10') }}
                onReject={() => { setRejectApp(app); setRejectNotes('') }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Historical */}
      {!loading && historical.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">History</span>
          </div>
          <div className="space-y-2">
            {historical.map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={!!approveApp} onOpenChange={(o) => !o && setApproveApp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Reseller Application</DialogTitle>
            <DialogDescription>
              Set agreement terms for <strong>{approveApp?.company_legal_name}</strong>. An active reseller agreement will be created and the organization will be promoted to reseller status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="revenue-share" className="flex items-center gap-1.5">
                <Percent className="h-3.5 w-3.5" /> Revenue Share %
              </Label>
              <Input
                id="revenue-share"
                type="number"
                min="0"
                max="100"
                value={revenueShare}
                onChange={(e) => setRevenueShare(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-child" className="flex items-center gap-1.5">
                <Network className="h-3.5 w-3.5" /> Max Child Organizations
              </Label>
              <Input
                id="max-child"
                type="number"
                min="1"
                value={maxChildOrgs}
                onChange={(e) => setMaxChildOrgs(e.target.value)}
              />
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Billing model:</strong> {approveApp?.preferred_billing || 'invoice'}</p>
              <p><strong>Estimated customers:</strong> {approveApp?.estimated_customers}</p>
              <p><strong>Effective date:</strong> {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveApp(null)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700">
              {approving ? 'Approving...' : 'Approve & Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectApp} onOpenChange={(o) => !o && setRejectApp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Reject the reseller application from <strong>{rejectApp?.company_legal_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-notes">Review Notes (optional — shown internally)</Label>
            <Textarea
              id="reject-notes"
              placeholder="Reason for rejection..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectApp(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting ? 'Rejecting...' : 'Reject Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ApplicationCard({
  app,
  onApprove,
  onReject,
}: {
  app: Application
  onApprove?: () => void
  onReject?: () => void
}) {
  const isPending = ['submitted', 'under_review'].includes(app.status)

  return (
    <Card className={isPending ? 'border-amber-200 dark:border-amber-900' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base">{app.company_legal_name}</CardTitle>
            {app.organization && (
              <CardDescription className="text-xs">
                Org: {app.organization.name} ({app.organization.slug})
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={app.status} />
            <span className="text-xs text-muted-foreground">
              {new Date(app.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{app.applicant_name}{app.applicant_title ? `, ${app.applicant_title}` : ''}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{app.applicant_email}</span>
          </div>
          {app.applicant_phone && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{app.applicant_phone}</span>
            </div>
          )}
          {app.company_website && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <a href={app.company_website} target="_blank" rel="noopener noreferrer"
                className="truncate hover:underline text-blue-500">
                {app.company_website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>~{app.estimated_customers} customers</span>
          </div>
          {app.target_market && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{app.target_market}</span>
            </div>
          )}
        </div>

        {app.additional_notes && (
          <p className="rounded bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
            {app.additional_notes}
          </p>
        )}

        {app.review_notes && !isPending && (
          <p className="rounded bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
            <strong>Review notes:</strong> {app.review_notes}
          </p>
        )}

        {isPending && onApprove && onReject && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={onApprove}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
