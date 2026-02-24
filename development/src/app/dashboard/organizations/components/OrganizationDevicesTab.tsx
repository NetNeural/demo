'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import {
  Smartphone,
  Plus,
  Power,
  AlertCircle,
  ArrowRightLeft,
  Trash2,
  Search,
} from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { edgeFunctions } from '@/lib/edge-functions'
import { useToast } from '@/hooks/use-toast'

interface Device {
  id: string
  name: string
  status: 'online' | 'offline' | 'warning' | 'error'
  location: string
  lastSeen: string
  device_type?: string
  serial_number?: string
}

interface OrganizationDevicesTabProps {
  organizationId: string
}

export function OrganizationDevicesTab({
  organizationId,
}: OrganizationDevicesTabProps) {
  const router = useRouter()
  const { canManageDevices, userOrganizations } = useOrganization()
  const { toast } = useToast()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [transferDevice, setTransferDevice] = useState<Device | null>(null)
  const [targetOrgId, setTargetOrgId] = useState('')
  const [transferring, setTransferring] = useState(false)

  /** Other orgs the user belongs to (for transfer target) */
  const otherOrgs = useMemo(
    () => userOrganizations.filter((org) => org.id !== organizationId),
    [userOrganizations, organizationId]
  )

  const fetchDevices = useCallback(async () => {
    if (!organizationId) {
      setDevices([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await edgeFunctions.devices.list(organizationId)

      if (!response.success) {
        const errorMsg = response.error?.message || 'Failed to fetch devices'
        throw new Error(errorMsg)
      }

      setDevices((response.data?.devices as Device[]) || [])
    } catch (error) {
      console.error('Error fetching devices:', error)
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  /** Filter devices by search */
  const filteredDevices = useMemo(() => {
    if (!search.trim()) return devices
    const q = search.toLowerCase()
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.location?.toLowerCase().includes(q) ||
        d.device_type?.toLowerCase().includes(q) ||
        d.serial_number?.toLowerCase().includes(q)
    )
  }, [devices, search])

  /** Remove device from organization (soft delete) */
  const handleRemoveDevice = async (device: Device) => {
    if (
      !confirm(
        `Are you sure you want to remove "${device.name}" from this organization? This will delete the device.`
      )
    ) {
      return
    }

    try {
      const response = await edgeFunctions.devices.delete(device.id)
      if (!response.success) {
        throw new Error(
          response.error?.message || 'Failed to remove device'
        )
      }
      toast({
        title: 'Device Removed',
        description: `${device.name} has been removed from the organization`,
      })
      await fetchDevices()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to remove device',
        variant: 'destructive',
      })
    }
  }

  /** Open transfer dialog */
  const openTransferDialog = (device: Device) => {
    setTransferDevice(device)
    setTargetOrgId('')
    setShowTransferDialog(true)
  }

  /** Transfer device to another organization */
  const handleTransferDevice = async () => {
    if (!transferDevice || !targetOrgId) return

    try {
      setTransferring(true)
      const response = await edgeFunctions.devices.transfer(
        transferDevice.id,
        targetOrgId
      )

      if (!response.success) {
        throw new Error(
          response.error?.message || 'Failed to transfer device'
        )
      }

      const targetOrg = userOrganizations.find((o) => o.id === targetOrgId)
      toast({
        title: 'Device Transferred',
        description: `${transferDevice.name} has been moved to ${targetOrg?.name || 'the target organization'}`,
      })
      setShowTransferDialog(false)
      await fetchDevices()
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to transfer device',
        variant: 'destructive',
      })
    } finally {
      setTransferring(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Devices ({devices.length})
              </CardTitle>
              <CardDescription>
                Devices assigned to this organization
              </CardDescription>
            </div>
            {canManageDevices && (
              <Button
                onClick={() =>
                  router.push(
                    `/dashboard/devices?action=add&organization=${organizationId}`
                  )
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Device
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Search filter */}
          {devices.length > 3 && (
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search devices by name, location, type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm"
              />
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading devices...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                No devices found for this organization
              </p>
              {canManageDevices && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Click &quot;Add Device&quot; to register your first device
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-start gap-3">
                    <Smartphone className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {device.location}
                      </p>
                      {device.device_type && (
                        <p className="text-xs text-muted-foreground">
                          Type: {device.device_type}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Last seen: {device.lastSeen}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {device.status === 'online' ? (
                      <Badge variant="default" className="bg-green-500">
                        <Power className="mr-1 h-3 w-3" />
                        Online
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Offline
                      </Badge>
                    )}

                    {canManageDevices && (
                      <div className="flex gap-1">
                        {otherOrgs.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTransferDialog(device)}
                            title="Transfer to another organization"
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDevice(device)}
                          title="Remove device from organization"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {search && filteredDevices.length === 0 && (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No devices matching &quot;{search}&quot;
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Device Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Device</DialogTitle>
            <DialogDescription>
              Move &quot;{transferDevice?.name}&quot; to a different
              organization. The device will be removed from this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Target Organization
              </label>
              <Select value={targetOrgId} onValueChange={setTargetOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization..." />
                </SelectTrigger>
                <SelectContent>
                  {otherOrgs.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTransferDialog(false)}
              disabled={transferring}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransferDevice}
              disabled={!targetOrgId || transferring}
            >
              {transferring ? 'Transferring...' : 'Transfer Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
