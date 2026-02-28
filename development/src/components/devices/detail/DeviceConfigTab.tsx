'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DeviceTypeSelector } from '@/components/device-types/DeviceTypeSelector'
import { Save, Trash2, Loader2, Network, Info } from 'lucide-react'
import type { Device } from '@/types/sensor-details'

interface DeviceConfigTabProps {
  device: Device
  locations: Array<{ id: string; name: string }>
  saving: boolean
  deleting: boolean
  onSave: (updates: Record<string, unknown>) => void
  onDelete: () => void
}

export function DeviceConfigTab({
  device,
  locations,
  saving,
  deleting,
  onSave,
  onDelete,
}: DeviceConfigTabProps) {
  const [name, setName] = useState(device.name || '')
  const [deviceType, setDeviceType] = useState(device.device_type || '')
  const [deviceTypeId, setDeviceTypeId] = useState<string | null>(device.device_type_id || null)
  const [model, setModel] = useState(device.model || '')
  const [serialNumber, setSerialNumber] = useState(device.serial_number || '')
  const [firmwareVersion, setFirmwareVersion] = useState(device.firmware_version || '')
  const [isGateway, setIsGateway] = useState(device.is_gateway || device.metadata?.is_gateway === true)
  const [locationId, setLocationId] = useState(device.location_id || '')
  const [status, setStatus] = useState<Device['status']>(device.status || 'offline')

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      device_type: isGateway ? 'gateway' : deviceType.trim(),
      device_type_id: isGateway ? null : deviceTypeId,
      model: model.trim() || undefined,
      serial_number: serialNumber.trim() || undefined,
      firmware_version: firmwareVersion.trim() || undefined,
      location_id: locationId || undefined,
      status,
      metadata: { ...(device.metadata || {}), is_gateway: isGateway },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Device</CardTitle>
        <CardDescription>Update device information and configuration</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Device Name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter device name" />
          </div>

          {/* Gateway Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="edit-is-gateway" className="cursor-pointer font-medium">Gateway Device</Label>
                <p className="text-xs text-muted-foreground">Hub that relays data from child sensors</p>
              </div>
            </div>
            <Switch id="edit-is-gateway" checked={!!isGateway} onCheckedChange={setIsGateway} disabled={saving || deleting} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Device Type *</Label>
            <DeviceTypeSelector
              value={deviceTypeId}
              onValueChange={(typeId, dt) => {
                setDeviceTypeId(typeId)
                if (dt) setDeviceType(dt.name)
                else if (!typeId) setDeviceType('')
              }}
              allowNone={true}
              placeholder="Select or assign a device type..."
            />
            {!deviceTypeId && deviceType && (
              <p className="text-xs text-muted-foreground">Legacy type: {deviceType}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as Device['status'])}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label="Device status"
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Enter device model" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input id="serialNumber" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Enter serial number" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="firmwareVersion">Firmware Version</Label>
            <Input id="firmwareVersion" value={firmwareVersion} onChange={(e) => setFirmwareVersion(e.target.value)} placeholder="e.g., 1.0.0" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="location">Location</Label>
            <Select value={locationId || '__none__'} onValueChange={(v) => setLocationId(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="No location assigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No location</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {locationId && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setLocationId('')} className="h-8 text-xs">
                Clear location
              </Button>
            )}
          </div>
        </div>

        <div className="flex justify-between gap-4 pt-4">
          <Button variant="destructive" onClick={onDelete} disabled={saving || deleting || !!device.is_externally_managed}>
            {deleting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>) : (<><Trash2 className="mr-2 h-4 w-4" />Delete Device</>)}
          </Button>
          <Button onClick={handleSave} disabled={saving || deleting || !name.trim()}>
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save Changes</>)}
          </Button>
        </div>

        {device.is_externally_managed && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
            <p className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-200">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>
                This device is managed by <strong>{device.integration_name || 'an external integration'}</strong>.
                Deletion is disabled. Device properties (except location) may be overwritten by the integration.
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
