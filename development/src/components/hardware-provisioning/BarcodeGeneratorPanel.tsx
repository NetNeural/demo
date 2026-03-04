/**
 * Barcode Generator Panel
 *
 * NetNeural-only feature (isPlatformAdmin) for creating printable
 * barcodes for NetNeural hardware devices. Generates barcodes in the
 * standard NetNeural format: NN|<device_type>|<model>|<serial>|<firmware>
 *
 * Supports both 1D barcodes (Code128 via JsBarcode) and QR codes.
 * Includes "Add to Inventory" to push generated devices into Inventory Control.
 */
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
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
  Printer,
  Plus,
  Trash2,
  QrCode,
  Barcode,
  Download,
  Copy,
  PackagePlus,
  Warehouse,
} from 'lucide-react'
import { toast } from 'sonner'
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import type {
  InventoryItem,
  HardwareCategory,
} from '@/components/inventory-control/types'
import { CATEGORY_LABELS } from '@/components/inventory-control/types'

/** NetNeural device types for barcode generation */
const NETNEURAL_DEVICE_TYPES = [
  { value: 'modular_sensor', label: 'Modular Sensor' },
  { value: 'hub', label: 'Hub' },
  { value: 'cellular_hub', label: 'Cellular Hub' },
] as const

interface BarcodeEntry {
  id: string
  deviceType: string
  model: string
  serialNumber: string
  firmwareVersion: string
  barcodeValue: string
}

type BarcodeFormat = 'code128' | 'qrcode'

function generateBarcodeValue(
  entry: Omit<BarcodeEntry, 'id' | 'barcodeValue'>
) {
  return `NN|${entry.deviceType}|${entry.model}|${entry.serialNumber}|${entry.firmwareVersion}`
}

/** LocalStorage key matching inventory-control page */
const LS_INVENTORY = 'nn_inventory_items'

/** Add barcode entries to inventory as new InventoryItems */
function addToInventory(entries: BarcodeEntry[]): number {
  if (typeof window === 'undefined' || entries.length === 0) return 0

  // Load existing inventory
  let existing: InventoryItem[] = []
  try {
    const raw = localStorage.getItem(LS_INVENTORY)
    existing = raw ? JSON.parse(raw) : []
  } catch {
    existing = []
  }

  // Build new items, skip duplicates by serial number
  const existingSerials = new Set(
    existing
      .filter((it) => it.serial_prefix)
      .map((it) => it.serial_prefix.toLowerCase())
  )

  const now = new Date().toISOString()
  let addedCount = 0

  for (const entry of entries) {
    if (existingSerials.has(entry.serialNumber.toLowerCase())) continue

    const category = (
      ['modular_sensor', 'hub', 'cellular_hub'].includes(entry.deviceType)
        ? entry.deviceType
        : 'other'
    ) as HardwareCategory

    const typeLabel =
      NETNEURAL_DEVICE_TYPES.find((t) => t.value === entry.deviceType)?.label ||
      entry.deviceType

    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      sku: `NN-${entry.model}-${entry.serialNumber}`,
      name: `${typeLabel} ${entry.model}`,
      description: `NetNeural ${typeLabel} — Model ${entry.model}, S/N ${entry.serialNumber}`,
      category,
      status: 'in_stock',
      quantity_total: 1,
      quantity_available: 1,
      quantity_allocated: 0,
      quantity_issued: 0,
      quantity_defective: 0,
      reorder_threshold: 5,
      manufacturing_cost: 0,
      wholesale_price: 0,
      retail_price: 0,
      currency: 'USD',
      model_number: entry.model,
      hardware_version: '',
      firmware_version: entry.firmwareVersion,
      serial_prefix: entry.serialNumber,
      manufacturer_id: null,
      manufacturer_name: 'NetNeural',
      vendor_id: null,
      vendor_name: '',
      supplier: 'NetNeural',
      warehouse_location: '',
      batch_number: '',
      manufacture_date: now.split('T')[0] ?? null,
      created_at: now,
      updated_at: now,
      created_by: null,
      notes: `Auto-added from barcode: ${entry.barcodeValue}`,
    }

    existing.push(newItem)
    existingSerials.add(entry.serialNumber.toLowerCase())
    addedCount++
  }

  localStorage.setItem(LS_INVENTORY, JSON.stringify(existing))
  return addedCount
}

/** Renders a single barcode to a canvas */
function BarcodeCanvas({
  value,
  format,
}: {
  value: string
  format: BarcodeFormat
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!canvasRef.current || !value) return
    setError(false)

    if (format === 'code128') {
      try {
        JsBarcode(canvasRef.current, value, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 12,
          margin: 10,
        })
      } catch {
        setError(true)
      }
    } else {
      // QR Code
      QRCode.toCanvas(canvasRef.current, value, {
        width: 200,
        margin: 2,
        errorCorrectionLevel: 'M',
      }).catch(() => setError(true))
    }
  }, [value, format])

  if (error) {
    return (
      <div className="flex h-[100px] items-center justify-center rounded border bg-red-50 text-sm text-red-500 dark:bg-red-950/30">
        Failed to render barcode
      </div>
    )
  }

  return <canvas ref={canvasRef} className="mx-auto block" />
}

export function BarcodeGeneratorPanel() {
  const [entries, setEntries] = useState<BarcodeEntry[]>([])
  const [format, setFormat] = useState<BarcodeFormat>('code128')
  const printRef = useRef<HTMLDivElement>(null)

  // Form state for new entry
  const [deviceType, setDeviceType] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [firmwareVersion, setFirmwareVersion] = useState('1.0.0')
  const [batchPrefix, setBatchPrefix] = useState('')
  const [batchCount, setBatchCount] = useState(1)

  const addEntry = useCallback(() => {
    if (!deviceType || !model.trim() || !serialNumber.trim()) {
      toast.error('Device type, model, and serial number are required')
      return
    }

    const entry: BarcodeEntry = {
      id: crypto.randomUUID(),
      deviceType,
      model: model.trim(),
      serialNumber: serialNumber.trim(),
      firmwareVersion: firmwareVersion.trim() || '1.0.0',
      barcodeValue: '',
    }
    entry.barcodeValue = generateBarcodeValue(entry)

    setEntries((prev) => [...prev, entry])
    setSerialNumber('')
    toast.success('Barcode added to batch')
  }, [deviceType, model, serialNumber, firmwareVersion])

  const addBatch = useCallback(() => {
    if (!deviceType || !model.trim() || !batchPrefix.trim() || batchCount < 1) {
      toast.error(
        'Device type, model, serial prefix, and count are required for batch'
      )
      return
    }

    const newEntries: BarcodeEntry[] = []
    for (let i = 1; i <= batchCount; i++) {
      const serial = `${batchPrefix.trim()}${String(i).padStart(4, '0')}`
      const entry: BarcodeEntry = {
        id: crypto.randomUUID(),
        deviceType,
        model: model.trim(),
        serialNumber: serial,
        firmwareVersion: firmwareVersion.trim() || '1.0.0',
        barcodeValue: '',
      }
      entry.barcodeValue = generateBarcodeValue(entry)
      newEntries.push(entry)
    }

    setEntries((prev) => [...prev, ...newEntries])
    toast.success(`${batchCount} barcodes added to batch`)
  }, [deviceType, model, batchPrefix, batchCount, firmwareVersion])

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  const clearAll = () => {
    setEntries([])
    toast.info('All barcodes cleared')
  }

  const handlePrint = () => {
    if (!printRef.current || entries.length === 0) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print.')
      return
    }

    // Collect all canvases and convert to images for printing
    const canvases = printRef.current.querySelectorAll('canvas')
    const images: string[] = []
    canvases.forEach((canvas) => {
      images.push(canvas.toDataURL('image/png'))
    })

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NetNeural Device Barcodes</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .barcode-item {
              display: inline-block;
              border: 1px dashed #ccc;
              padding: 12px;
              margin: 8px;
              text-align: center;
              page-break-inside: avoid;
            }
            .barcode-item img { max-width: 300px; }
            .barcode-meta { font-size: 10px; color: #666; margin-top: 4px; }
            h1 { font-size: 16px; margin-bottom: 10px; }
            @media print {
              body { margin: 0; }
              .barcode-item { border: 1px dashed #999; }
            }
          </style>
        </head>
        <body>
          <h1>NetNeural Device Barcodes — ${new Date().toLocaleDateString()}</h1>
          ${entries
            .map(
              (entry, idx) => `
            <div class="barcode-item">
              <img src="${images[idx] || ''}" alt="${entry.barcodeValue}" />
              <div class="barcode-meta">
                ${NETNEURAL_DEVICE_TYPES.find((t) => t.value === entry.deviceType)?.label || entry.deviceType}
                &bull; ${entry.model} &bull; S/N: ${entry.serialNumber}
              </div>
            </div>
          `
            )
            .join('')}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }

  const copyBarcodeValue = (value: string) => {
    navigator.clipboard.writeText(value)
    toast.success('Barcode value copied')
  }

  const handleAddToInventory = (entry: BarcodeEntry) => {
    const count = addToInventory([entry])
    if (count > 0) {
      toast.success(
        `"${entry.model} (${entry.serialNumber})" added to inventory`
      )
    } else {
      toast.info('This device is already in inventory')
    }
  }

  const handleAddAllToInventory = () => {
    const count = addToInventory(entries)
    if (count > 0) {
      toast.success(`${count} device${count > 1 ? 's' : ''} added to inventory`)
    } else {
      toast.info('All devices are already in inventory')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Generate Device Barcodes
              <Badge variant="default" className="ml-2">
                NetNeural Only
              </Badge>
            </CardTitle>
            <CardDescription>
              Create printable barcodes for NetNeural Modular Sensors, Hubs, and
              Cellular Hubs. Barcodes encode device type, model, serial number,
              and firmware version.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Barcode Format Toggle */}
        <div className="flex items-center gap-4">
          <Label>Barcode Format:</Label>
          <div className="flex gap-2">
            <Button
              variant={format === 'code128' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormat('code128')}
            >
              <Barcode className="mr-1 h-4 w-4" />
              1D Barcode
            </Button>
            <Button
              variant={format === 'qrcode' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormat('qrcode')}
            >
              <QrCode className="mr-1 h-4 w-4" />
              QR Code
            </Button>
          </div>
        </div>

        {/* New Barcode Form */}
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">New Barcode</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Device Type */}
            <div className="space-y-2">
              <Label>Device Type *</Label>
              <Select value={deviceType} onValueChange={setDeviceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {NETNEURAL_DEVICE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label>Model *</Label>
              <Input
                placeholder="e.g., NNS-100, NNH-200"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            {/* Serial Number */}
            <div className="space-y-2">
              <Label>Serial Number *</Label>
              <Input
                placeholder="e.g., SN20260304001"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>

            {/* Firmware Version */}
            <div className="space-y-2">
              <Label>Firmware Version</Label>
              <Input
                placeholder="e.g., 1.0.0"
                value={firmwareVersion}
                onChange={(e) => setFirmwareVersion(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={addEntry}
            disabled={!deviceType || !model.trim() || !serialNumber.trim()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Single Barcode
          </Button>

          {/* Batch Generation */}
          <div className="mt-4 border-t pt-4">
            <h4 className="mb-3 text-sm font-medium">Batch Generate</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Serial Number Prefix</Label>
                <Input
                  placeholder="e.g., SN2026030400"
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={batchCount}
                  onChange={(e) =>
                    setBatchCount(
                      Math.min(500, Math.max(1, parseInt(e.target.value) || 1))
                    )
                  }
                />
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-3"
              onClick={addBatch}
              disabled={
                !deviceType ||
                !model.trim() ||
                !batchPrefix.trim() ||
                batchCount < 1
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Generate {batchCount} Barcodes
            </Button>
          </div>
        </div>

        {/* Generated Barcodes */}
        {entries.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Generated Barcodes ({entries.length})
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={clearAll}>
                  <Trash2 className="mr-1 h-3 w-3" />
                  Clear All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddAllToInventory}
                >
                  <Warehouse className="mr-1 h-3 w-3" />
                  Add All to Inventory
                </Button>
                <Button size="sm" onClick={handlePrint}>
                  <Printer className="mr-1 h-3 w-3" />
                  Print All
                </Button>
              </div>
            </div>

            <div
              ref={printRef}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="relative rounded-lg border bg-white p-3 dark:bg-gray-950"
                >
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>

                  <BarcodeCanvas value={entry.barcodeValue} format={format} />

                  <div className="mt-2 space-y-1 text-center text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium">
                        {NETNEURAL_DEVICE_TYPES.find(
                          (t) => t.value === entry.deviceType
                        )?.label || entry.deviceType}
                      </span>{' '}
                      &bull; {entry.model}
                    </p>
                    <p>S/N: {entry.serialNumber}</p>
                    <p>FW: {entry.firmwareVersion}</p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 w-full"
                    onClick={() => copyBarcodeValue(entry.barcodeValue)}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy Value
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-primary"
                    onClick={() => handleAddToInventory(entry)}
                  >
                    <PackagePlus className="mr-1 h-3 w-3" />
                    Add to Inventory
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
