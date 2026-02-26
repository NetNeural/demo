/**
 * Test Device Creation Dialog
 *
 * Creates a NetNeural Modular Test Sensor with 4 built-in sensor channels
 * (Temperature, Humidity, CO₂, Battery). No device type selection needed.
 */
'use client'

import { useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  FlaskConical,
  Thermometer,
  Droplets,
  Wind,
  BatteryMedium,
} from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { createClient } from '@/lib/supabase/client'
import { testTelemetryFrom } from '@/lib/supabase/test-telemetry'
import { toast } from 'sonner'

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
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('NetNeural Modular Test Sensor')
  const [location, setLocation] = useState('Test Environment')

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a device name')
      return
    }
    if (!currentOrganization?.id) {
      toast.error('No organization selected')
      return
    }

    setLoading(true)
    try {
      const response = await edgeFunctions.devices.create({
        name: name.trim(),
        organization_id: currentOrganization.id,
        device_type: 'NetNeural Modular Test Sensor',
        location: location.trim() || 'Test Environment',
        is_test_device: true,
        status: 'online',
        battery_level: 85,
        signal_strength: -55,
        firmware_version: 'MODULAR-2.0.0',
      })

      if (!response.success) {
        const errorMsg =
          typeof response.error === 'string'
            ? response.error
            : response.error?.message || 'Failed to create test device'
        throw new Error(errorMsg)
      }

      // Seed initial telemetry so Temperature/Humidity/CO₂/Battery appear immediately
      const createdDeviceId =
        (
          response.data as {
            device?: {
              id?: string
            }
          }
        )?.device?.id || null

      if (createdDeviceId) {
        const supabase = createClient()
        const now = new Date().toISOString()
        const { error: telemetryError } = await testTelemetryFrom(supabase)
          .insert({
            device_id: createdDeviceId,
            organization_id: currentOrganization.id,
            telemetry: {
              temperature: 22,
              humidity: 45,
              co2: 600,
              battery: 85,
            },
            device_timestamp: now,
            received_at: now,
          } as any)  // eslint-disable-line @typescript-eslint/no-explicit-any

        if (telemetryError) {
          console.warn('Created test device, but failed to seed telemetry:', telemetryError)
        }
      }

      toast.success(`Test device "${name.trim()}" created successfully`)
      setName('NetNeural Modular Test Sensor')
      setLocation('Test Environment')
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      console.error('Failed to create test device:', err)
      toast.error('Failed to create test device')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-blue-500" />
            <DialogTitle>Create Test Device</DialogTitle>
          </div>
          <DialogDescription>
            Creates a <strong>NetNeural Modular Test Sensor</strong> with 4
            built-in channels you can control independently or all at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sensor channels preview */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Thermometer className="h-3 w-3 text-red-500" /> Temperature °C
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Droplets className="h-3 w-3 text-blue-500" /> Humidity %
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Wind className="h-3 w-3 text-green-500" /> CO₂ ppm
            </Badge>
            <Badge variant="outline" className="gap-1.5 text-xs">
              <BatteryMedium className="h-3 w-3 text-yellow-500" /> Battery %
            </Badge>
          </div>

          {/* Device Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Device Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
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

          <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-3">
            <div className="flex gap-2">
              <FlaskConical className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
              <p className="text-sm text-muted-foreground">
                After creation, use the{' '}
                <strong className="text-foreground">Test Controls</strong> panel
                on the device card to adjust values, trigger alerts, and send
                data for individual sensors or all at once.
              </p>
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
          <Button onClick={handleCreate} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Test Device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
