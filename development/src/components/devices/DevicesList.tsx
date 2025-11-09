'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { handleApiError } from '@/lib/api-error-handler'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Device {
  id: string
  name: string
  device_type: string
  model?: string
  serial_number?: string
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance'
  firmware_version?: string
  location_id?: string
  department_id?: string
  lastSeen: string
  batteryLevel?: number
  signal_strength?: number
  isExternallyManaged?: boolean
  externalDeviceId?: string | null
  integrationName?: string | null
  // For display purposes
  type?: string
  location?: string
}

export function DevicesList() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editModel, setEditModel] = useState('')
  const [editSerialNumber, setEditSerialNumber] = useState('')
  const [editFirmwareVersion, setEditFirmwareVersion] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { currentOrganization } = useOrganization()

  const fetchDevices = useCallback(async () => {
    if (!currentOrganization) {
      setDevices([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // Get authenticated user's session
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session. Please log in.')
      }
      
      // Filter by current organization
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices?organization_id=${currentOrganization.id}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const errorResult = handleApiError(response, {
        errorPrefix: 'Failed to fetch devices',
        throwOnError: false,
      })

      if (errorResult.isAuthError) {
        setError('Not authenticated. Please log in.')
        setDevices([])
        setLoading(false)
        return
      }

      if (!response.ok) {
        setError('Failed to fetch devices')
        setDevices([])
        setLoading(false)
        return
      }
      
      const data = await response.json();
      setDevices(data.devices || [])
      
    } catch (err) {
      console.error('Error fetching devices:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch devices')
      // Show empty state on error instead of mock data
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  const handleEditDevice = async () => {
    if (!selectedDevice || !currentOrganization) return

    try {
      setSaving(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        toast.error('Not authenticated. Please log in.')
        return
      }

      console.log('[Device Edit] Starting update for device:', selectedDevice.id)
      console.log('[Device Edit] Update payload:', {
        organization_id: currentOrganization.id,
        name: editName,
        device_type: editType,
        model: editModel || null,
        serial_number: editSerialNumber || null,
        firmware_version: editFirmwareVersion || null,
        location: editLocation
      })

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices/${selectedDevice.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organization_id: currentOrganization.id,
            name: editName,
            device_type: editType,
            model: editModel || null,
            serial_number: editSerialNumber || null,
            firmware_version: editFirmwareVersion || null,
            location: editLocation
          })
        }
      )

      console.log('[Device Edit] Response status:', response.status, response.statusText)

      if (!response.ok) {
        const error = await response.json()
        console.error('[Device Edit] Update failed:', error)
        throw new Error(error.error || 'Failed to update device')
      }

      const result = await response.json()
      console.log('[Device Edit] Update successful:', result)

      toast.success('Device updated successfully')
      setEditOpen(false)
      setDetailsOpen(false)
      fetchDevices()
    } catch (err) {
      console.error('Error updating device:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to update device')
    } finally {
      setSaving(false)
    }
  }

  const openEditDialog = (device: Device) => {
    setEditName(device.name)
    setEditType(device.device_type || device.type || '')
    setEditModel(device.model || '')
    setEditSerialNumber(device.serial_number || '')
    setEditFirmwareVersion(device.firmware_version || '')
    setEditLocation(device.location || '')
    setEditOpen(true)
  }

  const handleDeleteDevice = async (device: Device) => {
    setDeletingDevice(device)
    setShowDeleteDialog(true)
  }

  const confirmDeleteDevice = async () => {
    if (!deletingDevice) return

    try {
      setDeleting(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        toast.error('Not authenticated. Please log in.')
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices/${deletingDevice.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organization_id: currentOrganization?.id
          })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete device')
      }

      toast.success('Device deleted successfully')
      setShowDeleteDialog(false)
      setDeletingDevice(null)
      setDetailsOpen(false)
      fetchDevices()
    } catch (err) {
      console.error('Error deleting device:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to delete device')
    } finally {
      setDeleting(false)
    }
  }

  const getStatusIcon = (status: Device['status']) => {
    switch (status) {
      case 'online': return '🟢'
      case 'warning': return '🟡'
      case 'error': return '🔴'
      case 'offline': return '⚫'
      default: return '❓'
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-yellow-500/50 bg-yellow-500/10 dark:border-yellow-500/50 dark:bg-yellow-500/10">
          <CardContent className="pt-6">
            <p className="text-yellow-900 dark:text-yellow-200">
              ⚠️ {error} - Showing cached data
            </p>
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {devices.map((device) => (
          <Card key={device.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{device.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getStatusIcon(device.status)}</span>
                  {device.isExternallyManaged && (
                    <span className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full border border-blue-500/20">
                      {device.integrationName || 'External'}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{device.type}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="text-foreground">{device.location}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Seen:</span>
                  <span className="text-foreground">{device.lastSeen}</span>
                </div>
                {device.batteryLevel != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Battery:</span>
                    <span className="text-foreground">{device.batteryLevel}%</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Management:</span>
                  <span className={device.isExternallyManaged ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}>
                    {device.isExternallyManaged ? 'External' : 'Local'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`font-medium ${
                    device.status === 'online' ? 'text-green-600 dark:text-green-400' :
                    device.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                    device.status === 'error' ? 'text-red-600 dark:text-red-400' :
                    'text-muted-foreground'
                  }`}>
                    {device.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => {
                    setSelectedDevice(device)
                    setDetailsOpen(true)
                  }}
                >
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {devices.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">No devices found</p>
            <Button onClick={fetchDevices}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Device Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Device Details</DialogTitle>
            <DialogDescription>
              Comprehensive information about {selectedDevice?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Device Name</p>
                    <p className="font-medium text-foreground">{selectedDevice.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Device ID</p>
                    <p className="font-mono text-sm text-foreground">{selectedDevice.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium text-foreground">{selectedDevice.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium text-foreground">{selectedDevice.location}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4"></div>

              {/* Status Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Status</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Status</p>
                    <Badge 
                      variant={
                        selectedDevice.status === 'online' ? 'default' :
                        selectedDevice.status === 'warning' ? 'secondary' :
                        selectedDevice.status === 'error' ? 'destructive' :
                        'outline'
                      }
                      className="mt-1"
                    >
                      {selectedDevice.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Seen</p>
                    <p className="font-medium text-foreground">
                      {new Date(selectedDevice.lastSeen).toLocaleString()}
                    </p>
                  </div>
                  {selectedDevice.batteryLevel != null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Battery Level</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              selectedDevice.batteryLevel > 50 ? 'bg-green-500' :
                              selectedDevice.batteryLevel > 20 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${selectedDevice.batteryLevel}%` } as React.CSSProperties}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground">{selectedDevice.batteryLevel}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Integration Information */}
              {selectedDevice.isExternallyManaged && (
                <>
                  <div className="border-t border-border pt-4"></div>
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Integration Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Managed By</p>
                        <Badge variant="outline" className="mt-1">
                          {selectedDevice.integrationName || 'External Integration'}
                        </Badge>
                      </div>
                      {selectedDevice.externalDeviceId && (
                        <div>
                          <p className="text-sm text-muted-foreground">External Device ID</p>
                          <p className="font-mono text-sm text-foreground">{selectedDevice.externalDeviceId}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="border-t border-border pt-4"></div>

              {/* Actions */}
              <div className="flex justify-between gap-2">
                <Button 
                  variant="destructive"
                  onClick={() => handleDeleteDevice(selectedDevice)}
                >
                  Delete Device
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setDetailsOpen(false)}>
                    Close
                  </Button>
                  <Button 
                    onClick={() => {
                      openEditDialog(selectedDevice)
                      setDetailsOpen(false)
                    }}
                  >
                    Edit Device
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Device Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Device</DialogTitle>
            <DialogDescription>
              Update device information for {selectedDevice?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-device-name" className="text-sm text-muted-foreground">
                    Device Name *
                  </Label>
                  <Input
                    id="edit-device-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="font-medium"
                    placeholder="e.g., Office Sensor 1"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-device-type" className="text-sm text-muted-foreground">
                    Device Type *
                  </Label>
                  <Input
                    id="edit-device-type"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="font-medium"
                    placeholder="e.g., Temperature Sensor"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border"></div>

            {/* Hardware Details */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Hardware Details</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-device-model" className="text-sm text-muted-foreground">
                    Model
                  </Label>
                  <Input
                    id="edit-device-model"
                    value={editModel}
                    onChange={(e) => setEditModel(e.target.value)}
                    className="font-medium"
                    placeholder="e.g., DHT22-PRO"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-serial-number" className="text-sm text-muted-foreground">
                    Serial Number
                  </Label>
                  <Input
                    id="edit-serial-number"
                    value={editSerialNumber}
                    onChange={(e) => setEditSerialNumber(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="e.g., SN123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-firmware-version" className="text-sm text-muted-foreground">
                    Firmware Version
                  </Label>
                  <Input
                    id="edit-firmware-version"
                    value={editFirmwareVersion}
                    onChange={(e) => setEditFirmwareVersion(e.target.value)}
                    className="font-mono text-sm"
                    placeholder="e.g., v1.2.3"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border"></div>

            {/* Location Information */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Location Information</h3>
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-device-location" className="text-sm text-muted-foreground">
                    Location
                  </Label>
                  <Input
                    id="edit-device-location"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="font-medium"
                    placeholder="e.g., Building A, Floor 2, Room 203"
                  />
                </div>
              </div>
            </div>

            {selectedDevice?.isExternallyManaged && (
              <>
                <div className="border-t border-border"></div>
                <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</div>
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                        Externally Managed Device
                      </p>
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        This device is managed by <strong>{selectedDevice.integrationName}</strong>. 
                        Changes to basic information will be synced, but hardware-specific details 
                        may be overridden during the next sync.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-border pt-4"></div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleEditDevice} disabled={saving || !editName.trim() || !editType.trim()}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deletingDevice?.name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteDevice}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}