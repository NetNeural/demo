'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { useRouter } from 'next/navigation'
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
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowUpDown } from 'lucide-react'
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

interface Location {
  id: string
  name: string
  description?: string
  city?: string
  state?: string
}

export function DevicesList() {
  const router = useRouter()
  const [devices, setDevices] = useState<Device[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null)
  const [deleting, setDeleting] = useState(false)
  
  // Filter and Sort states
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterLocation, setFilterLocation] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('status') // Changed from 'name' to 'status' for Issue #103
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
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
      
      // Use edge function client SDK
      const response = await edgeFunctions.devices.list(currentOrganization.id)
      
      if (!response.success) {
        setError(response.error?.message || 'Failed to fetch devices')
        setDevices([])
        setLoading(false)
        return
      }
      
      setDevices((response.data?.devices as Device[]) || [])
      
    } catch (err) {
      console.error('Error fetching devices:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch devices')
      // Show empty state on error instead of mock data
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  const fetchLocations = useCallback(async () => {
    if (!currentOrganization) {
      setLocations([])
      return
    }

    try {
      console.log('[DevicesList] Fetching locations for org:', currentOrganization.id)
      const response = await edgeFunctions.locations.list(currentOrganization.id)
      console.log('[DevicesList] Locations response:', response)
      if (response.success) {
        // The locations endpoint returns data directly as an array, not wrapped in {locations: [...]}
        const locationsData = Array.isArray(response.data) ? response.data : []
        console.log('[DevicesList] Locations data:', locationsData)
        setLocations(locationsData as Location[])
      } else {
        console.error('[DevicesList] Failed to fetch locations:', response.error)
      }
    } catch (err) {
      console.error('[DevicesList] Error fetching locations:', err)
    }
  }, [currentOrganization])

  useEffect(() => {
    fetchDevices()
    fetchLocations()
  }, [fetchDevices, fetchLocations])

  // Compute unique device types for filter
  const deviceTypes = useMemo(() => {
    const types = new Set(devices.map(d => d.device_type || d.type || 'unknown'))
    return Array.from(types).sort()
  }, [devices])

  // Filter and sort devices
  const filteredAndSortedDevices = useMemo(() => {
    let filtered = [...devices]

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(d => d.status === filterStatus)
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(d => (d.device_type || d.type) === filterType)
    }

    // Apply location filter
    if (filterLocation !== 'all') {
      if (filterLocation === 'none') {
        filtered = filtered.filter(d => !d.location_id)
      } else {
        filtered = filtered.filter(d => d.location_id === filterLocation)
      }
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortBy) {
        case 'name':
          aVal = a.name?.toLowerCase() || ''
          bVal = b.name?.toLowerCase() || ''
          break
        case 'type':
          aVal = (a.device_type || a.type || '')?.toLowerCase()
          bVal = (b.device_type || b.type || '')?.toLowerCase()
          break
        case 'status':
          // Issue #103: Sort by status priority (online first, then warning, error, offline, maintenance)
          const statusPriority: Record<string, number> = {
            online: 1,
            warning: 2,
            error: 3,
            offline: 4,
            maintenance: 5
          }
          aVal = statusPriority[a.status] || 999
          bVal = statusPriority[b.status] || 999
          break
        case 'lastSeen':
          aVal = new Date(a.lastSeen || 0).getTime()
          bVal = new Date(b.lastSeen || 0).getTime()
          break
        default:
          return 0
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [devices, filterStatus, filterType, filterLocation, sortBy, sortOrder])

  const openDeviceDetailsPage = (deviceId: string) => {
    router.push(`/dashboard/devices/view?id=${deviceId}`)
  }

  const handleDeleteDevice = async (device: Device) => {
    setDeletingDevice(device)
    setShowDeleteDialog(true)
  }

  const confirmDeleteDevice = async () => {
    if (!deletingDevice) return

    try {
      setDeleting(true)

      const response = await edgeFunctions.call(
        `devices/${deletingDevice.id}`,
        {
          method: 'DELETE',
          body: {
            organization_id: currentOrganization?.id
          }
        }
      )

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to delete device')
      }

      toast.success('Device deleted successfully')
      setShowDeleteDialog(false)
      setDeletingDevice(null)
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
      
      {/* Filter and Sort Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-status">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-type">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger id="filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {deviceTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <Label htmlFor="filter-location">Location</Label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger id="filter-location">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="none">No Location</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name} {loc.city ? `(${loc.city})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort By */}
            <div className="space-y-2">
              <Label htmlFor="sort-by">Sort By</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger id="sort-by">
                  <SelectValue placeholder="Name" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="type">Type</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="lastSeen">Last Seen</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order */}
            <div className="space-y-2">
              <Label htmlFor="sort-order">Order</Label>
              <Button
                id="sort-order"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Clear Filters */}
          <div className="mt-4 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              Showing {filteredAndSortedDevices.length} of {devices.length} devices
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterStatus('all')
                setFilterType('all')
                setFilterLocation('all')
                setSortBy('name')
                setSortOrder('asc')
              }}
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {filteredAndSortedDevices.map((device) => (
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
                  onClick={() => openDeviceDetailsPage(device.id)}
                >
                  View Details
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => router.push(`/dashboard/sensors/${device.id}`)}
                >
                  View Sensors
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