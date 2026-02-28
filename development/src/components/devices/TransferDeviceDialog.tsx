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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRightLeft, Copy, Loader2, AlertCircle, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getSupabaseUrl } from '@/lib/supabase/config'
import { toast } from 'sonner'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import type { Device } from '@/types/sensor-details'

interface Organization {
  id: string
  name: string
}

type TransferMode = 'move' | 'copy'

interface TransferDeviceDialogProps {
  device: Device
  currentOrgId: string
  onTransferComplete?: () => void
}

export function TransferDeviceDialog({
  device,
  currentOrgId,
  onTransferComplete,
}: TransferDeviceDialogProps) {
  const [open, setOpen] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [mode, setMode] = useState<TransferMode>('move')
  const [includeTelemetry, setIncludeTelemetry] = useState(true)
  const [telemetryCount, setTelemetryCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const { user } = useUser()
  const { userOrganizations } = useOrganization()

  const fetchOrganizations = useCallback(async () => {
    try {
      setLoadingOrgs(true)
      const isSuperAdmin = user?.isSuperAdmin || user?.role === 'super_admin'

      // Use organizations from context — already fetched via edge function
      // which handles permissions (super_admin sees all, others see their memberships).
      // The context's userOrganizations includes each org's role for the user.
      if (userOrganizations && userOrganizations.length > 0) {
        const adminRoles = ['owner', 'admin', 'org_owner', 'org_admin']
        const orgs = userOrganizations
          .filter((o) => {
            if (o.id === currentOrgId) return false
            // Super admins can transfer to any org
            if (isSuperAdmin) return true
            // Others need admin/owner role in the target org
            return adminRoles.includes(o.role)
          })
          .map((o) => ({ id: o.id, name: o.name }))
        setOrganizations(orgs)
      } else {
        setOrganizations([])
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast.error('Failed to load organizations')
    } finally {
      setLoadingOrgs(false)
    }
  }, [currentOrgId, user, userOrganizations])

  const fetchTelemetryCount = useCallback(async () => {
    try {
      const supabase = createClient()
      const { count, error } = await supabase
        .from('device_telemetry_history')
        .select('*', { count: 'exact', head: true })
        .eq('device_id', device.id)

      if (!error && count !== null) {
        setTelemetryCount(count)
      }
    } catch {
      setTelemetryCount(null)
    }
  }, [device.id])

  useEffect(() => {
    if (open) {
      fetchOrganizations()
      fetchTelemetryCount()
    }
  }, [open, fetchOrganizations, fetchTelemetryCount])

  // Default: include telemetry for move, exclude for copy
  useEffect(() => {
    setIncludeTelemetry(mode === 'move')
  }, [mode])

  const handleTransfer = async () => {
    if (!selectedOrgId) {
      toast.error('Please select a target organization')
      return
    }

    try {
      setLoading(true)

      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        toast.error('Not authenticated')
        return
      }

      // Call the transfer-device edge function (uses service_role to bypass RLS)
      const supabaseUrl = getSupabaseUrl()
      const response = await fetch(
        `${supabaseUrl}/functions/v1/transfer-device`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            deviceId: device.id,
            targetOrgId: selectedOrgId,
            mode,
            includeTelemetry,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.message || result.error || 'Transfer failed')
      }

      const targetOrg = organizations.find((org) => org.id === selectedOrgId)
      const actionWord = mode === 'move' ? 'transferred' : 'copied'
      toast.success(
        `Device ${actionWord} to ${targetOrg?.name || 'target organization'}`
      )

      setOpen(false)
      setSelectedOrgId('')
      setMode('move')
      setIncludeTelemetry(true)

      if (onTransferComplete) {
        onTransferComplete()
      } else if (mode === 'move') {
        // For move: redirect since device is no longer in this org
        window.location.href = '/dashboard/devices'
      }
    } catch (error) {
      console.error('Error transferring device:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to transfer device'
      )
    } finally {
      setLoading(false)
    }
  }

  const actionLabel = mode === 'move' ? 'Transfer' : 'Copy'
  const actioningLabel = mode === 'move' ? 'Transferring...' : 'Copying...'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          Transfer Device
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Transfer / Copy Device</DialogTitle>
          <DialogDescription>
            {mode === 'move' ? 'Move' : 'Copy'} <strong>{device.name}</strong>{' '}
            to a different organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loadingOrgs ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : organizations.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  No Other Organizations Available
                </p>
                <p className="text-xs text-muted-foreground">
                  You need admin or owner role in at least one other
                  organization to transfer devices.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Mode Toggle */}
              <div className="space-y-2">
                <Label>Mode</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={mode === 'move' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setMode('move')}
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Move (transfer)
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'copy' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setMode('copy')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy (clone)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode === 'move'
                    ? 'Device will be removed from the current organization.'
                    : 'A clone will be created in the target organization. The original remains unchanged.'}
                </p>
              </div>

              {/* Target Organization */}
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
              </div>

              {/* Telemetry Toggle */}
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <input
                  type="checkbox"
                  id="include-telemetry"
                  checked={includeTelemetry}
                  onChange={(e) => setIncludeTelemetry(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label
                  htmlFor="include-telemetry"
                  className="flex-1 cursor-pointer"
                >
                  <span className="text-sm font-medium">
                    Include telemetry data
                  </span>
                  {telemetryCount !== null && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({telemetryCount.toLocaleString()} records)
                    </span>
                  )}
                </Label>
              </div>

              {/* Summary */}
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="mb-2 text-sm font-medium">
                  What will be {mode === 'move' ? 'transferred' : 'copied'}:
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• Device configuration &amp; metadata</li>
                  {mode === 'move' && <li>• Alert rules and history</li>}
                  <li>• Sensor thresholds</li>
                  {includeTelemetry && (
                    <li>
                      • Telemetry history
                      {telemetryCount !== null &&
                        ` (${telemetryCount.toLocaleString()} records)`}
                    </li>
                  )}
                  {mode === 'copy' && (
                    <li>• Location/department will be cleared on copy</li>
                  )}
                </ul>

                {mode === 'move' && (
                  <div className="mt-3 flex items-start gap-2 border-t pt-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <p className="text-xs text-amber-600">
                      Moving a device removes it from the current organization.
                      This action cannot be undone from this dialog.
                    </p>
                  </div>
                )}
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
            disabled={
              loading ||
              !selectedOrgId ||
              loadingOrgs ||
              organizations.length === 0
            }
            variant={mode === 'move' ? 'default' : 'secondary'}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {actioningLabel}
              </>
            ) : (
              <>
                {mode === 'move' ? (
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {actionLabel} Device
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
