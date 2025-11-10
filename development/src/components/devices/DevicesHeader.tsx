'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useOrganization } from '@/contexts/OrganizationContext'
import { GoliothSyncButton } from '@/components/integrations/GoliothSyncButton'
import { edgeFunctions } from '@/lib/edge-functions'

export function DevicesHeader() {
  const { toast } = useToast()
  const { currentOrganization } = useOrganization()
  const [open, setOpen] = useState(false)
  const [deviceName, setDeviceName] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [deviceType, setDeviceType] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [firmwareVersion, setFirmwareVersion] = useState('')
  const [location, setLocation] = useState('')
  const [goliothIntegration, setGoliothIntegration] = useState<string | null>(null)

  const loadGoliothIntegration = useCallback(async () => {
    if (!currentOrganization) return

    try {
      const response = await edgeFunctions.integrations.list(currentOrganization.id);
      if (response.success) {
        const responseData = response.data as any;
        const golioth = responseData?.integrations?.find(
          (i: any) => i.type === 'golioth' && i.status === 'active'
        );
        setGoliothIntegration(golioth?.id || null);
      }
    } catch (error) {
      console.error('Error loading Golioth integration:', error);
      setGoliothIntegration(null);
    }
  }, [currentOrganization])

  useEffect(() => {
    if (currentOrganization?.id) {
      loadGoliothIntegration()
    }
  }, [currentOrganization?.id, loadGoliothIntegration])

  const handleAddDevice = async () => {
    if (!deviceName || !deviceId || !deviceType) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Name, ID, and Type)",
        variant: "destructive",
      })
      return
    }

    if (!currentOrganization) {
      toast({
        title: "Error",
        description: "No organization selected",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await edgeFunctions.devices.create({
        organization_id: currentOrganization.id,
        device_id: deviceId,
        name: deviceName,
        device_type: deviceType,
        model: model || null,
        serial_number: serialNumber || null,
        firmware_version: firmwareVersion || null,
        location: location || null
      })

      if (!response.success) {
        const errorMsg = response.error?.message || 'Failed to create device';
        throw new Error(errorMsg);
      }

      toast({
        title: "Success",
        description: `Device "${deviceName}" has been added successfully!`,
      })
      
      setDeviceName('')
      setDeviceId('')
      setDeviceType('')
      setModel('')
      setSerialNumber('')
      setFirmwareVersion('')
      setLocation('')
      setOpen(false)
      
      // Trigger a refresh of the devices list
      window.location.reload()
    } catch (err) {
      console.error('Error creating device:', err)
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to create device',
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex items-center justify-between space-y-2">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Devices</h2>
        <p className="text-muted-foreground">Monitor your IoT devices and their status</p>
      </div>
      
      <div className="flex items-center gap-2">
        {goliothIntegration && currentOrganization && (
          <GoliothSyncButton
            integrationId={goliothIntegration}
            organizationId={currentOrganization.id}
            onSyncComplete={loadGoliothIntegration}
          />
        )}
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
              <DialogDescription>
                Register a new IoT device to your organization
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="device-name" className="text-sm text-muted-foreground">
                      Device Name *
                    </Label>
                    <Input
                      id="device-name"
                      placeholder="e.g., Office Sensor 1"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      className="font-medium"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="device-id" className="text-sm text-muted-foreground">
                      Device ID *
                    </Label>
                    <Input
                      id="device-id"
                      placeholder="e.g., DEV-001"
                      value={deviceId}
                      onChange={(e) => setDeviceId(e.target.value)}
                      className="font-mono text-sm"
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="device-type" className="text-sm text-muted-foreground">
                      Device Type *
                    </Label>
                    <Input
                      id="device-type"
                      placeholder="e.g., Temperature Sensor, Motion Detector, Air Quality Monitor"
                      value={deviceType}
                      onChange={(e) => setDeviceType(e.target.value)}
                      className="font-medium"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border"></div>

              {/* Hardware Details */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Hardware Details (Optional)</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="model" className="text-sm text-muted-foreground">
                      Model
                    </Label>
                    <Input
                      id="model"
                      placeholder="e.g., DHT22-PRO"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serial-number" className="text-sm text-muted-foreground">
                      Serial Number
                    </Label>
                    <Input
                      id="serial-number"
                      placeholder="e.g., SN123456789"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firmware-version" className="text-sm text-muted-foreground">
                      Firmware Version
                    </Label>
                    <Input
                      id="firmware-version"
                      placeholder="e.g., v1.2.3"
                      value={firmwareVersion}
                      onChange={(e) => setFirmwareVersion(e.target.value)}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border"></div>

              {/* Location Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Location Information (Optional)</h3>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-sm text-muted-foreground">
                      Location
                    </Label>
                    <Input
                      id="location"
                      placeholder="e.g., Building A, Floor 2, Room 203"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4"></div>

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddDevice}>
                  Add Device
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}