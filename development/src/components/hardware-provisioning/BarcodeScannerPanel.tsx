/**
 * Barcode Scanner Panel
 *
 * Allows ANY user to scan barcodes/QR codes to quickly add devices
 * to their organization. Uses the device camera via react-qr-barcode-scanner.
 *
 * Barcode format (NetNeural devices):
 *   NN|<device_type>|<model>|<serial_number>|<firmware_version>
 *
 * Also supports plain serial number barcodes for third-party devices.
 */
'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Camera,
  ScanBarcode,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Keyboard,
} from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { toast } from 'sonner'
import type { DeviceType } from '@/types/device-types'

/** Parsed barcode data for a NetNeural device */
interface ParsedBarcode {
  isNetNeural: boolean
  deviceType: string
  model: string
  serialNumber: string
  firmwareVersion: string
  raw: string
}

interface BarcodeScannerPanelProps {
  deviceTypes: DeviceType[]
  onDeviceAdded?: () => void
}

/** Parse a scanned barcode string into device info */
function parseBarcodeData(raw: string): ParsedBarcode {
  const trimmed = raw.trim()

  // NetNeural format: NN|<device_type>|<model>|<serial>|<firmware>
  if (trimmed.startsWith('NN|')) {
    const parts = trimmed.split('|')
    return {
      isNetNeural: true,
      deviceType: parts[1] || '',
      model: parts[2] || '',
      serialNumber: parts[3] || '',
      firmwareVersion: parts[4] || '',
      raw: trimmed,
    }
  }

  // Generic barcode — treat as serial number
  return {
    isNetNeural: false,
    deviceType: '',
    model: '',
    serialNumber: trimmed,
    firmwareVersion: '',
    raw: trimmed,
  }
}

export function BarcodeScannerPanel({
  deviceTypes,
  onDeviceAdded,
}: BarcodeScannerPanelProps) {
  const { currentOrganization } = useOrganization()
  const [scanning, setScanning] = useState(false)
  const [manualEntry, setManualEntry] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [scannedData, setScannedData] = useState<ParsedBarcode | null>(null)
  const [provisioning, setProvisioning] = useState(false)

  // Form overrides (user can edit after scan)
  const [deviceName, setDeviceName] = useState('')
  const [deviceTypeId, setDeviceTypeId] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [firmwareVersion, setFirmwareVersion] = useState('')

  const scannerRef = useRef<HTMLDivElement>(null)

  const handleScanResult = useCallback(
    (rawValue: string) => {
      if (!rawValue || provisioning) return

      const parsed = parseBarcodeData(rawValue)
      setScannedData(parsed)
      setScanning(false)

      // Pre-fill form fields
      setModel(parsed.model)
      setSerialNumber(parsed.serialNumber)
      setFirmwareVersion(parsed.firmwareVersion)

      // Auto-set device name from serial
      if (parsed.serialNumber) {
        setDeviceName(
          parsed.isNetNeural
            ? `${parsed.deviceType} - ${parsed.serialNumber}`
            : `Device ${parsed.serialNumber}`
        )
      }

      // Try to match device type
      if (parsed.isNetNeural && parsed.deviceType) {
        const match = deviceTypes.find(
          (dt) =>
            dt.name.toLowerCase().includes(parsed.deviceType.toLowerCase()) ||
            parsed.deviceType.toLowerCase().includes(dt.name.toLowerCase())
        )
        if (match) {
          setDeviceTypeId(match.id)
        }
      }

      toast.success('Barcode scanned successfully')
    },
    [deviceTypes, provisioning]
  )

  const handleManualSubmit = useCallback(() => {
    if (manualCode.trim()) {
      handleScanResult(manualCode.trim())
      setManualEntry(false)
      setManualCode('')
    }
  }, [manualCode, handleScanResult])

  const handleProvision = async () => {
    if (!currentOrganization?.id) {
      toast.error('No organization selected')
      return
    }
    if (!deviceName.trim()) {
      toast.error('Please enter a device name')
      return
    }
    if (!deviceTypeId) {
      toast.error('Please select a device type')
      return
    }

    setProvisioning(true)
    try {
      const deviceData = {
        name: deviceName.trim(),
        organization_id: currentOrganization.id,
        device_type:
          deviceTypes.find((dt) => dt.id === deviceTypeId)?.name || 'Unknown',
        device_type_id: deviceTypeId,
        status: 'offline' as const,
        is_test_device: false,
        ...(model.trim() && { model: model.trim() }),
        ...(serialNumber.trim() && { serial_number: serialNumber.trim() }),
        ...(firmwareVersion.trim() && {
          firmware_version: firmwareVersion.trim(),
        }),
        metadata: scannedData
          ? {
              provisioned_via: 'barcode_scan',
              barcode_raw: scannedData.raw,
              is_netneural_device: scannedData.isNetNeural,
            }
          : { provisioned_via: 'manual_entry' },
      }

      const response = await edgeFunctions.devices.create(deviceData)
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to provision device')
      }

      toast.success(`Device "${deviceName}" provisioned successfully`)
      resetForm()
      onDeviceAdded?.()
    } catch (error) {
      console.error('Provisioning failed:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to provision device'
      )
    } finally {
      setProvisioning(false)
    }
  }

  const resetForm = () => {
    setScannedData(null)
    setDeviceName('')
    setDeviceTypeId('')
    setModel('')
    setSerialNumber('')
    setFirmwareVersion('')
    setManualCode('')
  }

  const startCameraScan = async () => {
    setScanning(true)
    // Dynamic import to avoid SSR issues
    try {
      const { default: BarcodeScannerComponent } =
        await import('react-qr-barcode-scanner')
      // Store the component for rendering
      setScannerComponent(() => BarcodeScannerComponent)
    } catch {
      toast.error('Camera scanner not available. Use manual entry instead.')
      setScanning(false)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ScannerComponent, setScannerComponent] =
    useState<React.ComponentType<any> | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanBarcode className="h-5 w-5" />
          Scan Barcode to Add Device
        </CardTitle>
        <CardDescription>
          Scan a device barcode or QR code to quickly register it to your
          organization. NetNeural barcodes auto-fill all device information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scanner Controls */}
        {!scannedData && !scanning && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={startCameraScan} className="flex-1">
              <Camera className="mr-2 h-4 w-4" />
              Scan with Camera
            </Button>
            <Button
              variant="outline"
              onClick={() => setManualEntry(!manualEntry)}
              className="flex-1"
            >
              <Keyboard className="mr-2 h-4 w-4" />
              Manual / Scanner Entry
            </Button>
          </div>
        )}

        {/* Manual barcode entry (for USB/Bluetooth scanners or typing) */}
        {manualEntry && !scannedData && (
          <div className="space-y-2">
            <Label>Enter or scan barcode value</Label>
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="Scan barcode here or type value..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualSubmit()
                }}
              />
              <Button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
              >
                Submit
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Focus this field and scan with a USB/Bluetooth barcode scanner, or
              type the barcode value manually.
            </p>
          </div>
        )}

        {/* Camera Scanner View */}
        {scanning && ScannerComponent && (
          <div ref={scannerRef} className="space-y-2">
            <div className="overflow-hidden rounded-lg border">
              <ScannerComponent
                width={500}
                height={300}
                onUpdate={(_err: unknown, result?: { text: string }) => {
                  if (result?.text) {
                    handleScanResult(result.text)
                  }
                }}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setScanning(false)}
              className="w-full"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Scan
            </Button>
          </div>
        )}

        {/* Scanned Result & Provisioning Form */}
        {scannedData && (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">Barcode Scanned</span>
              </div>
              <Badge
                variant={scannedData.isNetNeural ? 'default' : 'secondary'}
              >
                {scannedData.isNetNeural
                  ? 'NetNeural Device'
                  : 'Third-Party Device'}
              </Badge>
            </div>

            {scannedData.isNetNeural && (
              <p className="text-sm text-muted-foreground">
                NetNeural device detected — fields auto-populated from barcode.
              </p>
            )}

            {/* Device Name */}
            <div className="space-y-2">
              <Label htmlFor="scan-name">Device Name *</Label>
              <Input
                id="scan-name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                disabled={provisioning}
              />
            </div>

            {/* Device Type */}
            <div className="space-y-2">
              <Label>Device Type *</Label>
              <Select
                value={deviceTypeId}
                onValueChange={setDeviceTypeId}
                disabled={provisioning}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select device type" />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="scan-model">Model</Label>
              <Input
                id="scan-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={provisioning}
              />
            </div>

            {/* Serial Number */}
            <div className="space-y-2">
              <Label htmlFor="scan-serial">Serial Number</Label>
              <Input
                id="scan-serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                disabled={provisioning}
              />
            </div>

            {/* Firmware Version */}
            <div className="space-y-2">
              <Label htmlFor="scan-fw">Firmware Version</Label>
              <Input
                id="scan-fw"
                value={firmwareVersion}
                onChange={(e) => setFirmwareVersion(e.target.value)}
                disabled={provisioning}
              />
            </div>

            {/* Raw barcode value */}
            <div className="rounded border bg-muted p-2">
              <p className="text-xs text-muted-foreground">
                Raw barcode:{' '}
                <code className="font-mono">{scannedData.raw}</code>
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={resetForm}
                disabled={provisioning}
              >
                Scan Another
              </Button>
              <Button
                onClick={handleProvision}
                disabled={provisioning || !deviceName.trim() || !deviceTypeId}
                className="flex-1"
              >
                {provisioning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Provisioning...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Add Device to Organization
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Info box */}
        {!scannedData && !scanning && !manualEntry && (
          <div className="flex items-start gap-2 rounded-lg border bg-blue-50 p-3 dark:bg-blue-950/30">
            <AlertCircle className="mt-0.5 h-4 w-4 text-blue-500" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">Supported barcode formats</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                <li>
                  NetNeural barcodes — auto-fill device type, model, serial, and
                  firmware
                </li>
                <li>Standard barcodes — used as serial number</li>
                <li>QR codes — encoded device information</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
