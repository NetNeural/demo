'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Mail, UserPlus, Copy, X, Clock, Check, AlertCircle, Link2 } from 'lucide-react'
import type { ResellerInvitation } from '@/types/reseller'

function InvitesContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const [orgId, setOrgId]             = useState<string | null>(null)
  const [orgSlug, setOrgSlug]         = useState('')
  const [invites, setInvites]         = useState<ResellerInvitation[]>([])
  const [loading, setLoading]         = useState(true)
  const [email, setEmail]             = useState('')
  const [sending, setSending]         = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')
  const [revokeId, setRevokeId]       = useState<string | null>(null)
  const [copiedId, setCopiedId]       = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: member } = await (supabase as any)
        .from('organization_members')
        .select('organization_id, organizations!inner(id, slug, is_reseller)')
        .eq('user_id', user.id)
        .eq('organizations.is_reseller', true)
        .limit(1)
        .single()

      if (!member) return

      const oid = member.organization_id
      setOrgId(oid)
      setOrgSlug((member as { organizations: { slug: string } }).organizations.slug)

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reseller-invite?inviter_org_id=${oid}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      )
      const json = await res.json()
      setInvites(json.data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const sendInvite = async () => {
    if (!email.trim() || !orgId) return
    setSending(true)
    setError('')
    setSuccess('')
    try {
      const supabase = createClient()
      const token = (await supabase.auth.getSession()).data.session?.access_token

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reseller-invite`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', inviter_org_id: orgId, invitee_email: email }),
        }
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error)

      setSuccess(`Invitation sent to ${email}`)
      setEmail('')

      // Refresh list
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('reseller_invitations')
        .select('*')
        .eq('inviter_org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50)
      setInvites((data as ResellerInvitation[]) ?? [])
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  const revokeInvite = async (id: string) => {
    if (!orgId) return
    const supabase = createClient()
    const token = (await supabase.auth.getSession()).data.session?.access_token

    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/reseller-invite`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', invitation_id: id, inviter_org_id: orgId }),
    })

    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: 'revoked' as const } : i))
    setRevokeId(null)
  }

  const copyInviteLink = (token: string, id: string) => {
    const url = `${window.location.origin}/auth/signup?invite=${token}&org=${orgSlug}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const StatusBadge = ({ status }: { status: ResellerInvitation['status'] }) => {
    const map: Record<string, string> = {
      pending:  'bg-amber-500/15 text-amber-400',
      accepted: 'bg-emerald-500/15 text-emerald-400',
      expired:  'bg-gray-700 text-gray-400',
      revoked:  'bg-red-500/15 text-red-400',
    }
    const icons: Record<string, React.ReactNode> = {
      pending:  <Clock className="h-3 w-3" />,
      accepted: <Check className="h-3 w-3" />,
      expired:  <AlertCircle className="h-3 w-3" />,
      revoked:  <X className="h-3 w-3" />,
    }
    return (
      <Badge className={`flex items-center gap-1 ${map[status]}`}>
        {icons[status]} {status}
      </Badge>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Invite Sub-Resellers</h1>
        <p className="mt-1 text-sm text-gray-400">
          Grow your network by inviting new resellers. They&apos;ll appear under your organization.
        </p>
      </div>

      {/* Signup link notice */}
      <div className="flex items-start gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
        <div className="text-sm">
          <p className="font-medium text-cyan-300">Your Signup Link</p>
          <p className="mt-0.5 text-cyan-400/70">
            Share{' '}
            <code className="rounded bg-black/20 px-1 text-xs">
              /auth/signup?org={orgSlug}
            </code>{' '}
            to let customers sign up directly under your account.
          </p>
        </div>
      </div>

      {/* Invite form */}
      <div className="rounded-xl border border-white/[0.08] bg-gray-900/60 p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Send Invitation</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              type="email"
              placeholder="partner@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendInvite()}
              className="border-white/[0.08] bg-white/[0.04] pl-10"
            />
          </div>
          <Button
            onClick={sendInvite}
            disabled={sending || !email.trim()}
            className="bg-cyan-600 hover:bg-cyan-500"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {sending ? 'Sending…' : 'Send Invite'}
          </Button>
        </div>
        {error   && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {success && <p className="mt-2 text-xs text-emerald-400">{success}</p>}
      </div>

      {/* Invite list */}
      <div className="rounded-xl border border-white/[0.08] bg-gray-900/60">
        <div className="border-b border-white/[0.08] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">
            Pending Invitations
            {' '}
            <span className="ml-1 text-gray-500">
              ({invites.filter(i => i.status === 'pending').length} / 50)
            </span>
          </h2>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : invites.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No invitations yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.08] hover:bg-transparent">
                <TableHead className="text-gray-400">Email</TableHead>
                <TableHead className="text-gray-400">Status</TableHead>
                <TableHead className="text-gray-400">Sent</TableHead>
                <TableHead className="text-gray-400">Expires</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map(inv => (
                <TableRow key={inv.id} className="border-white/[0.06] hover:bg-white/[0.02]">
                  <TableCell className="text-sm text-gray-200">{inv.invitee_email}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell className="text-xs text-gray-400">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs text-gray-400">
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {inv.status === 'pending' && (
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => copyInviteLink(inv.token, inv.id)}
                          className="rounded p-1 text-gray-400 hover:text-gray-200 transition-colors"
                          title="Copy invite link"
                        >
                          {copiedId === inv.id
                            ? <Check className="h-3.5 w-3.5 text-emerald-400" />
                            : <Copy className="h-3.5 w-3.5" />
                          }
                        </button>
                        <button
                          onClick={() => setRevokeId(inv.id)}
                          className="rounded p-1 text-gray-500 hover:text-red-400 transition-colors"
                          title="Revoke invitation"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Revoke confirmation */}
      <Dialog open={!!revokeId} onOpenChange={() => setRevokeId(null)}>
        <DialogContent className="border-white/[0.08] bg-gray-900 text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke Invitation</DialogTitle>
            <DialogDescription className="text-gray-400">
              The invitee will no longer be able to use this invitation link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeId(null)}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-500" onClick={() => revokeId && revokeInvite(revokeId)}>
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ResellerInvitePage() {
  return (
    <Suspense fallback={<div className="text-gray-500 p-6">Loading…</div>}>
      <InvitesContent />
    </Suspense>
  )
}
