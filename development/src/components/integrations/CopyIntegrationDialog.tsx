'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, Copy } from 'lucide-react'

interface CopyIntegrationDialogProps {
  integration: {
    id: string
    name: string
    type: string
    config: Record<string, unknown>
    organization_id?: string
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  currentOrgId: string
}

interface Organization {
  id: string
  name: string
}

export function CopyIntegrationDialog({
  integration,
  open,
  onOpenChange,
  onSuccess,
  currentOrgId,
}: CopyIntegrationDialogProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingOrgs, setLoadingOrgs] = useState(false)

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoadingOrgs(true)
      const supabase = createClient()

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error('User not authenticated')
        return
      }

      // Check if user is super_admin
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      let orgs: { id: string; name: string }[] = []

      if (profile?.role === 'super_admin') {
        // Super admins can copy to ANY organization
        const { data: allOrgs, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('is_active', true)
          .order('name')

        if (orgsError) throw orgsError

        orgs = (allOrgs || [])
          .filter((org) => org.id !== currentOrgId)
          .map((org) => ({ id: org.id, name: org.name }))
      } else {
        // Regular users: only orgs they're a member of
        const { data: memberships, error: membershipsError } = await supabase
          .from('organization_members')
          .select('organization_id, organizations(id, name)')
          .eq('user_id', user.id)

        if (membershipsError) throw membershipsError

        orgs =
          memberships
            ?.map((m) => m.organizations as { id: string; name: string } | null)
            .filter(
              (org): org is { id: string; name: string } =>
                org !== null && org.id !== currentOrgId
            )
            .map((org) => ({ id: org.id, name: org.name })) || []
      }

      setOrganizations(orgs)

      if (orgs.length === 0) {
        toast.info('No other organizations available')
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast.error('Failed to load organizations')
    } finally {
      setLoadingOrgs(false)
    }
  }, [currentOrgId])

  useEffect(() => {
    if (open) {
      fetchOrganizations()
    }
  }, [open, fetchOrganizations])

  const handleCopy = async () => {
    if (!selectedOrgId || !integration) {
      toast.error('Please select a target organization')
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()

      // Get the session for authorization
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      // Call the integrations Edge Function to create a new integration
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const response = await fetch(`${supabaseUrl}/functions/v1/integrations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: selectedOrgId,
          integration_type: integration.type,
          name: `${integration.name} (Copy)`,
          settings: integration.config,
          status: 'active',
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Integration copy failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          requestBody: {
            organization_id: selectedOrgId,
            integration_type: integration.type,
            name: `${integration.name} (Copy)`,
            settings: integration.config,
            status: 'active',
          },
        })

        let errorMessage = 'Failed to copy integration'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }

        throw new Error(errorMessage)
      }

      toast.success(
        `Successfully copied "${integration.name}" to the selected organization`
      )
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error copying integration:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to copy integration'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Copy Integration
          </DialogTitle>
          <DialogDescription>
            Copy &quot;{integration?.name}&quot; to another organization you
            manage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingOrgs ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              No other organizations available to copy this integration to.
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="target-org">Target Organization</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {integration && (
            <div className="space-y-1 rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">What will be copied:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Integration type: {integration.type}</li>
                <li>• Configuration settings</li>
                <li>• Status: Active</li>
                <li>• Name: {integration.name} (Copy)</li>
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={loading || !selectedOrgId || organizations.length === 0}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Copy Integration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
