/**
 * Hardware Provisioning Page
 *
 * Three main sections:
 * 1. Barcode Scanner — ALL accounts can scan barcodes to add devices
 * 2. Barcode Generator — NetNeural-only: create & print barcodes for NN devices
 * 3. Firmware Management — NetNeural-only: upload, manage, and push firmware
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
import {
  BarcodeScannerPanel,
  BarcodeGeneratorPanel,
  FirmwareManagementPanel,
} from '@/components/hardware-provisioning'
import { isPlatformAdmin, NETNEURAL_ORG_ID } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { ScanBarcode, QrCode, HardDrive, Cpu } from 'lucide-react'
import { toast } from 'sonner'
import type { DeviceType } from '@/types/device-types'

export default function HardwareProvisioningPage() {
  const { currentOrganization, isLoading, userRole } = useOrganization()
  const { user } = useUser()
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(false)

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
              Please select an organization to manage hardware provisioning
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
            Scan barcodes to add devices
            {isNetNeuralAdmin &&
              ', generate barcodes for NetNeural hardware, and manage firmware'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scan">
        <TabsList>
          <TabsTrigger value="scan" className="flex items-center gap-1.5">
            <ScanBarcode className="h-4 w-4" />
            Scan & Add Devices
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
        </TabsList>

        {/* Tab: Scan & Add Devices — available to ALL accounts */}
        <TabsContent value="scan" className="mt-4">
          <Suspense fallback={<LoadingSpinner />}>
            {loadingTypes ? (
              <LoadingSpinner />
            ) : (
              <BarcodeScannerPanel
                deviceTypes={deviceTypes}
                onDeviceAdded={() => {
                  toast.success('Device added — refresh your devices page to see it')
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
      </Tabs>
    </div>
  )
}
