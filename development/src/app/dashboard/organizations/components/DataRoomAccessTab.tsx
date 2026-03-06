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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useUser } from '@/contexts/UserContext'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { useToast } from '@/hooks/use-toast'
import {
  UserPlus,
  UserX,
  Loader2,
  AlertCircle,
  Users,
  Clock,
  Download,
  FileText,
  Shield,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface DataRoomGuest {
  id: string
  organization_id: string
  email: string
  user_id: string | null
  invited_by: string
  status: 'pending' | 'active' | 'revoked'
  created_at: string
  activated_at: string | null
  revoked_at: string | null
  inviter_name?: string
  inviter_email?: string
}

interface AccessLogEntry {
  id: string
  user_id: string
  guest_id: string | null
  document_id: string
  document_name: string
  action: 'view' | 'download'
  created_at: string
  guest_email?: string
}

interface DataRoomAccessTabProps {
  organizationId: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function DataRoomAccessTab({ organizationId }: DataRoomAccessTabProps) {
  const supabase = createClient()
  const { user } = useUser()
  const { fmt } = useDateFormatter()
  const { toast } = useToast()

  // ── State ──────────────────────────────────────────────────────────────
  const [guests, setGuests] = useState<DataRoomGuest[]>([])
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [logLoading, setLogLoading] = useState(true)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')

  const [confirmRevokeGuest, setConfirmRevokeGuest] =
    useState<DataRoomGuest | null>(null)
  const [revoking, setRevoking] = useState(false)

  const [activeView, setActiveView] = useState<'guests' | 'logs'>('guests')

  // ── Fetch guests ───────────────────────────────────────────────────────
  const fetchGuests = useCallback(async () => {
    if (!organizationId) return
    try {
      setLoading(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('data_room_guests')
        .select(
          `
          *,
          inviter:invited_by (
            full_name,
            email
          )
        `
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setGuests(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data || []).map((g: any) => ({
          ...g,
          inviter_name: g.inviter?.full_name || null,
          inviter_email: g.inviter?.email || null,
        }))
      )
    } catch (err) {
      console.error('Failed to fetch guests:', err)
    } finally {
      setLoading(false)
    }
  }, [organizationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch access log ───────────────────────────────────────────────────
  const fetchAccessLog = useCallback(async () => {
    if (!organizationId) return
    try {
      setLogLoading(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('data_room_access_log')
        .select(
          `
          *,
          guest:guest_id (
            email
          )
        `
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      setAccessLog(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data || []).map((l: any) => ({
          ...l,
          guest_email: l.guest?.email || null,
        }))
      )
    } catch (err) {
      console.error('Failed to fetch access log:', err)
    } finally {
      setLogLoading(false)
    }
  }, [organizationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchGuests()
    fetchAccessLog()
  }, [fetchGuests, fetchAccessLog])

  // ── Invite guest ───────────────────────────────────────────────────────
  const handleInvite = async () => {
    if (!inviteEmail.trim() || !user) return

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail.trim())) {
      setInviteError('Please enter a valid email address')
      return
    }

    try {
      setInviting(true)
      setInviteError('')

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data-room-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            organizationId,
          }),
        }
      )

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to invite guest')
      }

      toast({
        title: 'Guest Invited',
        description: `Access granted to ${inviteEmail.trim()}. ${result.isNewUser ? 'An invitation email has been sent with login credentials.' : 'They can log in with their existing account.'}`,
      })

      setInviteEmail('')
      await fetchGuests()
    } catch (err) {
      setInviteError(
        err instanceof Error ? err.message : 'Failed to invite guest'
      )
    } finally {
      setInviting(false)
    }
  }

  // ── Revoke access ─────────────────────────────────────────────────────
  const handleRevoke = async (guest: DataRoomGuest) => {
    if (!user) return

    try {
      setRevoking(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/data-room-invite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            action: 'revoke',
            guestId: guest.id,
            organizationId,
          }),
        }
      )

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to revoke access')
      }

      toast({
        title: 'Access Revoked',
        description: `${guest.email} can no longer access the Data Room.`,
      })

      setConfirmRevokeGuest(null)
      await fetchGuests()
    } catch (err) {
      toast({
        title: 'Error',
        description:
          err instanceof Error ? err.message : 'Failed to revoke access',
        variant: 'destructive',
      })
    } finally {
      setRevoking(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  const activeGuests = guests.filter((g) => g.status === 'active').length
  const totalDownloads = accessLog.length

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeGuests}</p>
              <p className="text-xs text-muted-foreground">Active Guests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900">
              <Download className="h-5 w-5 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalDownloads}</p>
              <p className="text-xs text-muted-foreground">Total Downloads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{guests.length}</p>
              <p className="text-xs text-muted-foreground">Total Invited</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Guest Access Management
              </CardTitle>
              <CardDescription>
                Manage external users who can view Data Room documents.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={activeView === 'guests' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('guests')}
              >
                <Users className="mr-1 h-4 w-4" />
                Guests
              </Button>
              <Button
                variant={activeView === 'logs' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveView('logs')}
              >
                <Clock className="mr-1 h-4 w-4" />
                Access Log
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {activeView === 'guests' ? (
            <div className="space-y-4">
              {/* Invite Form */}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="guest@example.com"
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value)
                    setInviteError('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleInvite()
                  }}
                  disabled={inviting}
                  className="max-w-sm"
                />
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Invite Guest
                </Button>
              </div>

              {inviteError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}

              {/* Guests Table */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : guests.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-14">
                  <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No guests invited yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Invite external users to give them read-only access to your
                    Data Room.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Activated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guests.map((guest) => (
                      <TableRow key={guest.id}>
                        <TableCell className="font-medium">
                          {guest.email}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={guest.status} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {guest.inviter_name || guest.inviter_email || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fmt.dateOnly(guest.created_at)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {guest.activated_at
                            ? fmt.dateOnly(guest.activated_at)
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {guest.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmRevokeGuest(guest)}
                              className="text-destructive hover:text-destructive"
                            >
                              <UserX className="mr-1 h-4 w-4" />
                              Revoke
                            </Button>
                          )}
                          {guest.status === 'revoked' && (
                            <span className="text-xs text-muted-foreground">
                              Revoked {guest.revoked_at ? fmt.dateOnly(guest.revoked_at) : ''}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ) : (
            // ── Access Log View ──────────────────────────────────────────
            <div>
              {logLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : accessLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-14">
                  <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No access activity yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Document downloads by guests will appear here.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Date & Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accessLog.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.guest_email || entry.user_id.slice(0, 8) + '…'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {entry.document_name || entry.document_id.slice(0, 8) + '…'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {entry.action === 'download' ? (
                              <Download className="mr-1 h-3 w-3" />
                            ) : null}
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fmt.dateTime(entry.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Revoke Confirmation Dialog ───────────────────────────────────── */}
      <Dialog
        open={!!confirmRevokeGuest}
        onOpenChange={(open) => {
          if (!open && !revoking) setConfirmRevokeGuest(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke Guest Access</DialogTitle>
            <DialogDescription>
              Remove Data Room access for{' '}
              <strong>{confirmRevokeGuest?.email}</strong>? They will no longer
              be able to view or download documents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmRevokeGuest(null)}
              disabled={revoking}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                confirmRevokeGuest && handleRevoke(confirmRevokeGuest)
              }
              disabled={revoking}
            >
              {revoking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking…
                </>
              ) : (
                <>
                  <UserX className="mr-2 h-4 w-4" />
                  Revoke Access
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Helper Components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200">
          Active
        </Badge>
      )
    case 'pending':
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200">
          Pending
        </Badge>
      )
    case 'revoked':
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900 dark:text-red-200">
          Revoked
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}
