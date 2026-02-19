/**
 * Device Types List
 * 
 * Displays device types in cards or table with inline actions.
 * Supports edit, delete, and visual range indicators.
 * 
 * @see Issue #118
 */
'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pencil,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  Gauge,
  PackageOpen,
  Loader2,
  Grid3x3,
  Table2,
  Ruler,
} from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { createClient } from '@/lib/supabase/client'
import {
  useDeviceTypesQuery,
  useDeleteDeviceTypeMutation,
} from '@/hooks/queries/useDeviceTypes'
import { DeviceTypeFormDialog } from './DeviceTypeFormDialog'
import { DEVICE_CLASSES, type DeviceType } from '@/types/device-types'

/** Format a number to the configured precision */
function fmt(value: number | null, precision: number): string {
  if (value == null) return '—'
  return value.toFixed(precision)
}

/** Get device class label */
function getClassLabel(deviceClass: string | null): string {
  if (!deviceClass) return ''
  return DEVICE_CLASSES.find(c => c.value === deviceClass)?.label ?? deviceClass
}

/** Visual range bar showing normal range + alert thresholds scale */
function RangeBar({ type }: { type: DeviceType }) {
  const { lower_alert, lower_normal, upper_normal, upper_alert, unit, precision_digits } = type

  // Compute the full range for the bar
  const allValues = [lower_normal, upper_normal]
  if (lower_alert != null) allValues.push(lower_alert)
  if (upper_alert != null) allValues.push(upper_alert)
  const min = Math.min(...allValues) - Math.abs(Math.min(...allValues) * 0.1 || 1)
  const max = Math.max(...allValues) + Math.abs(Math.max(...allValues) * 0.1 || 1)
  const range = max - min || 1

  const pct = (v: number) => ((v - min) / range) * 100

  const normalLeft = pct(lower_normal)
  const normalWidth = pct(upper_normal) - normalLeft

  return (
    <div className="w-full">
      <div className="relative h-4 bg-muted rounded-full overflow-hidden">
        {/* Alert zone - left */}
        {lower_alert != null && (
          <div
            className="absolute top-0 h-full bg-destructive/20"
            style={{ left: `${pct(lower_alert)}%`, width: `${normalLeft - pct(lower_alert)}%` }}
          />
        )}
        {/* Normal zone */}
        <div
          className="absolute top-0 h-full bg-green-500/30"
          style={{ left: `${normalLeft}%`, width: `${normalWidth}%` }}
        />
        {/* Alert zone - right */}
        {upper_alert != null && (
          <div
            className="absolute top-0 h-full bg-destructive/20"
            style={{
              left: `${pct(upper_normal)}%`,
              width: `${pct(upper_alert) - pct(upper_normal)}%`,
            }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 px-0.5">
        {lower_alert != null && (
          <span className="text-destructive">{fmt(lower_alert, precision_digits)}</span>
        )}
        <span className="text-green-600">{fmt(lower_normal, precision_digits)}</span>
        <span className="text-green-600">{fmt(upper_normal, precision_digits)}</span>
        {upper_alert != null && (
          <span className="text-destructive">{fmt(upper_alert, precision_digits)}</span>
        )}
        {unit && <span>{unit}</span>}
      </div>
    </div>
  )
}

type ViewMode = 'cards' | 'table'

export function DeviceTypesList() {
  const { currentOrganization } = useOrganization()
  const { data: deviceTypes, isLoading, error } = useDeviceTypesQuery(currentOrganization?.id)
  const deleteMutation = useDeleteDeviceTypeMutation()

  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<DeviceType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeviceType | null>(null)
  const [deleteDeviceCount, setDeleteDeviceCount] = useState<number | null>(null)
  const [checkingDevices, setCheckingDevices] = useState(false)

  // Debug logging
  console.log('[DeviceTypesList] Org ID:', currentOrganization?.id)
  console.log('[DeviceTypesList] Device types:', deviceTypes?.length ?? 0)
  console.log('[DeviceTypesList] Loading:', isLoading)
  console.log('[DeviceTypesList] Error:', error)

  // When a delete target is set, check how many devices reference it
  useEffect(() => {
    if (!deleteTarget) {
      setDeleteDeviceCount(null)
      return
    }
    let cancelled = false
    async function check() {
      setCheckingDevices(true)
      try {
        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count, error } = await (supabase as any)
          .from('devices')
          .select('id', { count: 'exact', head: true })
          .eq('device_type_id', deleteTarget!.id)
        if (!cancelled) {
          setDeleteDeviceCount(error ? 0 : (count ?? 0))
        }
      } catch {
        if (!cancelled) setDeleteDeviceCount(0)
      } finally {
        if (!cancelled) setCheckingDevices(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [deleteTarget])

  function handleEdit(dt: DeviceType) {
    setEditingType(dt)
    setEditDialogOpen(true)
  }

  function handleEditDialogClose(open: boolean) {
    setEditDialogOpen(open)
    if (!open) setEditingType(null)
  }

  async function handleDelete() {
    if (!deleteTarget || !currentOrganization) return
    try {
      await deleteMutation.mutateAsync({
        id: deleteTarget.id,
        organizationId: currentOrganization.id,
      })
    } finally {
      setDeleteTarget(null)
    }
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <div className="flex gap-2 mb-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-16 w-full mb-3" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <p>Failed to load device types: {error.message}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (!deviceTypes?.length) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="text-center space-y-3">
            <PackageOpen className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="text-lg font-semibold">No device types defined</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Device types let you define normal operating ranges and alert thresholds
              for different sensor categories. Create your first device type to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* View Mode Toggle */}
      <div className="flex items-center justify-end space-x-2 mb-4">
        <Button
          variant={viewMode === 'cards' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('cards')}
        >
          <Grid3x3 className="h-4 w-4 mr-1" />
          Cards
        </Button>
        <Button
          variant={viewMode === 'table' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('table')}
        >
          <Table2 className="h-4 w-4 mr-1" />
          Table
        </Button>
      </div>

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {deviceTypes.map(dt => (
          <Card key={dt.id} className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              {/* Header with name and actions */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{dt.name}</h3>
                  {dt.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {dt.description}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(dt)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteTarget(dt)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 mb-4">
                {dt.device_class ? (
                  <Badge variant="secondary" className="text-xs">
                    {getClassLabel(dt.device_class)}
                  </Badge>
                ) : null}
                {dt.unit ? (
                  <Badge variant="outline" className="font-mono text-xs">
                    {dt.unit}
                  </Badge>
                ) : null}
              </div>

              {/* Normal Range Section */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Normal Range</p>
                  </div>
                  <RangeBar type={dt} />
                </div>

                {/* Alert Thresholds */}
                {(dt.lower_alert != null || dt.upper_alert != null) && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <p className="text-sm font-medium">Alert Thresholds</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Low:</span>{' '}
                        <span className="font-mono">
                          {dt.lower_alert != null
                            ? `${fmt(dt.lower_alert, dt.precision_digits)} ${dt.unit || ''}`
                            : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">High:</span>{' '}
                        <span className="font-mono">
                          {dt.upper_alert != null
                            ? `${fmt(dt.upper_alert, dt.precision_digits)} ${dt.unit || ''}`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Precision info */}
                <div className="pt-3 border-t text-xs text-muted-foreground">
                  <span>Precision: {dt.precision_digits} decimal{dt.precision_digits !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead className="w-[120px]">Class</TableHead>
                  <TableHead className="w-[80px] text-center">Unit</TableHead>
                  <TableHead className="min-w-[200px]">Range</TableHead>
                  <TableHead className="w-[120px] text-center">Alert Thresholds</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deviceTypes.map(dt => (
                  <TableRow key={dt.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{dt.name}</p>
                        {dt.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {dt.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {dt.device_class ? (
                        <Badge variant="secondary" className="text-xs">
                          {getClassLabel(dt.device_class)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {dt.unit ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {dt.unit}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Gauge className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-[160px]">
                          <RangeBar type={dt} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {dt.lower_alert != null || dt.upper_alert != null ? (
                        <div className="flex items-center justify-center gap-1">
                          <Ruler className="h-3.5 w-3.5 text-destructive" />
                          <span className="text-xs font-mono">
                            {fmt(dt.lower_alert, dt.precision_digits)}
                            {' / '}
                            {fmt(dt.upper_alert, dt.precision_digits)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(dt)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(dt)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <DeviceTypeFormDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        editingType={editingType}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device Type</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
                  This action cannot be undone.
                </p>
                {checkingDevices && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking assigned devices...
                  </p>
                )}
                {!checkingDevices && deleteDeviceCount != null && deleteDeviceCount > 0 && (
                  <p className="text-destructive font-medium">
                    ⚠️ {deleteDeviceCount} device{deleteDeviceCount !== 1 ? 's are' : ' is'} currently
                    assigned to this type. Their device_type_id will be set to NULL.
                  </p>
                )}
                {!checkingDevices && deleteDeviceCount === 0 && (
                  <p className="text-muted-foreground">
                    No devices are currently assigned to this type.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={checkingDevices}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
