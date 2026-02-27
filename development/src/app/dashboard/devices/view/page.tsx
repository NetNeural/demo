'use client'

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { edgeFunctions } from '@/lib/edge-functions'
import { createClient } from '@/lib/supabase/client'
import { testTelemetryFrom } from '@/lib/supabase/test-telemetry'
import { useOrganization } from '@/contexts/OrganizationContext'
import { TransferDeviceDialog } from '@/components/devices/TransferDeviceDialog'
import { mapDeviceData, isGatewayDevice, isTestDevice, normalizeTelemetryReadings } from '@/lib/device-utils'
import { DeviceOverviewTab } from '@/components/devices/detail/DeviceOverviewTab'
import { DeviceTelemetryTab } from '@/components/devices/detail/DeviceTelemetryTab'
import { DeviceConfigTab } from '@/components/devices/detail/DeviceConfigTab'
import { DeviceAlertsTab } from '@/components/devices/detail/DeviceAlertsTab'
import { DeviceSystemInfoTab } from '@/components/devices/detail/DeviceSystemInfoTab'
import type { Device, TelemetryReading } from '@/types/sensor-details'
import { toast } from 'sonner'

// Story #270: Consolidated device detail page
// Replaces both /dashboard/devices/view and /dashboard/device-details

export default function DeviceViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DeviceViewContent />
    </Suspense>
  )
}

function DeviceViewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const deviceId = searchParams.get('id')
  const { currentOrganization } = useOrganization()

  // Core state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [device, setDevice] = useState<Device | null>(null)
  const [telemetryReadings, setTelemetryReadings] = useState<TelemetryReading[]>([])
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([])
  const [temperatureUnit, setTemperatureUnit] = useState<'celsius' | 'fahrenheit'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('temperatureUnit')
      if (stored === 'C') return 'celsius'
    }
    return 'fahrenheit'
  })

  // Tab routing via URL
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview')

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) setActiveTab(tabParam)
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  // Derived state
  const isGateway = useMemo(() => (device ? isGatewayDevice(device) : false), [device])
  const testDevice = useMemo(() => (device ? isTestDevice(device) : false), [device])

  // -- Data Loading --

  const loadDevice = useCallback(async () => {
    if (!deviceId) {
      toast.error('Device ID is required')
      router.push('/dashboard/devices')
      return
    }

    try {
      setLoading(true)

      // Fetch device via edge function
      const response = await edgeFunctions.devices.get(deviceId)
      if (!response.success || !response.data) {
        toast.error('Device not found')
        router.push('/dashboard/devices')
        return
      }

      const mapped = mapDeviceData(response.data as Record<string, unknown>)
      setDevice(mapped)

      // Fetch telemetry readings (48 hours from both primary + test tables)
      const supabase = createClient()
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

      const [primaryResult, testResult] = await Promise.all([
        supabase
          .from('device_telemetry_history')
          .select('device_id, telemetry, device_timestamp, received_at')
          .eq('device_id', deviceId)
          .gte('received_at', fortyEightHoursAgo)
          .order('received_at', { ascending: false })
          .limit(500),
        mapped.is_test_device
          ? testTelemetryFrom(supabase)
              .select('device_id, telemetry, device_timestamp, received_at')
              .eq('device_id', deviceId)
              .gte('received_at', fortyEightHoursAgo)
              .order('received_at', { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [], error: null }),
      ])

      if (primaryResult.error) throw primaryResult.error
      if (testResult.error) throw testResult.error

      const combined = (
        [...(primaryResult.data || []), ...((testResult.data as TelemetryReading[] | null) || [])] as TelemetryReading[]
      )
        .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
        .slice(0, 500)

      setTelemetryReadings(normalizeTelemetryReadings(combined))

      // Fetch temperature unit preference from thresholds
      const { data: thresholds } = await supabase
        .from('sensor_thresholds')
        .select('temperature_unit')
        .eq('device_id', deviceId)
        .limit(1)

      const firstThreshold = (thresholds as Array<{ temperature_unit?: string }> | null)?.[0]
      if (firstThreshold?.temperature_unit) {
        setTemperatureUnit(firstThreshold.temperature_unit as 'celsius' | 'fahrenheit')
      }
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

  // -- CRUD Handlers --

  const handleSave = async (updates: Record<string, unknown>) => {
    if (!deviceId) return
    try {
      setSaving(true)
      const response = await edgeFunctions.devices.update(deviceId, updates)
      if (!response.success) {
        toast.error((response.error as { message?: string })?.message || 'Failed to update device')
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
    if (!confirm(`Are you sure you want to delete "${device?.name}"? This action cannot be undone.`)) return
    try {
      setDeleting(true)
      const response = await edgeFunctions.devices.delete(deviceId)
      if (!response.success) {
        toast.error((response.error as { message?: string })?.message || 'Failed to delete device')
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

  const handleDataSent = () => {
    loadDevice()
    setHistoryRefreshKey((prev) => prev + 1)
  }

  // -- Render --

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!device) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Device not found</p>
        <Button onClick={() => router.push('/dashboard/devices')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Devices
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={device.name}
        description={`${device.device_type || 'Unknown'} \u2022 ID: ${device.id?.substring(0, 8) || 'N/A'}`}
        icon={(() => {
          const typeName = device.device_type || ''
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
                className="h-12 w-12 rounded-lg border bg-white object-contain p-1"
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
            <Button variant="ghost" onClick={() => router.push('/dashboard/devices')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Devices
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="telemetry">Telemetry</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="system">System Info</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <DeviceOverviewTab device={device} telemetryReadings={telemetryReadings} isGateway={isGateway} />
        </TabsContent>

        <TabsContent value="telemetry">
          <DeviceTelemetryTab
            device={device}
            telemetryReadings={telemetryReadings}
            isGateway={isGateway}
            isTestDevice={testDevice}
            temperatureUnit={temperatureUnit}
            historyRefreshKey={historyRefreshKey}
            onDataSent={handleDataSent}
          />
        </TabsContent>

        <TabsContent value="config">
          <DeviceConfigTab
            device={device}
            locations={locations}
            saving={saving}
            deleting={deleting}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="alerts">
          <DeviceAlertsTab device={device} isGateway={isGateway} />
        </TabsContent>

        <TabsContent value="system">
          <DeviceSystemInfoTab device={device} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
