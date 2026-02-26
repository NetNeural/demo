'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useCallback } from 'react'
import { UserDetailsDialog } from './UserDetailsDialog'
import { EditUserDialog } from './EditUserDialog'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

interface User {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'org_admin' | 'org_owner' | 'user' | 'viewer'
  status: 'active' | 'inactive' | 'pending'
  lastLogin?: string
  department?: string
}

/** Format an ISO timestamp into a human-readable relative time string */
function formatRelativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`
  return new Date(isoDate).toLocaleDateString()
}

export function UsersList() {
  const { currentOrganization } = useOrganization()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const fetchUsers = useCallback(async () => {
    if (!currentOrganization) {
      setUsers([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setFetchError(null)

      const supabase = createClient()

      // Fetch primary org members (users whose organization_id matches)
      const { data: primaryUsers, error: primaryError } = await supabase
        .from('users')
        .select('id, email, full_name, role, is_active, last_login')
        .eq('organization_id', currentOrganization.id)
        .order('full_name')

      if (primaryError) throw primaryError

      const primaryIds = new Set((primaryUsers ?? []).map((u) => u.id))

      // Map primary users
      const mapped: User[] = (primaryUsers ?? []).map((u) => ({
        id: u.id,
        name: u.full_name ?? u.email,
        email: u.email,
        role: (u.role as User['role']) ?? 'user',
        status: u.is_active ? 'active' : 'inactive',
        lastLogin: u.last_login ? formatRelativeTime(u.last_login) : undefined,
      }))

      // Try to fetch secondary org members via organization_members table
      try {
        const { data: secondaryMembers } = await supabase
          .from('organization_members')
          .select('user_id, role')
          .eq('organization_id', currentOrganization.id)

        if (secondaryMembers && secondaryMembers.length > 0) {
          const secondaryIds = secondaryMembers
            .map((m) => m.user_id)
            .filter((id) => !primaryIds.has(id))

          if (secondaryIds.length > 0) {
            const { data: secondaryUsers } = await supabase
              .from('users')
              .select('id, email, full_name, is_active, last_login')
              .in('id', secondaryIds)

            if (secondaryUsers) {
              const roleMap = new Map(
                secondaryMembers.map((m) => [m.user_id, m.role])
              )
              for (const u of secondaryUsers) {
                mapped.push({
                  id: u.id,
                  name: u.full_name ?? u.email,
                  email: u.email,
                  role: (roleMap.get(u.id) as User['role']) ?? 'user',
                  status: u.is_active ? 'active' : 'inactive',
                  lastLogin: u.last_login
                    ? formatRelativeTime(u.last_login)
                    : undefined,
                })
              }
            }
          }
        }
      } catch {
        // Secondary members fetch is non-critical
      }

      setUsers(mapped)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load users'
      console.error('Error fetching users:', err)
      setFetchError(message)
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const getRoleIcon = (role: User['role']) => {
    switch (role) {
      case 'super_admin':
        return '👑'
      case 'org_admin':
        return '🔑'
      case 'org_owner':
        return '🏢'
      case 'user':
        return '👤'
      case 'viewer':
        return '👁️'
      default:
        return '❓'
    }
  }

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'inactive':
        return 'text-gray-600 bg-gray-100'
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-400 bg-gray-50'
    }
  }

  const getRoleColor = (role: User['role']) => {
    switch (role) {
      case 'super_admin':
        return 'text-purple-600 bg-purple-100'
      case 'org_admin':
        return 'text-blue-600 bg-blue-100'
      case 'org_owner':
        return 'text-indigo-600 bg-indigo-100'
      case 'user':
        return 'text-green-600 bg-green-100'
      case 'viewer':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-400 bg-gray-50'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          <span className="text-muted-foreground">Loading users…</span>
        </CardContent>
      </Card>
    )
  }

  if (fetchError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">{fetchError}</p>
          <Button variant="outline" className="mt-4" onClick={fetchUsers}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Organization Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
                    <span className="text-lg">{getRoleIcon(user.role)}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.email}
                    </p>
                    {user.department && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {user.department}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="mb-1 flex space-x-2">
                      <span
                        className={`rounded px-2 py-1 text-xs ${getRoleColor(user.role)}`}
                      >
                        {user.role.replace('_', ' ').toUpperCase()}
                      </span>
                      <span
                        className={`rounded px-2 py-1 text-xs ${getStatusColor(user.status)}`}
                      >
                        {user.status.toUpperCase()}
                      </span>
                    </div>
                    {user.lastLogin && (
                      <p className="text-xs text-muted-foreground">
                        Last login: {user.lastLogin}
                      </p>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user)
                        setEditOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user)
                        setDetailsOpen(true)
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {users.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              <p>No users found</p>
              <Button className="mt-4">Invite Your First User</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <UserDetailsDialog
        user={selectedUser}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onEdit={(user) => {
          setSelectedUser(user)
          setEditOpen(true)
        }}
      />

      {/* Edit User Dialog */}
      <EditUserDialog
        user={selectedUser}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  )
}
