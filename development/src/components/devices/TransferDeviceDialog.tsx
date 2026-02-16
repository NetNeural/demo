'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowRightLeft, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Device } from '@/types/sensor-details'

interface Organization {
  id: string
  name: string
}

interface TransferDeviceDialogProps {
  device: Device
  currentOrgId: string
  onTransferComplete?: () => void
}

export function TransferDeviceDialog({ device, currentOrgId, onTransferComplete }: TransferDeviceDialogProps) {
  const [open, setOpen] = useState(false)
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

  const handleTransfer = async () => {
    if (!selectedOrgId) {
      toast.error('Please select a target organization')
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()

      // Update device organization
      const { error } = await supabase
        .from('devices')
        .update({
          organization_id: selectedOrgId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', device.id)
        .eq('organization_id', currentOrgId) // Security: only allow if current org owns it

      if (error) throw error

      const targetOrg = organizations.find(org => org.id === selectedOrgId)
      toast.success(`Device transferred to ${targetOrg?.name || 'target organization'}`)

      setOpen(false)
      
      // Callback to refresh page or redirect
      if (onTransferComplete) {
        onTransferComplete()
      } else {
        // Default: redirect to devices list
        window.location.href = '/dashboard/devices'
      }
    } catch (error) {
      console.error('Error transferring device:', error)
      toast.error('Failed to transfer device')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowRightLeft className="h-4 w-4 mr-2" />
          Transfer Device
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transfer Device to Another Organization</DialogTitle>
          <DialogDescription>
            Move <strong>{device.name}</strong> to a different organization that you manage.
            This action will transfer all device data and telemetry history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingOrgs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">No Other Organizations Available</p>
                <p className="text-xs text-muted-foreground">
                  You only belong to one organization. Join or create another organization to transfer devices.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="target-org">Target Organization</Label>
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger id="target-org">
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
                <p className="text-xs text-muted-foreground">
                  Device will be moved from the current organization to the selected one.
                </p>
              </div>

              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">What will be transferred:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Device configuration and metadata</li>
                  <li>• All telemetry data and history</li>
                  <li>• Alert rules and thresholds</li>
                  <li>• Location and installation details</li>
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={loading || !selectedOrgId || loadingOrgs || organizations.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer Device
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
