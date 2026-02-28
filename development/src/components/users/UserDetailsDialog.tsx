'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface User {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'org_admin' | 'org_owner' | 'user' | 'viewer'
  status: 'active' | 'inactive' | 'pending'
  lastLogin?: string
  department?: string
}

interface UserDetailsDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit?: (user: User) => void
}

export function UserDetailsDialog({
  user,
  open,
  onOpenChange,
  onEdit,
}: UserDetailsDialogProps) {
  if (!user) return null

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default'
      case 'inactive':
        return 'secondary'
      case 'pending':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            Detailed information for {user.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Basic Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium">Name:</span>
                  <span className="text-right text-sm">{user.name}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium">Email:</span>
                  <span className="text-right text-sm">{user.email}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-sm font-medium">Role:</span>
                  <Badge variant="outline" className="ml-2">
                    {user.role}
                  </Badge>
                </div>
                {user.department && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium">Department:</span>
                    <span className="text-right text-sm">
                      {user.department}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status & Activity */}
            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Status & Activity
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  <Badge variant={getStatusBadgeVariant(user.status)}>
                    {user.status}
                  </Badge>
                </div>
                {user.lastLogin && (
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium">Last Login:</span>
                    <span className="text-right text-sm text-muted-foreground">
                      {user.lastLogin}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {onEdit && (
              <Button
                onClick={() => {
                  onEdit(user)
                  onOpenChange(false)
                }}
              >
                Edit User
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
