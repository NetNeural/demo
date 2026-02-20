/**
 * Bulk Device Type Assignment Dialog
 *
 * Allows admins to reassign device types to multiple devices at once.
 * Shows a summary of affected devices and optional confirmation.
 *
 * @see Issue #119
 */
'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { DeviceTypeSelector } from './DeviceTypeSelector'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-client'
import { toast } from 'sonner'
import type { DeviceType } from '@/types/device-types'

interface BulkAssignDeviceTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deviceIds: string[]
  deviceNames?: string[]
  onSuccess?: () => void
}

export function BulkAssignDeviceTypeDialog({
  open,
  onOpenChange,
  deviceIds,
  deviceNames = [],
  onSuccess,
}: BulkAssignDeviceTypeDialogProps) {
  const { currentOrganization } = useOrganization()
  const queryClient = useQueryClient()
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<DeviceType | null>(null)
  const [assigning, setAssigning] = useState(false)
  const [result, setResult] = useState<{
    success: number
    failed: number
  } | null>(null)

  const count = deviceIds.length

  function handleTypeChange(typeId: string | null, dt: DeviceType | null) {
    setSelectedTypeId(typeId)
    setSelectedType(dt)
    setResult(null)
  }

  async function handleAssign() {
    if (!currentOrganization) return
    setAssigning(true)
    setResult(null)

    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('devices')
        .update({
          device_type_id: selectedTypeId,
          // Also update the display name if a type is selected
          ...(selectedType ? { device_type: selectedType.name } : {}),
        })
        .in('id', deviceIds)

      if (error) {
        throw new Error(error.message)
      }

      setResult({ success: count, failed: 0 })
      toast.success(
        `Assigned device type to ${count} device${count !== 1 ? 's' : ''}`
      )

      // Invalidate device queries
      queryClient.invalidateQueries({ queryKey: queryKeys.devices })
      if (currentOrganization?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.devicesByOrg(currentOrganization.id),
        })
      }

      onSuccess?.()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to assign device types'
      toast.error(message)
      setResult({ success: 0, failed: count })
    } finally {
      setAssigning(false)
    }
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setSelectedTypeId(null)
      setSelectedType(null)
      setResult(null)
    }
    onOpenChange(isOpen)
  }

  const displayNames = useMemo(() => {
    if (deviceNames.length <= 5) return deviceNames
    return [
      ...deviceNames.slice(0, 5),
      `... and ${deviceNames.length - 5} more`,
    ]
  }, [deviceNames])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Assign Device Type</DialogTitle>
          <DialogDescription>
            Assign a device type to <strong>{count}</strong> selected device
            {count !== 1 ? 's' : ''}. Inherited configuration will apply
            immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected devices summary */}
          {displayNames.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium">Selected Devices:</p>
              <div className="flex flex-wrap gap-1">
                {displayNames.map((name, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Type selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Device Type:</p>
            <DeviceTypeSelector
              value={selectedTypeId}
              onValueChange={handleTypeChange}
              allowNone={true}
              placeholder="Choose a device type..."
            />
          </div>

          {/* Selected type preview */}
          {selectedType && (
            <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
              <p className="font-medium">{selectedType.name}</p>
              <p className="text-muted-foreground">
                Normal: {selectedType.lower_normal}–{selectedType.upper_normal}{' '}
                {selectedType.unit}
              </p>
              {(selectedType.lower_alert != null ||
                selectedType.upper_alert != null) && (
                <p className="text-muted-foreground">
                  Alert: {selectedType.lower_alert ?? '—'} /{' '}
                  {selectedType.upper_alert ?? '—'} {selectedType.unit}
                </p>
              )}
            </div>
          )}

          {/* Result display */}
          {result && (
            <div
              className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                result.failed > 0
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-500/10 text-green-700'
              }`}
            >
              {result.failed > 0 ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {result.failed > 0
                ? `Failed to assign ${result.failed} device${result.failed !== 1 ? 's' : ''}`
                : `Successfully assigned ${result.success} device${result.success !== 1 ? 's' : ''}`}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={assigning}
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleAssign} disabled={assigning}>
              {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {assigning
                ? 'Assigning...'
                : `Assign to ${count} Device${count !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
