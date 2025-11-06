'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { ImportUsersDialog } from './ImportUsersDialog'
import { CreateUserDialog } from '../organizations/CreateUserDialog'

export function UsersHeader() {
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">Manage user accounts and permissions</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Import Users
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            Create User
          </Button>
        </div>
      </div>

      {/* Import Users Dialog */}
      <ImportUsersDialog
        open={importOpen}
        onOpenChange={setImportOpen}
      />

      {/* Create User Dialog */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onUserCreated={() => {
          // Optionally refresh user list
        }}
      />
    </>
  )
}