/**
 * Add Device Dialog
 *
 * Allows users to register new IoT devices to their organization.
 * Supports two entry modes:
 *   1. Scan Barcode — camera or manual barcode entry, auto-populates fields
 *   2. Manual Entry — traditional form input
 *
 * Barcode format (NetNeural devices):
 *   NN|<device_type>|<model>|<serial_number>|<firmware_version>
 * Also supports plain serial number barcodes for third-party devices.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Plus,
  Network,
  ScanBarcode,
  Camera,
  Keyboard,
  XCircle,
  CheckCircle2,
  PenLine,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { toast } from 'sonner'
import type { DeviceType } from '@/types/device-types'

/** Parsed barcode data */
interface ParsedBarcode {
  isNetNeural: boolean
  deviceType: string
  model: string
  serialNumber: string
  firmwareVersion: string
  raw: string
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

type EntryMode = 'choose' | 'scan' | 'manual'

interface AddDeviceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddDeviceDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddDeviceDialogProps) {
  const { currentOrganization } = useOrganization()
  const [deviceTypes, setDeviceTypes] = useState<DeviceType[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(false)

  // Entry mode
  const [entryMode, setEntryMode] = useState<EntryMode>('choose')

  // Barcode scan state
  const [scanning, setScanning] = useState(false)
  const [manualBarcodeEntry, setManualBarcodeEntry] = useState(false)
  const [manualBarcodeCode, setManualBarcodeCode] = useState('')
  const [scannedData, setScannedData] = useState<ParsedBarcode | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ScannerComponent, setScannerComponent] = useState<React.ComponentType<any> | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [isGateway, setIsGateway] = useState(false)
  const [deviceTypeId, setDeviceTypeId] = useState<string>('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [firmwareVersion, setFirmwareVersion] = useState('')
  const [location, setLocation] = useState('')

  // Load device types for the current org
  useEffect(() => {
    if (!open || !currentOrganization?.id) return

    const loadDeviceTypes = async () => {
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

    loadDeviceTypes()
  }, [open, currentOrganization?.id])

  // Reset everything when dialog closes
  useEffect(() => {
    if (!open) {
      resetAll()
    }
  }, [open])

  const resetAll = () => {
    setEntryMode('choose')
    setScanning(false)
    setManualBarcodeEntry(false)
    setManualBarcodeCode('')
    setScannedData(null)
    setScannerComponent(null)
    setName('')
    setIsGateway(false)
    setDeviceTypeId('')
    setModel('')
    setSerialNumber('')
    setFirmwareVersion('')
    setLocation('')
  }

  // Handle barcode scan result — auto-populate form fields
  const handleScanResult = useCallback(
    (rawValue: string) => {
      if (!rawValue || loading) return

      const parsed = parseBarcodeData(rawValue)
      setScannedData(parsed)
      setScanning(false)

      // Pre-fill form fields from barcode
      setModel(parsed.model)
      setSerialNumber(parsed.serialNumber)
      setFirmwareVersion(parsed.firmwareVersion)

      // Auto-set device name from serial
      if (parsed.serialNumber) {
        setName(
          parsed.isNetNeural
            ? `${parsed.deviceType} - ${parsed.serialNumber}`
            : `Device ${parsed.serialNumber}`
        )
      }

      // Try to match device type from barcode
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

      // Switch to manual mode so the user sees the populated form
      setEntryMode('manual')
      toast.success('Barcode scanned — fields populated')
    },
    [deviceTypes, loading]
  )

  const handleManualBarcodeSubmit = useCallback(() => {
    if (manualBarcodeCode.trim()) {
      handleScanResult(manualBarcodeCode.trim())
      setManualBarcodeEntry(false)
      setManualBarcodeCode('')
    }
  }, [manualBarcodeCode, handleScanResult])

  const startCameraScan = async () => {
    setScanning(true)
    try {
      const { default: BarcodeScannerComp } = await import(
        'react-qr-barcode-scanner'
      )
      setScannerComponent(() => BarcodeScannerComp)
    } catch {
      toast.error('Camera scanner not available. Use manual entry instead.')
      setScanning(false)
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a device name')
      return
    }

    if (!isGateway && !deviceTypeId) {
      toast.error('Please select a device type')
      return
    }

    if (!currentOrganization?.id) {
      toast.error('No organization selected')
      return
    }

    setLoading(true)
    try {
      // Get the selected device type
      const selectedType = deviceTypes.find((t) => t.id === deviceTypeId)

      // Create the device
      const deviceData = {
        name: name.trim(),
        organization_id: currentOrganization.id,
        device_type: isGateway ? 'gateway' : selectedType?.name || 'Unknown',
        device_type_id: isGateway ? null : deviceTypeId || null,
        status: 'offline' as const,
        is_test_device: false,
        ...(isGateway && { metadata: { is_gateway: true } }),
        ...(model.trim() && { model: model.trim() }),
        ...(serialNumber.trim() && { serial_number: serialNumber.trim() }),
        ...(firmwareVersion.trim() && {
          firmware_version: firmwareVersion.trim(),
        }),
        ...(location.trim() && { location: location.trim() }),
        // Track how the device was added
        ...(scannedData && {
          metadata: {
            ...(isGateway ? { is_gateway: true } : {}),
            provisioned_via: 'barcode_scan',
            barcode_raw: scannedData.raw,
            is_netneural_device: scannedData.isNetNeural,
          },
        }),
      }

      const response = await edgeFunctions.devices.create(deviceData)

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to add device')
      }

      toast.success(`Device "${name}" added successfully`)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to add device:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to add device'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <DialogTitle>Add New Device</DialogTitle>
          </div>
          <DialogDescription>
            {entryMode === 'choose'
              ? 'Choose how to add your device — scan a barcode or enter details manually.'
              : scannedData
                ? 'Device fields populated from barcode. Review and adjust before saving.'
                : 'Register a new IoT device to your organization. Required fields are marked with *.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
          {/* ──── MODE CHOOSER ──── */}
          {entryMode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => setEntryMode('scan')}
                className="flex w-full items-center gap-4 rounded-lg border-2 border-dashed p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ScanBarcode className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Scan Barcode</p>
                  <p className="text-sm text-muted-foreground">
                    Use camera or USB/Bluetooth scanner to auto-fill device
                    details
                  </p>
                </div>
              </button>

              <button
                onClick={() => setEntryMode('manual')}
                className="flex w-full items-center gap-4 rounded-lg border-2 border-dashed p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <PenLine className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Manual Entry</p>
                  <p className="text-sm text-muted-foreground">
                    Type device name, type, serial number and other details
                  </p>
                </div>
              </button>
            </div>
          )}

          {/* ──── SCAN MODE ──── */}
          {entryMode === 'scan' && (
            <div className="space-y-4">
              {/* Scan action buttons */}
              {!scanning && (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={startCameraScan} className="flex-1">
                    <Camera className="mr-2 h-4 w-4" />
                    Scan with Camera
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setManualBarcodeEntry(!manualBarcodeEntry)}
                    className="flex-1"
                  >
                    <Keyboard className="mr-2 h-4 w-4" />
                    Type / USB Scanner
                  </Button>
                </div>
              )}

              {/* Manual barcode text entry */}
              {manualBarcodeEntry && !scanning && (
                <div className="space-y-2">
                  <Label>Enter or scan barcode value</Label>
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Scan barcode here or type value..."
                      value={manualBarcodeCode}
                      onChange={(e) => setManualBarcodeCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleManualBarcodeSubmit()
                      }}
                    />
                    <Button
                      onClick={handleManualBarcodeSubmit}
                      disabled={!manualBarcodeCode.trim()}
                    >
                      Submit
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Focus this field and scan with a USB/Bluetooth barcode
                    scanner, or type the barcode value manually.
                  </p>
                </div>
              )}

              {/* Camera scanner view */}
              {scanning && ScannerComponent && (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-lg border">
                    <ScannerComponent
                      width={500}
                      height={300}
                      onUpdate={(
                        _err: unknown,
                        result?: { text: string }
                      ) => {
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

              {/* Info box */}
              {!scanning && !manualBarcodeEntry && (
                <div className="rounded-lg border bg-blue-50 p-3 dark:bg-blue-950/30">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Supported barcode formats
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs text-blue-700 dark:text-blue-300">
                    <li>
                      NetNeural barcodes — auto-fill type, model, serial &amp;
                      firmware
                    </li>
                    <li>Standard barcodes — used as serial number</li>
                    <li>QR codes — encoded device information</li>
                  </ul>
                </div>
              )}

              {/* Back to mode chooser */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEntryMode('choose')
                  setScanning(false)
                  setManualBarcodeEntry(false)
                  setManualBarcodeCode('')
                }}
              >
                ← Back to options
              </Button>
            </div>
          )}

          {/* ──── MANUAL / FORM MODE (also shown after scan with populated fields) ──── */}
          {entryMode === 'manual' && (
            <>
              {/* Scanned badge */}
              {scannedData && (
                <div className="flex items-center gap-2 rounded-lg border bg-green-50 p-3 dark:bg-green-950/30">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Fields populated from barcode
                  </span>
                  <Badge
                    variant={
                      scannedData.isNetNeural ? 'default' : 'secondary'
                    }
                    className="ml-auto"
                  >
                    {scannedData.isNetNeural
                      ? 'NetNeural Device'
                      : 'Third-Party'}
                  </Badge>
                </div>
              )}

              {/* Device Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Device Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Temperature Sensor A1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Gateway Toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label
                      htmlFor="is-gateway"
                      className="cursor-pointer font-medium"
                    >
                      Gateway Device
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Hub that relays data from child sensors
                    </p>
                  </div>
                </div>
                <Switch
                  id="is-gateway"
                  checked={isGateway}
                  onCheckedChange={setIsGateway}
                  disabled={loading}
                />
              </div>

              {/* Device Type */}
              {!isGateway && (
                <div className="space-y-2">
                  <Label htmlFor="device-type">Device Type *</Label>
                  {loadingTypes ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading device types...
                    </div>
                  ) : (
                    <Select
                      value={deviceTypeId}
                      onValueChange={setDeviceTypeId}
                      disabled={loading}
                    >
                      <SelectTrigger id="device-type">
                        <SelectValue placeholder="Select device type" />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceTypes.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No device types found. Create one first.
                          </div>
                        ) : (
                          deviceTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="e.g., TH-100"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Serial Number */}
              <div className="space-y-2">
                <Label htmlFor="serial">Serial Number</Label>
                <Input
                  id="serial"
                  placeholder="e.g., SN123456789"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Firmware Version */}
              <div className="space-y-2">
                <Label htmlFor="firmware">Firmware Version</Label>
                <Input
                  id="firmware"
                  placeholder="e.g., v1.2.3"
                  value={firmwareVersion}
                  onChange={(e) => setFirmwareVersion(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="e.g., Building A, Floor 2"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Back to mode chooser (only if not already scanned) */}
              {!scannedData && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEntryMode('choose')}
                >
                  ← Back to options
                </Button>
              )}
            </>
          )}
        </div>

        {/* Footer — only show when form is visible */}
        {entryMode === 'manual' && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                loading || !name.trim() || (!isGateway && !deviceTypeId)
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Device
                </>
              )}
            </Button>
          </DialogFooter>
        )}

        {/* Footer for choose mode */}
        {entryMode === 'choose' && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
