'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Search,
  Users,
  KeyRound,
  Mail,
  ShieldOff,
  Unlock,
  Building2,
  RefreshCw,
  AlertTriangle,
  Shield,
  Lock,
} from 'lucide-react'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface SupportOrg {
  id: string
  name: string
  slug: string
  subscription_tier: string | null
  parent_organization_id: string | null
  support_model: string | null
}

interface SupportUser {
  membershipId: string
  memberRole: string
  organizationId: string
  joinedAt: string
  userId: string
  email: string
  fullName: string | null
  globalRole: string
  isActive: boolean
  lastSignIn: string | null
  passwordChangeRequired: boolean
  lockedUntil: string | null
  failedLoginAttempts: number
  hasMfa: boolean
}

type SupportAction = 'reset-password' | 'change-email' | 'reset-mfa' | 'unlock-account'

export default function UserSupportTab() {
  const { fmt } = useDateFormatter()
  const [organizations, setOrganizations] = useState<SupportOrg[]>([])
  const [users, setUsers] = useState<SupportUser[]>([])
  const [loading, setLoading] = useState(true)
  const [orgFilter, setOrgFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogAction, setDialogAction] = useState<SupportAction | null>(null)
  const [dialogUser, setDialogUser] = useState<SupportUser | null>(null)
  const [dialogPassword, setDialogPassword] = useState('')
  const [dialogEmail, setDialogEmail] = useState('')

  const supabase = createClient()

  const callUserSupport = useCallback(
    async (method: 'GET' | 'POST', params?: Record<string, string>, body?: Record<string, unknown>) => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const url = new URL(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/user-support`
      )
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          url.searchParams.set(k, v)
        }
      }

      const res = await fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || json.message || 'Request failed')
      return json
    },
    [supabase]
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (orgFilter !== 'all') params.organization_id = orgFilter
      if (searchQuery) params.search = searchQuery

      const result = await callUserSupport('GET', params)
      setOrganizations(result.data?.organizations || [])
      setUsers(result.data?.users || [])
    } catch (err) {
      console.error('Failed to fetch support data:', err)
      toast.error('Failed to load user support data')
    } finally {
      setLoading(false)
    }
  }, [callUserSupport, orgFilter, searchQuery])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openActionDialog = (action: SupportAction, user: SupportUser) => {
    setDialogAction(action)
    setDialogUser(user)
    setDialogPassword('')
    setDialogEmail(user.email)
    setDialogOpen(true)
  }

  const executeAction = async () => {
    if (!dialogAction || !dialogUser) return
    setActionLoading(true)
    try {
      const body: Record<string, unknown> = {
        action: dialogAction,
        targetUserId: dialogUser.userId,
      }
      if (dialogAction === 'reset-password') body.password = dialogPassword
      if (dialogAction === 'change-email') body.newEmail = dialogEmail

      const result = await callUserSupport('POST', undefined, body)
      toast.success(result.data?.message || 'Action completed')
      setDialogOpen(false)
      fetchData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action failed'
      toast.error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const getOrgName = (orgId: string) => {
    return organizations.find((o) => o.id === orgId)?.name || orgId
  }

  const filteredUsers = users.filter((u) => {
    if (orgFilter !== 'all' && u.organizationId !== orgFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        u.email.toLowerCase().includes(q) ||
        (u.fullName?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  const isLocked = (u: SupportUser) =>
    u.lockedUntil && new Date(u.lockedUntil) > new Date()

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{organizations.length}</p>
                <p className="text-sm text-muted-foreground">
                  Supported Orgs
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Lock className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(isLocked).length}
                </p>
                <p className="text-sm text-muted-foreground">Locked Accounts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-indigo-500" />
              <div>
                <p className="text-2xl font-bold">
                  {users.filter((u) => u.hasMfa).length}
                </p>
                <p className="text-sm text-muted-foreground">MFA Enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Support Actions
          </CardTitle>
          <CardDescription>
            Reset passwords, change emails, and manage MFA for users in
            supported organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {searchQuery || orgFilter !== 'all'
                ? 'No users match your filters'
                : 'No users in supported organizations'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>MFA</TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={`${u.organizationId}-${u.userId}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {u.fullName || 'No name'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getOrgName(u.organizationId)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {u.memberRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isLocked(u) ? (
                          <Badge variant="destructive" className="gap-1">
                            <Lock className="h-3 w-3" /> Locked
                          </Badge>
                        ) : !u.lastSignIn ? (
                          <Badge variant="outline">Invited</Badge>
                        ) : u.passwordChangeRequired ? (
                          <Badge variant="secondary" className="gap-1">
                            <AlertTriangle className="h-3 w-3" /> Pwd Change
                          </Badge>
                        ) : (
                          <Badge
                            variant="default"
                            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          >
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.hasMfa ? (
                          <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                            Enrolled
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.lastSignIn ? fmt.timeAgo(u.lastSignIn) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Reset Password"
                            onClick={() =>
                              openActionDialog('reset-password', u)
                            }
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Change Email"
                            onClick={() =>
                              openActionDialog('change-email', u)
                            }
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          {u.hasMfa && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reset MFA"
                              onClick={() =>
                                openActionDialog('reset-mfa', u)
                              }
                            >
                              <ShieldOff className="h-4 w-4" />
                            </Button>
                          )}
                          {isLocked(u) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Unlock Account"
                              onClick={() =>
                                openActionDialog('unlock-account', u)
                              }
                            >
                              <Unlock className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === 'reset-password' && 'Reset Password'}
              {dialogAction === 'change-email' && 'Change Email'}
              {dialogAction === 'reset-mfa' && 'Reset MFA'}
              {dialogAction === 'unlock-account' && 'Unlock Account'}
            </DialogTitle>
            <DialogDescription>
              {dialogUser && (
                <>
                  For <strong>{dialogUser.fullName || dialogUser.email}</strong>{' '}
                  ({dialogUser.email}) in{' '}
                  <strong>{getOrgName(dialogUser.organizationId)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {dialogAction === 'reset-password' && (
              <div className="space-y-2">
                <Label htmlFor="new-password">New Temporary Password</Label>
                <Input
                  id="new-password"
                  type="text"
                  placeholder="Enter temporary password (min 6 chars)"
                  value={dialogPassword}
                  onChange={(e) => setDialogPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  User will be forced to change this on next login.
                </p>
              </div>
            )}

            {dialogAction === 'change-email' && (
              <div className="space-y-2">
                <Label htmlFor="new-email">New Email Address</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="Enter new email address"
                  value={dialogEmail}
                  onChange={(e) => setDialogEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This will update both the login email and profile email
                  immediately.
                </p>
              </div>
            )}

            {dialogAction === 'reset-mfa' && (
              <div className="flex items-start gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-400">
                    This will remove all MFA factors
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-500">
                    The user will need to re-enroll in MFA on their next login.
                  </p>
                </div>
              </div>
            )}

            {dialogAction === 'unlock-account' && (
              <div className="text-sm text-muted-foreground">
                This will clear the lockout and reset failed login attempts to
                zero. The user will be able to log in again immediately.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={executeAction}
              disabled={
                actionLoading ||
                (dialogAction === 'reset-password' &&
                  dialogPassword.length < 6) ||
                (dialogAction === 'change-email' &&
                  !dialogEmail.includes('@'))
              }
              variant={
                dialogAction === 'reset-mfa' ? 'destructive' : 'default'
              }
            >
              {actionLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
