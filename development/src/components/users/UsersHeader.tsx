'use client'

import { Button } from '@/components/ui/button'

export function UsersHeader() {
  return (
    <div className="flex items-center justify-between space-y-2">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
        <p className="text-muted-foreground">Manage user accounts and permissions</p>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline">
          Import Users
        </Button>
        <Button>
          Invite User
        </Button>
      </div>
    </div>
  )
}