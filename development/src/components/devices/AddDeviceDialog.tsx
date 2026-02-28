/**
 * Add Device Dialog
 *
 * Allows users to register new IoT devices to their organization.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Network } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { toast } from 'sonner'
import type { DeviceType } from '@/types/device-types'

interface AddDeviceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddDeviceDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddDeviceDialogProps) {
  const { currentOrganization } = useOrganization()
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [isGateway, setIsGateway] = useState(false)
  const [deviceTypeId, setDeviceTypeId] = useState<string>('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [firmwareVersion, setFirmwareVersion] = useState('')
  const [location, setLocation] = useState('')

  // Load device types for the current org
  useEffect(() => {
    if (!open || !currentOrganization?.id) return

    const loadDeviceTypes = async () => {
      setLoadingTypes(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('device_types')
          .select('*')
          .eq('organization_id', currentOrganization.id)
          .order('name')

        if (error) throw error
        setDeviceTypes(data || [])
      } catch (error) {
        console.error('Failed to load device types:', error)
        toast.error('Failed to load device types')
      } finally {
        setLoadingTypes(false)
      }
    }

    loadDeviceTypes()
  }, [open, currentOrganization?.id])

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a device name')
      return
    }

    if (!isGateway && !deviceTypeId) {
      toast.error('Please select a device type')
      return
    }

    if (!currentOrganization?.id) {
      toast.error('No organization selected')
      return
    }

    setLoading(true)
    try {
      // Get the selected device type
      const selectedType = deviceTypes.find((t) => t.id === deviceTypeId)

      // Create the device
      const deviceData = {
        name: name.trim(),
        organization_id: currentOrganization.id,
        device_type: isGateway ? 'gateway' : selectedType?.name || 'Unknown',
        device_type_id: isGateway ? null : deviceTypeId || null,
        status: 'offline' as const, // New devices start as offline until they connect
        is_test_device: false,
        ...(isGateway && { metadata: { is_gateway: true } }),
        ...(model.trim() && { model: model.trim() }),
        ...(serialNumber.trim() && { serial_number: serialNumber.trim() }),
        ...(firmwareVersion.trim() && {
          firmware_version: firmwareVersion.trim(),
        }),
        ...(location.trim() && { location: location.trim() }),
      }

      const response = await edgeFunctions.devices.create(deviceData)

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to add device')
      }

      toast.success(`Device "${name}" added successfully`)

      // Reset form
      setName('')
      setIsGateway(false)
      setDeviceTypeId('')
      setModel('')
      setSerialNumber('')
      setFirmwareVersion('')
      setLocation('')

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to add device:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to add device'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <DialogTitle>Add New Device</DialogTitle>
          </div>
          <DialogDescription>
            Register a new IoT device to your organization. Required fields are
            marked with *.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
          {/* Device Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Device Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Temperature Sensor A1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Gateway Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label
                  htmlFor="is-gateway"
                  className="cursor-pointer font-medium"
                >
                  Gateway Device
                </Label>
                <p className="text-xs text-muted-foreground">
                  Hub that relays data from child sensors
                </p>
              </div>
            </div>
            <Switch
              id="is-gateway"
              checked={isGateway}
              onCheckedChange={setIsGateway}
              disabled={loading}
            />
          </div>

          {/* Device Type */}
          {!isGateway && (
            <div className="space-y-2">
              <Label htmlFor="device-type">Device Type *</Label>
              {loadingTypes ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading device types...
                </div>
              ) : (
                <Select
                  value={deviceTypeId}
                  onValueChange={setDeviceTypeId}
                  disabled={loading}
                >
                  <SelectTrigger id="device-type">
                    <SelectValue placeholder="Select device type" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceTypes.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No device types found. Create one first.
                      </div>
                    ) : (
                      deviceTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Model (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              placeholder="e.g., TH-100"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Serial Number (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="serial">Serial Number</Label>
            <Input
              id="serial"
              placeholder="e.g., SN123456789"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Firmware Version (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="firmware">Firmware Version</Label>
            <Input
              id="firmware"
              placeholder="e.g., v1.2.3"
              value={firmwareVersion}
              onChange={(e) => setFirmwareVersion(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Location (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g., Building A, Floor 2"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={loading}
            />
          </div>
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
            onClick={handleCreate}
            disabled={loading || !name.trim() || (!isGateway && !deviceTypeId)}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Device
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
