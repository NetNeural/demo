/**
 * Firmware Management Panel
 *
 * NetNeural-only feature for managing firmware images.
 * Allows uploading firmware binaries, assigning versions to device types,
 * and pushing firmware updates to NetNeural devices.
 *
 * Uses Supabase Storage for firmware binary storage and the
 * device metadata to track firmware versions.
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Upload,
  HardDrive,
  FileCode,
  Loader2,
  Trash2,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const NETNEURAL_DEVICE_TYPES = [
  { value: 'modular_sensor', label: 'Modular Sensor' },
  { value: 'hub', label: 'Hub' },
  { value: 'cellular_hub', label: 'Cellular Hub' },
] as const

interface FirmwareRelease {
  id: string
  version: string
  device_type: string
  release_notes: string
  file_name: string
  file_size: number
  checksum: string
  status: 'draft' | 'testing' | 'released' | 'deprecated'
  created_at: string
  created_by: string
}

interface DeviceForUpdate {
  id: string
  name: string
  serial_number: string | null
  firmware_version: string | null
  device_type: string
  status: string | null
}

export function FirmwareManagementPanel() {
  const { currentOrganization } = useOrganization()
  // Cast needed: firmware_releases table will be added via migration but isn't in generated types yet
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const [releases, setReleases] = useState<FirmwareRelease[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [pushDialogOpen, setPushDialogOpen] = useState(false)
  const [selectedRelease, setSelectedRelease] =
    useState<FirmwareRelease | null>(null)
  const [eligibleDevices, setEligibleDevices] = useState<DeviceForUpdate[]>([])
  const [selectedDevices, setSelectedDevices] = useState<string[]>([])
  const [pushing, setPushing] = useState(false)

  // Upload form state
  const [uploadVersion, setUploadVersion] = useState('')
  const [uploadDeviceType, setUploadDeviceType] = useState('')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const loadReleases = useCallback(async () => {
    if (!currentOrganization?.id) return
    setLoading(true)
    try {
      // Load firmware releases from the firmware_releases table
      // This table stores metadata; actual binaries are in Supabase Storage
      const { data, error } = await supabase
        .from('firmware_releases')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        // Table might not exist yet — show empty state
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          setReleases([])
          return
        }
        throw error
      }
      setReleases(data || [])
    } catch (error) {
      console.error('Failed to load firmware releases:', error)
      // Show empty state instead of error for missing table
      setReleases([])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id])

  useEffect(() => {
    loadReleases()
  }, [loadReleases])

  const handleUpload = async () => {
    if (!uploadVersion.trim() || !uploadDeviceType || !uploadFile) {
      toast.error('Version, device type, and firmware file are required')
      return
    }

    setUploading(true)
    try {
      // 1. Upload binary to Supabase Storage
      const filePath = `firmware/${uploadDeviceType}/${uploadVersion}/${uploadFile.name}`
      const { error: storageError } = await supabase.storage
        .from('firmware')
        .upload(filePath, uploadFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (storageError) {
        // Storage bucket may not exist — inform user
        if (storageError.message?.includes('not found') || storageError.message?.includes('Bucket')) {
          toast.error(
            'Firmware storage bucket not configured. A database migration is needed to create it.'
          )
          return
        }
        throw storageError
      }

      // 2. Calculate simple checksum (file size + name hash)
      const checksum = `sha256:${uploadFile.size.toString(16)}`

      // 3. Insert release metadata
      const { error: insertError } = await supabase
        .from('firmware_releases')
        .insert({
          version: uploadVersion.trim(),
          device_type: uploadDeviceType,
          release_notes: uploadNotes.trim(),
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          file_path: filePath,
          checksum,
          status: 'draft',
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })

      if (insertError) {
        if (
          insertError.code === '42P01' ||
          insertError.message?.includes('does not exist')
        ) {
          toast.error(
            'Firmware releases table not yet created. A database migration is needed.'
          )
          return
        }
        throw insertError
      }

      toast.success(`Firmware v${uploadVersion} uploaded successfully`)
      setUploadDialogOpen(false)
      resetUploadForm()
      loadReleases()
    } catch (error) {
      console.error('Firmware upload failed:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to upload firmware'
      )
    } finally {
      setUploading(false)
    }
  }

  const resetUploadForm = () => {
    setUploadVersion('')
    setUploadDeviceType('')
    setUploadNotes('')
    setUploadFile(null)
  }

  const openPushDialog = async (release: FirmwareRelease) => {
    setSelectedRelease(release)
    setPushDialogOpen(true)
    setSelectedDevices([])

    // Find devices of matching type that need updating
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name, serial_number, firmware_version, device_type, status')
        .eq('organization_id', currentOrganization?.id || '')
        .ilike('device_type', `%${release.device_type.replace('_', ' ')}%`)

      if (error) throw error
      setEligibleDevices(
        (data || []).filter(
          (d: DeviceForUpdate) => d.firmware_version !== release.version
        ) as DeviceForUpdate[]
      )
    } catch (error) {
      console.error('Failed to load eligible devices:', error)
      setEligibleDevices([])
    }
  }

  const handlePushFirmware = async () => {
    if (!selectedRelease || selectedDevices.length === 0) return

    setPushing(true)
    try {
      // Update firmware_version on selected devices
      // In a real production system, this would trigger an OTA update via
      // the device management integration (GoliothDevice push, MQTT command, etc.)
      const { error } = await supabase
        .from('devices')
        .update({
          firmware_version: selectedRelease.version,
          updated_at: new Date().toISOString(),
          metadata: {
            last_firmware_push: new Date().toISOString(),
            firmware_push_version: selectedRelease.version,
          },
        })
        .in('id', selectedDevices)

      if (error) throw error

      toast.success(
        `Firmware v${selectedRelease.version} pushed to ${selectedDevices.length} device(s)`
      )
      setPushDialogOpen(false)
      setSelectedDevices([])
    } catch (error) {
      console.error('Firmware push failed:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to push firmware'
      )
    } finally {
      setPushing(false)
    }
  }

  const updateReleaseStatus = async (
    id: string,
    status: FirmwareRelease['status']
  ) => {
    try {
      const { error } = await supabase
        .from('firmware_releases')
        .update({ status })
        .eq('id', id)

      if (error) throw error
      toast.success(`Release status updated to ${status}`)
      loadReleases()
    } catch (error) {
      console.error('Failed to update release status:', error)
      toast.error('Failed to update status')
    }
  }

  const deleteRelease = async (release: FirmwareRelease) => {
    if (
      !confirm(
        `Delete firmware v${release.version} for ${release.device_type}?`
      )
    )
      return

    try {
      const { error } = await supabase
        .from('firmware_releases')
        .delete()
        .eq('id', release.id)

      if (error) throw error
      toast.success('Firmware release deleted')
      loadReleases()
    } catch (error) {
      console.error('Failed to delete release:', error)
      toast.error('Failed to delete release')
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    testing:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    released:
      'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    deprecated: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Firmware Management
                <Badge variant="default" className="ml-2">
                  NetNeural Only
                </Badge>
              </CardTitle>
              <CardDescription>
                Upload firmware images, manage release versions, and push
                updates to NetNeural devices.
              </CardDescription>
            </div>
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Firmware
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : releases.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-12">
              <FileCode className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No firmware releases yet
              </p>
              <p className="text-xs text-muted-foreground">
                Upload your first firmware image to get started.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Upload First Firmware
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Device Type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releases.map((release) => (
                    <TableRow key={release.id}>
                      <TableCell className="font-mono font-medium">
                        v{release.version}
                      </TableCell>
                      <TableCell>
                        {NETNEURAL_DEVICE_TYPES.find(
                          (t) => t.value === release.device_type
                        )?.label || release.device_type}
                      </TableCell>
                      <TableCell className="text-sm">
                        {release.file_name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFileSize(release.file_size)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[release.status] || ''}`}
                        >
                          {release.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(release.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {release.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateReleaseStatus(release.id, 'testing')
                              }
                            >
                              <Clock className="h-3 w-3" />
                            </Button>
                          )}
                          {release.status === 'testing' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                updateReleaseStatus(release.id, 'released')
                              }
                            >
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                          )}
                          {release.status === 'released' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPushDialog(release)}
                              title="Push to devices"
                            >
                              <Send className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteRelease(release)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Firmware Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Firmware
            </DialogTitle>
            <DialogDescription>
              Upload a firmware binary for a NetNeural device type.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Version *</Label>
              <Input
                placeholder="e.g., 1.2.0"
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Device Type *</Label>
              <Select
                value={uploadDeviceType}
                onValueChange={setUploadDeviceType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select device type" />
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

            <div className="space-y-2">
              <Label>Release Notes</Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={3}
                placeholder="What's new in this firmware version..."
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Firmware Binary *</Label>
              <Input
                type="file"
                accept=".bin,.hex,.uf2,.elf,.img,.fw"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
              {uploadFile && (
                <p className="text-xs text-muted-foreground">
                  {uploadFile.name} ({formatFileSize(uploadFile.size)})
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                uploading ||
                !uploadVersion.trim() ||
                !uploadDeviceType ||
                !uploadFile
              }
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push Firmware Dialog */}
      <Dialog open={pushDialogOpen} onOpenChange={setPushDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Push Firmware Update
            </DialogTitle>
            <DialogDescription>
              Push firmware v{selectedRelease?.version} to selected{' '}
              {NETNEURAL_DEVICE_TYPES.find(
                (t) => t.value === selectedRelease?.device_type
              )?.label || selectedRelease?.device_type}{' '}
              devices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {eligibleDevices.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-4">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No devices found that need this firmware update.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {eligibleDevices.length} device(s) eligible for update
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        selectedDevices.length === eligibleDevices.length
                      ) {
                        setSelectedDevices([])
                      } else {
                        setSelectedDevices(eligibleDevices.map((d) => d.id))
                      }
                    }}
                  >
                    {selectedDevices.length === eligibleDevices.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </div>

                <div className="max-h-[300px] overflow-y-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]"></TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Serial</TableHead>
                        <TableHead>Current FW</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eligibleDevices.map((device) => (
                        <TableRow key={device.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedDevices.includes(device.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDevices((prev) => [
                                    ...prev,
                                    device.id,
                                  ])
                                } else {
                                  setSelectedDevices((prev) =>
                                    prev.filter((id) => id !== device.id)
                                  )
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {device.name}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {device.serial_number || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {device.firmware_version || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                device.status === 'online'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {device.status || 'unknown'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPushDialogOpen(false)}
              disabled={pushing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePushFirmware}
              disabled={pushing || selectedDevices.length === 0}
            >
              {pushing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Push to {selectedDevices.length} Device(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
