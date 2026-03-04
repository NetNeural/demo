'use client'

/**
 * AccessRequestNotifier
 * Runs silently in the dashboard layout.
 *
 * For ORG ADMINS / OWNERS:
 *   - Polls every 30 s + realtime for new pending access requests targeting the
 *     current org.  Shows a persistent Sonner toast with Approve / Deny buttons.
 *
 * For ALL USERS:
 *   - Watches organization_members for INSERT events on the current user's row.
 *     Calls refreshOrganizations so a newly-granted temp org appears in the
 *     sidebar switcher immediately.
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { CheckCircle2, XCircle, ShieldCheck, PackageSearch } from 'lucide-react'
import type { AccessRequest } from '@/types/access-request'

export function AccessRequestNotifier() {
  const { currentOrganization, isOwner, isAdmin, refreshOrganizations } =
    useOrganization()
  const { user } = useUser()
  const router = useRouter()

  // Track which request IDs have already had toasts shown to avoid duplicates
  const shownIds = useRef<Set<string>>(new Set())
  const resellerToastShown = useRef(false)

  const canApprove = user?.isSuperAdmin || isOwner || isAdmin

  // ── Approve / Deny handler (called from toast button clicks) ─────────────
  const handleRespond = async (
    request: AccessRequest,
    approve: boolean,
    toastId: string | number
  ) => {
    const res = await edgeFunctions.accessRequests.respond({
      request_id: request.id,
      action: approve ? 'approve' : 'deny',
      ...(!approve && { denial_reason: 'Denied via notification' }),
    })

    toast.dismiss(toastId)

    if (res.success) {
      if (approve) {
        toast.success(
          `Admin access granted to ${request.requester?.full_name || request.requester?.email || 'requester'}. They can now switch to your organization.`
        )
        // Refresh orgs in case the approving user also gets a new membership
        await refreshOrganizations()
      } else {
        toast.info('Access request denied.')
      }
    } else {
      toast.error(res.error?.message || 'Failed to process request')
    }
  }

  // ── Show a persistent toast for an incoming pending request ─────────────
  const showRequestToast = (request: AccessRequest) => {
    if (shownIds.current.has(request.id)) return
    shownIds.current.add(request.id)

    const requesterName =
      request.requester?.full_name ||
      request.requester?.email ||
      'Someone'
    const requesterOrg = request.requester_org?.name || 'an organization'
    const toastId = `access-req-${request.id}`

    toast.custom(
      (t) => (
        <div className="w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="text-sm font-semibold">Admin Access Request</span>
          </div>
          <p className="mb-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{requesterName}</span>
            {' '}({requesterOrg}) is requesting temporary admin access to{' '}
            <span className="font-medium text-foreground">
              {currentOrganization?.name || 'your organization'}
            </span>
            .
          </p>
          {request.reason && (
            <p className="mb-3 line-clamp-2 text-xs italic text-muted-foreground">
              &ldquo;{request.reason}&rdquo;
            </p>
          )}
          <div className="flex gap-2">
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 active:bg-green-800"
              onClick={() => handleRespond(request, true, t)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve Access
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
              onClick={() => handleRespond(request, false, t)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Deny
            </button>
          </div>
        </div>
      ),
      { id: toastId, duration: Infinity }
    )
  }

  // ── Reseller applications: check for pending on mount (super admin only) ──
  useEffect(() => {
    if (!user?.isSuperAdmin) return

    const checkReseller = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('reseller_agreement_applications')
        .select('id')
        .in('status', ['submitted', 'under_review'])
        .limit(50)

      if (error || !data?.length || resellerToastShown.current) return
      resellerToastShown.current = true

      const count = data.length
      const label = count === 1 ? '1 pending reseller application' : `${count} pending reseller applications`

      toast.custom(
        () => (
          <div className="w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg">
            <div className="mb-2 flex items-center gap-2">
              <PackageSearch className="h-4 w-4 shrink-0 text-violet-500" />
              <span className="text-sm font-semibold">Reseller Applications</span>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              You have <span className="font-medium text-foreground">{label}</span> waiting for review.
            </p>
            <button
              className="w-full rounded-md bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 active:bg-violet-800"
              onClick={() => {
                toast.dismiss('reseller-apps')
                router.push('/dashboard/admin/reseller-applications')
              }}
            >
              Review Applications
            </button>
          </div>
        ),
        { id: 'reseller-apps', duration: Infinity }
      )
    }

    checkReseller()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.isSuperAdmin])

  // ── Reseller applications: realtime for new submissions ──────────────────
  useEffect(() => {
    if (!user?.isSuperAdmin) return

    const supabase = createClient()

    const channel = supabase
      .channel('reseller-apps-notifier')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reseller_agreement_applications' },
        () => {
          // Dismiss stale toast so it re-shows with refreshed count
          resellerToastShown.current = false
          toast.dismiss('reseller-apps')

          const toastId = 'reseller-apps'
          toast.custom(
            () => (
              <div className="w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg">
                <div className="mb-2 flex items-center gap-2">
                  <PackageSearch className="h-4 w-4 shrink-0 text-violet-500" />
                  <span className="text-sm font-semibold">New Reseller Application</span>
                </div>
                <p className="mb-3 text-sm text-muted-foreground">
                  A new reseller agreement application has been submitted.
                </p>
                <button
                  className="w-full rounded-md bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-700 active:bg-violet-800"
                  onClick={() => {
                    toast.dismiss(toastId)
                    router.push('/dashboard/admin/reseller-applications')
                  }}
                >
                  Review Applications
                </button>
              </div>
            ),
            { id: toastId, duration: Infinity }
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.isSuperAdmin])

  // ── Poll for pending received requests (fallback + initial load) ─────────
  useEffect(() => {
    if (!canApprove || !currentOrganization?.id) return

    const checkPending = async () => {
      const res = await edgeFunctions.accessRequests.list({
        view: 'received',
        organizationId: currentOrganization.id,
        status: 'pending',
      })
      if (res.success && res.data?.requests) {
        for (const req of res.data.requests) {
          showRequestToast(req)
        }
      }
    }

    checkPending()
    const interval = setInterval(checkPending, 30_000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canApprove, currentOrganization?.id])

  // ── Realtime: new access request targeting this org ──────────────────────
  useEffect(() => {
    if (!canApprove || !currentOrganization?.id) return

    const supabase = createClient()
    const orgId = currentOrganization.id

    const channel = supabase
      .channel(`access-requests-notifier-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'access_requests',
          filter: `target_org_id=eq.${orgId}`,
        },
        async () => {
          // Re-fetch to get full joined request
          const res = await edgeFunctions.accessRequests.list({
            view: 'received',
            organizationId: orgId,
            status: 'pending',
          })
          if (res.success && res.data?.requests) {
            for (const req of res.data.requests) {
              showRequestToast(req)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canApprove, currentOrganization?.id])

  // ── Realtime: new membership for current user → refresh org list ─────────
  useEffect(() => {
    if (!user?.id) return

    const supabase = createClient()

    const channel = supabase
      .channel(`membership-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'organization_members',
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          // A new org membership was created for this user (access approved)
          await refreshOrganizations()
          toast.success(
            'Admin access approved — the organization is now available in your sidebar.'
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, refreshOrganizations])

  return null
}
