/**
 * Test Device Creation Dialog
 *
 * Allows users to create fake/test devices for development and testing.
 * Supports selecting from existing device types to inherit configuration.
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
import { Badge } from '@/components/ui/badge'
import { Loader2, FlaskConical } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { DeviceType } from '@/types/device-types'

interface TestDeviceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TestDeviceDialog({
  open,
  onOpenChange,
  onSuccess,
}: TestDeviceDialogProps) {
  const { currentOrganization } = useOrganization()
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [deviceTypeId, setDeviceTypeId] = useState<string>('')
  const [location, setLocation] = useState('Test Environment')

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

    if (!deviceTypeId) {
      toast.error('Please select a device type')
      return
    }

    if (!currentOrganization?.id) {
      toast.error('No organization selected')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      // Get the selected device type
      const selectedType = deviceTypes.find((t) => t.id === deviceTypeId)

      // Create the test device
      const { data, error } = await supabase
        .from('devices')
        .insert({
          name: name.trim(),
          organization_id: currentOrganization.id,
          device_type: selectedType?.name || 'Test Device',
          device_type_id: deviceTypeId,
          location: location.trim() || 'Test Environment',
          is_test_device: true,
          status: 'online',
          battery_level: 100,
          signal_strength: -50,
          firmware_version: 'TEST-1.0.0',
        })
        .select()
        .single()

      if (error) throw error

      toast.success(`Test device "${name}" created successfully`)

      // Reset form
      setName('')
      setDeviceTypeId('')
      setLocation('Test Environment')

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to create test device:', error)
      toast.error('Failed to create test device')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-500" />
            <DialogTitle>Create Test Device</DialogTitle>
          </div>
          <DialogDescription>
            Create a fake device for testing alerts, graphs, and AI features.
            Test devices can be controlled via interactive controls.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Device Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Device Name</Label>
            <Input
              id="name"
              placeholder="e.g., Test Temperature Sensor A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Device Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="device-type">Device Type</Label>
            {loadingTypes ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading device types...
              </div>
            ) : deviceTypes.length === 0 ? (
              <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
                No device types configured. Create device types first in the{' '}
                <a
                  href="/dashboard/device-types"
                  className="text-blue-500 hover:underline"
                >
                  Device Types
                </a>{' '}
                page.
              </div>
            ) : (
              <Select
                value={deviceTypeId}
                onValueChange={setDeviceTypeId}
                disabled={loading}
              >
                <SelectTrigger id="device-type">
                  <SelectValue placeholder="Select a device type" />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <span>{type.name}</span>
                        {type.device_class && (
                          <Badge
                            variant="outline"
                            className="px-1 py-0 text-[10px]"
                          >
                            {type.device_class}
                          </Badge>
                        )}
                        {type.unit && (
                          <span className="text-xs text-muted-foreground">
                            ({type.unit})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="e.g., Test Lab, Staging Environment"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Info */}
          <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-3">
            <div className="flex gap-2">
              <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Test devices</strong> will
                  have a special badge and interactive controls for adjusting
                  sensor values, triggering alerts, and creating scenarios.
                </p>
              </div>
            </div>
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
          <Button onClick={handleCreate} disabled={loading || !deviceTypeId}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Test Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
