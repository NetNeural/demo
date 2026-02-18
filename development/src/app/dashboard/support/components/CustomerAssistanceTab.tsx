'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Search,
  Users,
  Clock,
  Shield,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  Mail,
  UserCog,
  UserX,
  UserCheck,
  RefreshCw,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

interface OrgMember {
  id: string
  user_id: string
  role: string
  created_at: string
  users: {
    id: string
    email: string
    raw_user_meta_data?: Record<string, unknown>
    last_sign_in_at?: string | null
    created_at: string
    banned_until?: string | null
  } | null
}

interface AuditEntry {
  id: string
  action_category: string
  action_type: string
  resource_type?: string | null
  resource_name?: string | null
  status: string
  created_at: string
  ip_address?: string | null
  user_agent?: string | null
  metadata?: Record<string, unknown> | null
}

interface Props {
  organizationId: string
}

export default function CustomerAssistanceTab({ organizationId }: Props) {
  const { user } = useUser()
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [activityTimeline, setActivityTimeline] = useState<AuditEntry[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const supabase = createClient()

  const fetchMembers = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          id,
          user_id,
          role,
          created_at,
          users:user_id (
            id,
            email,
            raw_user_meta_data,
            last_sign_in_at,
            created_at,
            banned_until
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMembers((data as unknown as OrgMember[]) || [])
    } catch (err) {
      console.error('Failed to fetch members:', err)
      toast.error('Failed to load organization members')
    } finally {
      setLoading(false)
    }
  }, [organizationId, supabase])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const fetchActivityTimeline = useCallback(async (userId: string) => {
    setActivityLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_audit_log')
        .select('id, action_category, action_type, resource_type, resource_name, status, created_at, ip_address, user_agent, metadata')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setActivityTimeline((data as unknown as AuditEntry[]) || [])
    } catch (err) {
      console.error('Failed to fetch activity timeline:', err)
      toast.error('Failed to load user activity')
    } finally {
      setActivityLoading(false)
    }
  }, [supabase])

  const handleExpandUser = (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null)
      setActivityTimeline([])
    } else {
      setExpandedUserId(userId)
      fetchActivityTimeline(userId)
    }
  }

  const handleResetPassword = async (memberEmail: string) => {
    setActionLoading('reset-password')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(memberEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) throw error
      toast.success(`Password reset email sent to ${memberEmail}`)
    } catch (err) {
      console.error('Reset password failed:', err)
      toast.error('Failed to send password reset email')
    } finally {
      setActionLoading(null)
    }
  }

  const handleChangeRole = async (memberId: string, memberEmail: string, newRole: string) => {
    setActionLoading(`role-${memberId}`)
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error
      toast.success(`Role updated to ${newRole} for ${memberEmail}`)
      fetchMembers()
    } catch (err) {
      console.error('Role change failed:', err)
      toast.error('Failed to change role')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredMembers = members.filter((m) => {
    const email = m.users?.email || ''
    const name = (m.users?.raw_user_meta_data?.full_name as string) || ''
    const matchesSearch =
      !searchQuery ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'all' || m.role === roleFilter
    return matchesSearch && matchesRole
  })

  const getMemberStatus = (member: OrgMember): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } => {
    if (member.users?.banned_until) return { label: 'Disabled', variant: 'destructive' }
    if (!member.users?.last_sign_in_at) return { label: 'Invited', variant: 'outline' }
    return { label: 'Active', variant: 'default' }
  }

  const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (role) {
      case 'super_admin': return 'destructive'
      case 'org_owner': return 'default'
      case 'org_admin': return 'secondary'
      default: return 'outline'
    }
  }

  const availableRoles = (() => {
    const allRoles = ['viewer', 'user', 'org_admin', 'org_owner']
    if (user?.isSuperAdmin) return allRoles
    if (user?.role === 'org_owner') return ['viewer', 'user', 'org_admin']
    if (user?.role === 'org_admin') return ['viewer', 'user']
    return []
  })()

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'authentication': return '🔐'
      case 'device_management': return '📱'
      case 'alert_management': return '🔔'
      case 'organization': return '🏢'
      case 'integration': return '🔗'
      default: return '📋'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-sm text-muted-foreground">Total Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{members.filter(m => m.users?.last_sign_in_at && !m.users?.banned_until).length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Mail className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{members.filter(m => !m.users?.last_sign_in_at).length}</p>
                <p className="text-sm text-muted-foreground">Pending Invite</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserX className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{members.filter(m => m.users?.banned_until).length}</p>
                <p className="text-sm text-muted-foreground">Disabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Member Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Organization Members
          </CardTitle>
          <CardDescription>Manage members, view activity, and take support actions</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="org_owner">Owner</SelectItem>
                <SelectItem value="org_admin">Admin</SelectItem>
                <SelectItem value="user">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchMembers}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchQuery || roleFilter !== 'all' ? 'No members match your filters' : 'No members found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => {
                    const status = getMemberStatus(member)
                    const fullName = (member.users?.raw_user_meta_data?.full_name as string) || null
                    const isExpanded = expandedUserId === member.user_id

                    return (
                      <>
                        <TableRow
                          key={member.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleExpandUser(member.user_id)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{fullName || member.users?.email || 'Unknown'}</p>
                              {fullName && <p className="text-xs text-muted-foreground">{member.users?.email}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(member.role)}>
                              {member.role === 'org_owner' ? 'Owner' :
                               member.role === 'org_admin' ? 'Admin' :
                               member.role === 'user' ? 'Member' :
                               member.role === 'viewer' ? 'Viewer' :
                               member.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {member.users?.last_sign_in_at
                              ? formatDistanceToNow(new Date(member.users.last_sign_in_at), { addSuffix: true })
                              : 'Never'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(member.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </TableCell>
                        </TableRow>

                        {/* Expanded Detail Panel */}
                        {isExpanded && (
                          <TableRow key={`${member.id}-detail`}>
                            <TableCell colSpan={6} className="bg-muted/30 p-0">
                              <div className="p-4 space-y-4">
                                {/* Quick Actions */}
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={actionLoading === 'reset-password'}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleResetPassword(member.users?.email || '')
                                    }}
                                  >
                                    <KeyRound className="w-4 h-4 mr-1" />
                                    {actionLoading === 'reset-password' ? 'Sending...' : 'Reset Password'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      navigator.clipboard.writeText(member.users?.email || '')
                                      toast.success('Email copied to clipboard')
                                    }}
                                  >
                                    <Copy className="w-4 h-4 mr-1" />
                                    Copy Email
                                  </Button>

                                  {/* Role Change Dropdown */}
                                  {availableRoles.length > 0 && member.role !== 'super_admin' && (
                                    <Select
                                      value={member.role}
                                      onValueChange={(newRole) => {
                                        if (newRole !== member.role) {
                                          handleChangeRole(member.id, member.users?.email || '', newRole)
                                        }
                                      }}
                                      disabled={actionLoading === `role-${member.id}`}
                                    >
                                      <SelectTrigger className="w-[140px] h-8 text-xs">
                                        <UserCog className="w-3 h-3 mr-1" />
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableRoles.map((role) => (
                                          <SelectItem key={role} value={role}>
                                            {role === 'org_owner' ? 'Owner' :
                                             role === 'org_admin' ? 'Admin' :
                                             role === 'user' ? 'Member' : 'Viewer'}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </div>

                                {/* Activity Timeline */}
                                <div>
                                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Recent Activity
                                  </h4>
                                  {activityLoading ? (
                                    <div className="space-y-2">
                                      {[...Array(3)].map((_, i) => (
                                        <Skeleton key={i} className="h-8 w-full" />
                                      ))}
                                    </div>
                                  ) : activityTimeline.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No recent activity recorded</p>
                                  ) : (
                                    <div className="max-h-64 overflow-y-auto space-y-1">
                                      {activityTimeline.slice(0, 20).map((entry) => (
                                        <div
                                          key={entry.id}
                                          className="flex items-start gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50"
                                        >
                                          <span className="flex-shrink-0 mt-0.5">{getCategoryIcon(entry.action_category)}</span>
                                          <div className="flex-1 min-w-0">
                                            <span className="font-medium">{entry.action_type.replace(/_/g, ' ')}</span>
                                            {entry.resource_name && (
                                              <span className="text-muted-foreground"> — {entry.resource_name}</span>
                                            )}
                                          </div>
                                          <Badge variant={entry.status === 'success' ? 'default' : 'destructive'} className="text-xs flex-shrink-0">
                                            {entry.status}
                                          </Badge>
                                          <span
                                            className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap"
                                            title={format(new Date(entry.created_at), 'PPpp')}
                                          >
                                            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Login History subset */}
                                {activityTimeline.filter(e => e.action_category === 'authentication').length > 0 && (
                                  <div>
                                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                                      <Shield className="w-4 h-4" />
                                      Recent Logins
                                    </h4>
                                    <div className="space-y-1">
                                      {activityTimeline
                                        .filter(e => e.action_category === 'authentication')
                                        .slice(0, 10)
                                        .map((login) => (
                                          <div key={login.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-muted/50">
                                            <Badge variant={login.status === 'success' ? 'default' : 'destructive'} className="text-xs">
                                              {login.action_type.replace(/_/g, ' ')}
                                            </Badge>
                                            <span className="text-muted-foreground text-xs">{login.ip_address || 'Unknown IP'}</span>
                                            <span className="text-muted-foreground text-xs flex-1 truncate">
                                              {login.user_agent?.split(' ')[0] || ''}
                                            </span>
                                            <span
                                              className="text-xs text-muted-foreground"
                                              title={format(new Date(login.created_at), 'PPpp')}
                                            >
                                              {formatDistanceToNow(new Date(login.created_at), { addSuffix: true })}
                                            </span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
