'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { useDateFormatter } from '@/hooks/useDateFormatter'
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
import { Loader2, ArrowUpDown, Thermometer, Droplets, Activity, RefreshCw, ChevronLeft, ChevronRight, Download, Monitor, FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { TemperatureToggle } from '@/components/ui/temperature-toggle'
import { useExport } from '@/hooks/useExport'
import { format } from 'date-fns'
import { TestDeviceDialog } from './TestDeviceDialog'
import { TestDeviceControls } from './TestDeviceControls'

interface Device {
  id: string
  name: string
  device_type: string
  device_type_id?: string | null
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
  is_test_device?: boolean
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

interface TelemetryReading {
  device_id: string
  telemetry: {
    type?: number
    units?: number
    value?: number
    sensor?: string
    timestamp?: string
    [key: string]: unknown
  }
  device_timestamp: string | null
  received_at: string
}

interface DeviceTelemetry {
  [deviceId: string]: TelemetryReading[]
}

// Sensor type labels based on the type field from Golioth
const SENSOR_LABELS: Record<number, string> = {
  1: 'Temperature',
  2: 'Humidity',
  3: 'Pressure',
  4: 'CO₂',
  5: 'VOC',
  6: 'Light',
  7: 'Motion',
}

// Unit labels based on the units field 
const UNIT_LABELS: Record<number, string> = {
  1: '°C',
  2: '°F',
  3: '%',
  4: 'hPa',
  5: 'ppm',
  6: 'ppb',
  7: 'lux',
}

/**
 * Determine if a device is a gateway/cellular type (not an environmental sensor)
 */
function isGatewayDevice(deviceType: string, deviceName: string): boolean {
  const type = deviceType.toLowerCase()
  const name = deviceName.toLowerCase()
  
  return (
    type.includes('gateway') ||
    type.includes('cellular') ||
    type.includes('nrf9151') ||
    type.includes('nrf9160') ||
    type.includes('router') ||
    type.includes('hub') ||
    name.includes('gateway') ||
    name.includes('cellular')
  )
}

function getSensorIcon(sensorType?: number, sensorName?: string) {
  const name = sensorName?.toLowerCase() || ''
  if (sensorType === 1 || name.includes('tmp') || name.includes('temp')) return Thermometer
  if (sensorType === 2 || name.includes('hum') || name.includes('sht')) return Droplets
  return Activity
}

function formatSensorValue(telemetry: TelemetryReading['telemetry'], useFahrenheit: boolean = false): string {
  if (telemetry.value == null) return 'N/A'
  let value = Number(telemetry.value)
  let unit = telemetry.units != null ? UNIT_LABELS[telemetry.units] || '' : ''
  
  // Convert temperature if needed
  const isTemperature = telemetry.type === 1 || unit === '°C' || unit === '°F'
  if (isTemperature && useFahrenheit && unit === '°C') {
    value = (value * 9/5) + 32
    unit = '°F'
  } else if (isTemperature && !useFahrenheit && unit === '°F') {
    value = (value - 32) * 5/9
    unit = '°C'
  }
  
  return `${value.toFixed(1)}${unit}`
}

export function DevicesList() {
  const { currentOrganization } = useOrganization()
  const router = useRouter()
  const { fmt } = useDateFormatter()
  const { exportToCSV, isExporting, progress } = useExport()
  const [devices, setDevices] = useState<Device[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [useFahrenheit, setUseFahrenheit] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('temperatureUnit')
      return stored ? stored === 'F' : true // Default: Fahrenheit
    }
    return true
  })
  
  // Filter and Sort states
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterLocation, setFilterLocation] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('status') // Changed from 'name' to 'status' for Issue #103
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [latestTelemetry, setLatestTelemetry] = useState<DeviceTelemetry>({})
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  
  // Refresh states
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  
  // Test device states
  const [testDeviceDialogOpen, setTestDeviceDialogOpen] = useState(false)

  const fetchDevices = useCallback(async (isManualRefresh = false) => {
    if (!currentOrganization) {
      setDevices([])
      setLoading(false)
      return
    }

    try {
      if (isManualRefresh) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      
      // Use edge function client SDK
      const response = await edgeFunctions.devices.list(currentOrganization.id)
      
      if (!response.success) {
        setError(response.error?.message || 'Failed to fetch devices')
        setDevices([])
        setLoading(false)
        setIsRefreshing(false)
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
      setIsRefreshing(false)
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

  // Fetch latest telemetry reading for each device (including multiple sensor types)
  const fetchLatestTelemetry = useCallback(async (deviceIds: string[]) => {
    if (!currentOrganization || deviceIds.length === 0) return

    try {
      const supabase = createClient()
      
      // Fetch recent telemetry for each device to capture multiple sensor types
      // Multi-sensor devices report different sensor types (temp, humidity, etc.)
      const { data, error: telError } = await supabase
        .from('device_telemetry_history')
        .select('device_id, telemetry, device_timestamp, received_at')
        .eq('organization_id', currentOrganization.id)
        .in('device_id', deviceIds)
        .order('received_at', { ascending: false })
        .limit(deviceIds.length * 10) // Get multiple readings to capture different sensor types

      if (telError) {
        console.error('[DevicesList] Error fetching telemetry:', telError)
        return
      }

      if (data && data.length > 0) {
        // Group by device_id and keep latest reading for each unique sensor type
        const grouped: DeviceTelemetry = {}
        for (const row of data) {
          const reading = row as TelemetryReading
          if (!grouped[row.device_id]) {
            grouped[row.device_id] = []
          }
          
          // Check if we already have this sensor type for this device
          const sensorKey = reading.telemetry.type != null 
            ? `type_${reading.telemetry.type}` 
            : reading.telemetry.sensor || 'unknown'
          
          const hasSensorType = grouped[row.device_id]!.some(r => {
            const existingKey = r.telemetry.type != null 
              ? `type_${r.telemetry.type}` 
              : r.telemetry.sensor || 'unknown'
            return existingKey === sensorKey
          })
          
          if (!hasSensorType) {
            grouped[row.device_id]!.push(reading)
          }
        }
        setLatestTelemetry(grouped)
        const totalReadings = Object.values(grouped).reduce((sum, readings) => sum + readings.length, 0)
        console.log(`[DevicesList] Loaded ${totalReadings} sensor readings across ${Object.keys(grouped).length} devices`)
      }
    } catch (err) {
      console.error('[DevicesList] Error fetching telemetry:', err)
    }
  }, [currentOrganization])

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setLastRefresh(new Date())
    await fetchDevices(true)
  }, [fetchDevices])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const intervalId = setInterval(() => {
      handleRefresh()
    }, 30000) // 30 seconds

    return () => clearInterval(intervalId)
  }, [autoRefresh, handleRefresh])

  // Listen for device-added events from AddDeviceDialog
  useEffect(() => {
    const handleDeviceAdded = () => {
      handleRefresh()
    }

    window.addEventListener('device-added', handleDeviceAdded)
    return () => window.removeEventListener('device-added', handleDeviceAdded)
  }, [handleRefresh])

  useEffect(() => {
    fetchDevices()
    fetchLocations()
  }, [fetchDevices, fetchLocations])

  // Fetch telemetry once devices are loaded
  useEffect(() => {
    if (devices.length > 0) {
      const deviceIds = devices.map(d => d.id)
      fetchLatestTelemetry(deviceIds)
    }
  }, [devices, fetchLatestTelemetry])

  // Compute unique device types for filter
  const deviceTypes = useMemo(() => {
    const types = new Set(devices.map(d => d.device_type || d.type || 'unknown'))
    return Array.from(types).sort()
  }, [devices])

  // Device type images from organization settings (case-insensitive lookup map)
  const deviceTypeImages = useMemo<Record<string, string>>(() => {
    const settings = currentOrganization?.settings as Record<string, unknown> | undefined
    const raw = (settings?.device_type_images as Record<string, string>) || {}
    // Build a lowercase-keyed map so lookups are case-insensitive
    const map: Record<string, string> = {}
    for (const [key, url] of Object.entries(raw)) {
      map[key.toLowerCase()] = url
    }
    return map
  }, [currentOrganization])

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
        case 'battery':
          aVal = a.batteryLevel ?? -1
          bVal = b.batteryLevel ?? -1
          break
        case 'firmware':
          aVal = a.firmware_version?.toLowerCase() || ''
          bVal = b.firmware_version?.toLowerCase() || ''
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
  
  // Pagination
  const totalPages = Math.ceil(filteredAndSortedDevices.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedDevices = filteredAndSortedDevices.slice(startIndex, endIndex)
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [filterStatus, filterType, filterLocation, sortBy, sortOrder])

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
                  <SelectItem value="battery">Battery</SelectItem>
                  <SelectItem value="firmware">Firmware</SelectItem>
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

          {/* Pagination Controls and Actions */}
          <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedDevices.length)} of {filteredAndSortedDevices.length} devices
                {totalPages > 1 && ` • Page ${currentPage} of ${totalPages}`}
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                variant="default"
                size="sm"
                onClick={() => setTestDeviceDialogOpen(true)}
              >
                <FlaskConical className="h-4 w-4 mr-2" />
                Create Test Device
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportToCSV({
                    filename: 'devices-status-report',
                    headers: [
                      'Device Name',
                      'Type',
                      'Model',
                      'Serial Number',
                      'Status',
                      'Last Seen',
                      'Battery Level',
                      'Signal Strength',
                      'Firmware Version',
                      'Location',
                      'Integration',
                      'External ID'
                    ],
                    data: filteredAndSortedDevices,
                    transformRow: (device: Device) => [
                      device.name,
                      device.device_type,
                      device.model || '',
                      device.serial_number || '',
                      device.status,
                      device.lastSeen ? format(new Date(device.lastSeen), 'yyyy-MM-dd HH:mm:ss') : '',
                      device.batteryLevel ? `${device.batteryLevel}%` : '',
                      device.signal_strength ? `${device.signal_strength} dBm` : '',
                      device.firmware_version || '',
                      locations.find(l => l.id === device.location_id)?.name || '',
                      device.integrationName || '',
                      device.externalDeviceId || ''
                    ]
                  })
                }}
                disabled={isExporting || filteredAndSortedDevices.length === 0}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isExporting ? `Exporting... ${progress.progress}%` : 'Export CSV'}
              </Button>
              <div className="flex items-center gap-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
                  Auto-refresh (30s)
                </Label>
              </div>
              <TemperatureToggle
                useFahrenheit={useFahrenheit}
                onToggle={(value) => {
                  setUseFahrenheit(value)
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('temperatureUnit', value ? 'F' : 'C')
                  }
                }}
              />
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
          </div>
        </CardContent>
      </Card>
      
      {/* Pagination Navigation */}
      {totalPages > 1 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {paginatedDevices.map((device) => (
          <Card key={device.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{device.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getStatusIcon(device.status)}</span>
                  {device.is_test_device && (
                    <Badge className="text-xs bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30 gap-1">
                      <FlaskConical className="h-3 w-3" />
                      Active Test Sensor
                    </Badge>
                  )}
                  {device.isExternallyManaged && (
                    <span className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full border border-blue-500/20">
                      {device.integrationName || 'External'}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {(() => {
                  const typeName = device.device_type || device.type || ''
                  const imgUrl = deviceTypeImages[typeName.toLowerCase()]
                  if (imgUrl) {
                    return (
                      <img
                        src={imgUrl}
                        alt={typeName}
                        className="w-5 h-5 object-contain rounded-sm inline-block"
                      />
                    )
                  }
                  return <Monitor className="w-4 h-4 text-muted-foreground/60" />
                })()}
                {device.type}
                {device.device_type_id && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30">
                    Configured
                  </Badge>
                )}
              </p>
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
                {device.signal_strength != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Signal:</span>
                    <span className="text-foreground">{device.signal_strength} dBm</span>
                  </div>
                )}
                {device.firmware_version && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Firmware:</span>
                    <span className="text-foreground">{device.firmware_version}</span>
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
                {/* Latest Telemetry Readings (All Sensor Types) */}
                {(() => {
                  const readings = latestTelemetry[device.id]
                  if (!readings || readings.length === 0) return null
                  
                  // Find the most recent timestamp across all sensor readings
                  const mostRecentTimestamp = readings.reduce((latest, r) => {
                    const timestamp = r.device_timestamp || r.received_at
                    return !latest || new Date(timestamp) > new Date(latest) ? timestamp : latest
                  }, '')
                  const timeAgo = fmt.timeAgo(mostRecentTimestamp)
                  
                  return (
                    <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                      {readings.map((tel, idx) => {
                        const SensorIcon = getSensorIcon(tel.telemetry.type as number | undefined, tel.telemetry.sensor as string | undefined)
                        const sensorLabel = tel.telemetry.type != null 
                          ? SENSOR_LABELS[tel.telemetry.type as number] || tel.telemetry.sensor 
                          : tel.telemetry.sensor || 'Sensor'
                        
                        return (
                          <div key={idx} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-sm">
                              <SensorIcon className="h-4 w-4 text-blue-500" />
                              <span className="text-muted-foreground">{sensorLabel}:</span>
                            </div>
                            <span className="text-sm font-semibold text-foreground">
                              {formatSensorValue(tel.telemetry, useFahrenheit)}
                            </span>
                          </div>
                        )
                      })}
                      {timeAgo && (
                        <div className="text-xs text-muted-foreground text-right pt-0.5">
                          Last updated {timeAgo}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              
              {/* Test Device Controls - Only shown for test devices */}
              {device.is_test_device && (
                <div className="mt-3">
                  <TestDeviceControls
                    deviceId={device.id}
                    deviceTypeId={device.device_type_id || null}
                    currentStatus={device.status}
                    onDataSent={() => fetchDevices(true)}
                  />
                </div>
              )}
              
              <div className="flex space-x-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => openDeviceDetailsPage(device.id)}
                >
                  Details
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="flex-1"
                  onClick={() => router.push(`/dashboard/device-details?id=${device.id}`)}
                >
                  {isGatewayDevice(device.device_type, device.name) 
                    ? 'Gateway Data' 
                    : 'Sensor Data'}
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
            <Button onClick={() => fetchDevices()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Test Device Creation Dialog */}
      <TestDeviceDialog
        open={testDeviceDialogOpen}
        onOpenChange={setTestDeviceDialogOpen}
        onSuccess={() => fetchDevices(true)}
      />
      
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