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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('User not authenticated')
        return
      }

      // Get all organizations where user is a member
      const { data: memberships, error: membershipsError } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(id, name)')
        .eq('user_id', user.id)

      if (membershipsError) throw membershipsError

      // Extract organizations from memberships
      const orgs = memberships
        ?.map(m => (m.organizations as { id: string; name: string } | null))
        .filter((org): org is { id: string; name: string } => org !== null && org.id !== currentOrgId) // Exclude current organization
        .map(org => ({ id: org.id, name: org.name })) || []

      setOrganizations(orgs)

      if (orgs.length === 0) {
        toast.info('You only belong to one organization')
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
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('No active session')
      }

      // Call the integrations Edge Function to create a new integration
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const response = await fetch(
        `${supabaseUrl}/functions/v1/integrations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organization_id: selectedOrgId,
            integration_type: integration.type,
            name: `${integration.name} (Copy)`,
            settings: integration.config,
            status: 'active'
          })
        }
      )

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
            status: 'active'
          }
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

      toast.success(`Successfully copied "${integration.name}" to the selected organization`)
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error copying integration:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to copy integration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            Copy Integration
          </DialogTitle>
          <DialogDescription>
            Copy &quot;{integration?.name}&quot; to another organization you manage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingOrgs ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No other organizations available. You only belong to one organization.
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
            <div className="bg-muted rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium">What will be copied:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
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
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Copy Integration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
