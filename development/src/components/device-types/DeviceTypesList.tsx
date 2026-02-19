/**
 * Device Types List
 * 
 * Displays device types in a table with inline actions.
 * Supports edit, delete, and visual range indicators.
 * 
 * @see Issue #118
 */
'use client'

import { useState } from 'react'
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
  Ruler,
  PackageOpen,
} from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
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

export function DeviceTypesList() {
  const { currentOrganization } = useOrganization()
  const { data: deviceTypes, isLoading, error } = useDeviceTypesQuery(currentOrganization?.id)
  const deleteMutation = useDeleteDeviceTypeMutation()

  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingType, setEditingType] = useState<DeviceType | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeviceType | null>(null)

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
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-10 flex-1" />
                <Skeleton className="h-10 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
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
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              This action cannot be undone. Existing devices referencing this type
              will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
