/**
 * Edit Member Dialog
 *
 * Allows admin/owner/superadmin to edit user profile details
 * (full name and email) for organization members.
 *
 * @see Issue #182
 */
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { edgeFunctions } from '@/lib/edge-functions/client'

interface EditMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  member: {
    id: string
    userId: string
    name: string
    email: string
    role: string
  } | null
  onMemberUpdated: () => void
}

export function EditMemberDialog({
  open,
  onOpenChange,
  organizationId,
  member,
  onMemberUpdated,
}: EditMemberDialogProps) {
  const { toast } = useToast()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<{
    fullName?: string
    email?: string
    general?: string
  }>({})

  // Populate form when member changes
  useEffect(() => {
    if (member && open) {
      setFullName(member.name || '')
      setEmail(member.email || '')
      setErrors({})
    }
  }, [member, open])

  function validate(): boolean {
    const errs: typeof errors = {}

    if (!fullName.trim()) {
      errs.fullName = 'Full name is required'
    } else if (fullName.trim().length > 100) {
      errs.fullName = 'Name must be 100 characters or less'
    }

    if (!email.trim()) {
      errs.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Invalid email address'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSave() {
    if (!member || !validate()) return

    try {
      setSaving(true)
      setErrors({})

      // Build update payload - only include changed fields
      const updates: { fullName?: string; email?: string } = {}
      if (fullName.trim() !== member.name) {
        updates.fullName = fullName.trim()
      }
      if (email.trim() !== member.email) {
        updates.email = email.trim()
      }

      if (Object.keys(updates).length === 0) {
        // Nothing changed
        onOpenChange(false)
        return
      }

      const response = await edgeFunctions.members.updateProfile(
        organizationId,
        member.userId,
        updates
      )

      if (!response.success) {
        const errorMsg =
          typeof response.error === 'string'
            ? response.error
            : response.error?.message || 'Failed to update member'
        throw new Error(errorMsg)
      }

      toast({
        title: 'Member Updated',
        description: `${fullName.trim()}'s profile has been updated`,
      })

      onOpenChange(false)
      onMemberUpdated()
    } catch (error) {
      console.error('Error updating member:', error)
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to update member'
      setErrors({ general: errorMsg })

      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
          <DialogDescription>
            Update profile information for {member?.name || 'this member'}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {errors.general && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {errors.general}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value)
                setErrors((prev) => ({ ...prev, fullName: undefined }))
              }}
              placeholder="Enter full name..."
              className={errors.fullName ? 'border-destructive' : ''}
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setErrors((prev) => ({ ...prev, email: undefined }))
              }}
              placeholder="Enter email address..."
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="text-muted-foreground">Role</Label>
            <p className="text-sm capitalize text-muted-foreground">
              {member?.role} (change role from the members table)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
