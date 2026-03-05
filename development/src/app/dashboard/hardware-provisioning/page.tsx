/**
 * Hardware Provisioning Page
 *
 * Unified hub for all device hardware management:
 * 1. Devices — view, monitor and manage all IoT devices (with facility map)
 * 2. Device Types — configure device types, ranges, and thresholds
 * 3. Scan & Add — scan barcodes/QR codes to quickly add devices
 * 4. Generate Barcodes — NetNeural-only: create & print barcodes
 * 5. Firmware — NetNeural-only: upload, manage, and push firmware
 */
'use client'

import { useState, useEffect } from 'react'
import { Suspense } from 'react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BarcodeScannerPanel,
  BarcodeGeneratorPanel,
  FirmwareManagementPanel,
} from '@/components/hardware-provisioning'
import { DevicesList } from '@/components/devices/DevicesList'
import { DevicesHeader } from '@/components/devices/DevicesHeader'
import { DeviceTypesList } from '@/components/device-types/DeviceTypesList'
import { DeviceTypeFormDialog } from '@/components/device-types/DeviceTypeFormDialog'
import { FacilityMapView } from '@/components/facility-map'
import { isPlatformAdmin } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { OrganizationIntegrationsTab } from '@/app/dashboard/organizations/components/OrganizationIntegrationsTab'
import {
  ScanBarcode,
  QrCode,
  HardDrive,
  Cpu,
  Smartphone,
  SlidersHorizontal,
  Plug,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DeviceType } from '@/types/device-types'

export default function HardwareProvisioningPage() {
  const { currentOrganization, isLoading, userRole } = useOrganization()
  const { user } = useUser()
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(false)
  const [createTypeDialogOpen, setCreateTypeDialogOpen] = useState(false)

  const isNetNeuralAdmin = isPlatformAdmin(
    user,
    currentOrganization?.id,
    userRole
  )

  // Load device types for the current org
  useEffect(() => {
    if (!currentOrganization?.id) return

    const load = async () => {
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

    load()
  }, [currentOrganization?.id])

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-3 text-center">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">
              Please select an organization to manage hardware
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <OrganizationLogo
          settings={currentOrganization?.settings}
          name={currentOrganization?.name || 'NetNeural'}
          size="xl"
        />
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">
              Hardware Provisioning
            </h2>
          </div>
          <p className="text-muted-foreground">
            Manage devices, device types, and hardware provisioning
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="devices">
        <TabsList className="flex-wrap">
          <TabsTrigger value="devices" className="flex items-center gap-1.5">
            <Smartphone className="h-4 w-4" />
            Devices
          </TabsTrigger>
          <TabsTrigger
            value="device-types"
            className="flex items-center gap-1.5"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Device Types
          </TabsTrigger>
          <TabsTrigger value="scan" className="flex items-center gap-1.5">
            <ScanBarcode className="h-4 w-4" />
            Scan &amp; Add
          </TabsTrigger>
          {isNetNeuralAdmin && (
            <TabsTrigger value="generate" className="flex items-center gap-1.5">
              <QrCode className="h-4 w-4" />
              Generate Barcodes
              <Badge variant="secondary" className="ml-1 text-[10px]">
                NN
              </Badge>
            </TabsTrigger>
          )}
          {isNetNeuralAdmin && (
            <TabsTrigger value="firmware" className="flex items-center gap-1.5">
              <HardDrive className="h-4 w-4" />
              Firmware
              <Badge variant="secondary" className="ml-1 text-[10px]">
                NN
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="integrations" className="flex items-center gap-1.5">
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Tab: Devices — full device list with facility map */}
        <TabsContent value="devices" className="mt-4 space-y-6">
          <DevicesHeader />
          <Suspense fallback={<LoadingSpinner />}>
            <FacilityMapView
              key={`map-${currentOrganization.id}`}
              organizationId={currentOrganization.id}
            />
          </Suspense>
          <Suspense fallback={<LoadingSpinner />}>
            <DevicesList key={currentOrganization.id} />
          </Suspense>
        </TabsContent>

        {/* Tab: Device Types — configuration & thresholds */}
        <TabsContent value="device-types" className="mt-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Device Types</h3>
              <p className="text-sm text-muted-foreground">
                Manage device type configurations, normal operating ranges, and
                alert thresholds
              </p>
            </div>
            <Button onClick={() => setCreateTypeDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Device Type
            </Button>
          </div>
          <Suspense fallback={<LoadingSpinner />}>
            <DeviceTypesList />
          </Suspense>
          <DeviceTypeFormDialog
            open={createTypeDialogOpen}
            onOpenChange={setCreateTypeDialogOpen}
          />
        </TabsContent>

        {/* Tab: Scan & Add Devices — available to ALL accounts */}
        <TabsContent value="scan" className="mt-4">
          <Suspense fallback={<LoadingSpinner />}>
            {loadingTypes ? (
              <LoadingSpinner />
            ) : (
              <BarcodeScannerPanel
                deviceTypes={deviceTypes}
                onDeviceAdded={() => {
                  toast.success(
                    'Device added — switch to the Devices tab to see it'
                  )
                }}
              />
            )}
          </Suspense>
        </TabsContent>

        {/* Tab: Generate Barcodes — NetNeural only */}
        {isNetNeuralAdmin && (
          <TabsContent value="generate" className="mt-4">
            <BarcodeGeneratorPanel />
          </TabsContent>
        )}

        {/* Tab: Firmware Management — NetNeural only */}
        {isNetNeuralAdmin && (
          <TabsContent value="firmware" className="mt-4">
            <FirmwareManagementPanel />
          </TabsContent>
        )}

        {/* Tab: Integrations — Golioth, AWS IoT, Azure, MQTT, etc. */}
        <TabsContent value="integrations" className="mt-4">
          {currentOrganization && (
            <OrganizationIntegrationsTab
              key={currentOrganization.id}
              organizationId={currentOrganization.id}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
