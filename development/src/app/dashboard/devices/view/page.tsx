'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, Trash2, Loader2, Activity, Calendar, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { edgeFunctions } from '@/lib/edge-functions'
import { useOrganization } from '@/contexts/OrganizationContext'
import { TransferDeviceDialog } from '@/components/devices/TransferDeviceDialog'
import { toast } from 'sonner'

interface Device {
  id: string
  name: string
  device_type: string
  type?: string
  model?: string
  serial_number?: string
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance'
  firmware_version?: string
  location_id?: string
  location?: string
  department_id?: string
  lastSeen: string
  last_seen?: string
  last_seen_online?: string
  last_seen_offline?: string
  batteryLevel?: number
  battery_level?: number
  signal_strength?: number
  isExternallyManaged?: boolean
  externalDeviceId?: string | null
  external_device_id?: string | null
  integration_id?: string | null
  integrationName?: string | null
  integrationType?: string | null
  description?: string
  metadata?: Record<string, unknown>
  hardware_ids?: string[]
  cohort_id?: string
  parent_device_id?: string | null
  is_gateway?: boolean
  organization_id: string
  created_at?: string
  updated_at?: string
}

export default function DeviceViewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deviceId = searchParams.get('id')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [device, setDevice] = useState<Device | null>(null)
  const [activeTab, setActiveTab] = useState('details')
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const { currentOrganization } = useOrganization()

  // Form state
  const [name, setName] = useState('')
  const [deviceType, setDeviceType] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [firmwareVersion, setFirmwareVersion] = useState('')
  const [locationId, setLocationId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState<'online' | 'offline' | 'warning' | 'error' | 'maintenance'>('offline')

  const loadDevice = useCallback(async () => {
    if (!deviceId) {
      toast.error('Device ID is required')
      router.push('/dashboard/devices')
      return
    }

    try {
      setLoading(true)
      const response = await edgeFunctions.devices.get(deviceId)
      
      if (!response.success || !response.data) {
        toast.error('Device not found')
        router.push('/dashboard/devices')
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseData = response.data as any // Use any to handle snake_case or camelCase from API
      console.log('Device data received:', JSON.stringify(responseData, null, 2))
      
      // Extract the device object (edge function wraps it in { device: {...} })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const deviceData = responseData.device || responseData as any
      
      // Map the data properly - the API might use different field names (snake_case vs camelCase)
      const mappedDevice: Device = {
        id: deviceData.id || '',
        name: deviceData.name || '',
        device_type: deviceData.device_type || deviceData.type || '',
        type: deviceData.type || deviceData.device_type || '',
        status: deviceData.status || 'offline',
        model: deviceData.model,
        serial_number: deviceData.serial_number,
        firmware_version: deviceData.firmware_version,
        location_id: deviceData.location_id,
        location: deviceData.location,
        department_id: deviceData.department_id,
        lastSeen: deviceData.lastSeen || deviceData.last_seen || new Date().toISOString(),
        batteryLevel: deviceData.batteryLevel ?? deviceData.battery_level,
        signal_strength: deviceData.signal_strength,
        isExternallyManaged: deviceData.isExternallyManaged ?? deviceData.is_externally_managed ?? false,
        externalDeviceId: deviceData.externalDeviceId ?? deviceData.external_device_id,
        integrationName: deviceData.integrationName ?? deviceData.integration_name,
        description: deviceData.description,
        metadata: deviceData.metadata,
        organization_id: deviceData.organization_id || '',
        created_at: deviceData.created_at,
        updated_at: deviceData.updated_at
      }
      
      console.log('Mapped device:', JSON.stringify(mappedDevice, null, 2))
      
      setDevice(mappedDevice)
      setName(mappedDevice.name || '')
      setDeviceType(mappedDevice.device_type || mappedDevice.type || '')
      setModel(mappedDevice.model || '')
      setSerialNumber(mappedDevice.serial_number || '')
      setFirmwareVersion(mappedDevice.firmware_version || '')
      setLocationId(mappedDevice.location_id || '')
      setDepartmentId(mappedDevice.department_id || '')
      setStatus(mappedDevice.status || 'offline')
    } catch (error) {
      console.error('Error loading device:', error)
      toast.error('Failed to load device')
      router.push('/dashboard/devices')
    } finally {
      setLoading(false)
    }
  }, [deviceId, router])

  const loadLocations = useCallback(async () => {
    if (!currentOrganization?.id) return

    try {
      const response = await edgeFunctions.locations.list(currentOrganization.id)
      if (response.success && response.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setLocations(response.data.map((loc: any) => ({ id: loc.id, name: loc.name })))
      }
    } catch (error) {
      console.error('Error loading locations:', error)
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    loadDevice()
    loadLocations()
  }, [loadDevice, loadLocations])

  const handleSave = async () => {
    if (!name.trim() || !deviceType.trim()) {
      toast.error('Name and type are required')
      return
    }

    if (!deviceId) return

    try {
      setSaving(true)
      const response = await edgeFunctions.devices.update(deviceId, {
        name: name.trim(),
        device_type: deviceType.trim(),
        model: model.trim() || undefined,
        serial_number: serialNumber.trim() || undefined,
        firmware_version: firmwareVersion.trim() || undefined,
        location_id: locationId || undefined,
        department_id: departmentId || undefined,
        status,
      })

      if (!response.success) {
        toast.error(response.error?.message || 'Failed to update device')
        return
      }

      toast.success('Device updated successfully')
      await loadDevice()
    } catch (error) {
      console.error('Error updating device:', error)
      toast.error('Failed to update device')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deviceId) return
    
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeleting(true)
      const response = await edgeFunctions.devices.delete(deviceId)

      if (!response.success) {
        toast.error(response.error?.message || 'Failed to delete device')
        return
      }

      toast.success('Device deleted successfully')
      router.push('/dashboard/devices')
    } catch (error) {
      console.error('Error deleting device:', error)
      toast.error('Failed to delete device')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  if (!device) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Device not found</p>
        <Button onClick={() => router.push('/dashboard/devices')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Devices
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={device.name}
        description={`${device.device_type || device.type || 'Unknown'} • ID: ${device.id?.substring(0, 8) || 'N/A'}`}
        icon={(() => {
          const typeName = device.device_type || device.type || ''
          const settings = currentOrganization?.settings as Record<string, unknown> | undefined
          const rawImages = (settings?.device_type_images as Record<string, string>) || {}
          const imgUrl = Object.entries(rawImages).find(
            ([k]) => k.toLowerCase() === typeName.toLowerCase()
          )?.[1]
          if (imgUrl) {
            return (
              <img
                src={imgUrl}
                alt={typeName}
                className="w-12 h-12 object-contain rounded-lg border bg-white p-1"
              />
            )
          }
          return undefined
        })()}
        action={
          <div className="flex items-center gap-2">
            {currentOrganization && (
              <TransferDeviceDialog
                device={{
                  id: device.id,
                  name: device.name,
                  device_type: device.device_type,
                  status: device.status,
                  organization_id: device.organization_id,
                }}
                currentOrgId={currentOrganization.id}
                onTransferComplete={() => router.push('/dashboard/devices')}
              />
            )}
            <Button
              variant="ghost"
              onClick={() => router.push('/dashboard/devices')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Devices
            </Button>
          </div>
        }
      />

      {/* Tabs for different sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          {device.metadata && Object.keys(device.metadata).length > 0 && (
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          )}
          <TabsTrigger value="info">System Info</TabsTrigger>
        </TabsList>

        {/* Details Tab - Read-only view */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
              <CardDescription>Comprehensive device details and specifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {device.name && (
                    <div>
                      <p className="text-sm text-muted-foreground">Device Name</p>
                      <p className="font-medium">{device.name}</p>
                    </div>
                  )}
                  {(device.device_type || device.type) && (
                    <div>
                      <p className="text-sm text-muted-foreground">Device Type</p>
                      <p className="font-medium">{device.device_type || device.type}</p>
                    </div>
                  )}
                  {device.model && (
                    <div>
                      <p className="text-sm text-muted-foreground">Model</p>
                      <p className="font-medium">{device.model}</p>
                    </div>
                  )}
                  {device.serial_number && (
                    <div>
                      <p className="text-sm text-muted-foreground">Serial Number</p>
                      <p className="font-mono text-sm">{device.serial_number}</p>
                    </div>
                  )}
                  {device.firmware_version && (
                    <div>
                      <p className="text-sm text-muted-foreground">Firmware Version</p>
                      <p className="font-medium">{device.firmware_version}</p>
                    </div>
                  )}
                  {device.location && (
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium">{device.location}</p>
                    </div>
                  )}
                  {device.cohort_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">Cohort ID</p>
                      <p className="font-mono text-sm">{device.cohort_id}</p>
                    </div>
                  )}
                  {device.hardware_ids && device.hardware_ids.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-muted-foreground">Hardware IDs</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {device.hardware_ids.map((id, idx) => (
                          <Badge key={idx} variant="outline" className="font-mono text-xs">
                            {id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Connection & Activity */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Connection & Activity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {device.status && (
                    <div>
                      <p className="text-sm text-muted-foreground">Current Status</p>
                      <Badge variant={device.status === 'online' ? 'default' : device.status === 'warning' ? 'secondary' : device.status === 'error' ? 'destructive' : 'outline'} className="mt-1">
                        {device.status.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                  {(device.last_seen || device.lastSeen) && (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Seen</p>
                      <p className="font-medium">
                        {device.last_seen 
                          ? new Date(device.last_seen).toLocaleString()
                          : new Date(device.lastSeen).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {device.last_seen_online && (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Seen Online</p>
                      <p className="font-medium">{new Date(device.last_seen_online).toLocaleString()}</p>
                    </div>
                  )}
                  {device.last_seen_offline && (
                    <div>
                      <p className="text-sm text-muted-foreground">Last Seen Offline</p>
                      <p className="font-medium">{new Date(device.last_seen_offline).toLocaleString()}</p>
                    </div>
                  )}
                  {(device.batteryLevel != null || device.battery_level != null) && (
                    <div>
                      <p className="text-sm text-muted-foreground">Battery Level</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-label={`Battery level ${device.batteryLevel ?? device.battery_level ?? 0}%`}>
                          <div 
                            className={`h-full transition-all ${
                              (device.batteryLevel ?? device.battery_level ?? 0) > 50 ? 'bg-green-500' : 
                              (device.batteryLevel ?? device.battery_level ?? 0) > 20 ? 'bg-yellow-500' : 
                              'bg-red-500'
                            }`}
                            style={{ width: `${device.batteryLevel ?? device.battery_level ?? 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{device.batteryLevel ?? device.battery_level}%</span>
                      </div>
                    </div>
                  )}
                  {device.signal_strength != null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Signal Strength</p>
                      <p className="font-medium">{device.signal_strength} dBm</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Integration Information */}
              {(device.isExternallyManaged || device.integration_id) && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Integration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {device.integrationName && (
                        <div>
                          <p className="text-sm text-muted-foreground">Integration Name</p>
                          <p className="font-medium">{device.integrationName}</p>
                        </div>
                      )}
                      {device.integrationType && (
                        <div>
                          <p className="text-sm text-muted-foreground">Integration Type</p>
                          <p className="font-medium">{device.integrationType}</p>
                        </div>
                      )}
                      {device.integration_id && (
                        <div>
                          <p className="text-sm text-muted-foreground">Integration ID</p>
                          <p className="font-mono text-xs">{device.integration_id}</p>
                        </div>
                      )}
                      {device.externalDeviceId && (
                        <div>
                          <p className="text-sm text-muted-foreground">External Device ID</p>
                          <p className="font-mono text-xs">{device.externalDeviceId}</p>
                        </div>
                      )}
                    </div>
                    {device.isExternallyManaged && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground flex items-start gap-2">
                          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          This device is managed by an external integration. Some fields may be read-only or synced automatically.
                        </p>
                      </div>
                    )}
                  </div>
                  <Separator />
                </>
              )}

              {device.description && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Description</h3>
                    <p className="text-sm text-muted-foreground">{device.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Tab - Editable form */}
        <TabsContent value="edit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Edit Device</CardTitle>
              <CardDescription>Update device information and configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Device Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter device name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Device Type *</Label>
                  <Input
                    id="type"
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    placeholder="e.g., Sensor, Gateway, Controller"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
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
                  <Input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Enter device model"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input
                    id="serialNumber"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Enter serial number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firmwareVersion">Firmware Version</Label>
                  <Input
                    id="firmwareVersion"
                    value={firmwareVersion}
                    onChange={(e) => setFirmwareVersion(e.target.value)}
                    placeholder="e.g., 1.0.0"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="location">Location</Label>
                  <Select value={locationId || undefined} onValueChange={(value) => setLocationId(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="No location assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {locationId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocationId('')}
                      className="h-8 text-xs"
                    >
                      Clear location
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex justify-between gap-4 pt-4">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={saving || deleting || device.isExternallyManaged}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Device
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={saving || deleting || !name.trim() || !deviceType.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>

              {device.isExternallyManaged && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      This device is managed by <strong>{device.integrationName || 'an external integration'}</strong>. 
                      Deletion is disabled. Device properties (except location) may be overwritten by the integration.
                    </span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metadata Tab */}
        {device.metadata && Object.keys(device.metadata).length > 0 && (
          <TabsContent value="metadata" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Device Metadata</CardTitle>
                <CardDescription>Additional device properties and custom fields</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
                    {JSON.stringify(device.metadata, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* System Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Internal identifiers and timestamps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Identifiers */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase">Primary Identifiers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Device ID</p>
                    <p className="font-mono text-sm break-all">{device.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Organization ID</p>
                    <p className="font-mono text-sm break-all">{device.organization_id}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Related Entity IDs */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase">Related Entities</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {device.location_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">Location ID</p>
                      <p className="font-mono text-sm break-all">{device.location_id}</p>
                    </div>
                  )}
                  {device.department_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">Department ID</p>
                      <p className="font-mono text-sm break-all">{device.department_id}</p>
                    </div>
                  )}
                  {device.integration_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">Integration ID</p>
                      <p className="font-mono text-sm break-all">{device.integration_id}</p>
                    </div>
                  )}
                  {device.external_device_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">External Device ID</p>
                      <p className="font-mono text-sm break-all">{device.external_device_id}</p>
                    </div>
                  )}
                  {device.cohort_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">Cohort ID</p>
                      <p className="font-mono text-sm">{device.cohort_id}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Timestamps */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase">Timestamps</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {device.created_at && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Created At
                      </p>
                      <p className="font-medium text-sm">{new Date(device.created_at).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{device.created_at}</p>
                    </div>
                  )}
                  {device.updated_at && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Updated At
                      </p>
                      <p className="font-medium text-sm">{new Date(device.updated_at).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{device.updated_at}</p>
                    </div>
                  )}
                  {device.last_seen && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Last Seen
                      </p>
                      <p className="font-medium text-sm">{new Date(device.last_seen).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{device.last_seen}</p>
                    </div>
                  )}
                  {device.last_seen_online && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Last Seen Online
                      </p>
                      <p className="font-medium text-sm">{new Date(device.last_seen_online).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{device.last_seen_online}</p>
                    </div>
                  )}
                  {device.last_seen_offline && (
                    <div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Last Seen Offline
                      </p>
                      <p className="font-medium text-sm">{new Date(device.last_seen_offline).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{device.last_seen_offline}</p>
                    </div>
                  )}
                </div>
              </div>

              {device.hardware_ids && device.hardware_ids.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase">Hardware Identifiers</h3>
                    <div className="flex flex-wrap gap-2">
                      {device.hardware_ids.map((id, idx) => (
                        <Badge key={idx} variant="outline" className="font-mono text-xs">
                          {id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
