/**
 * Device Type Form Dialog
 *
 * Full create/edit form with validation for device type configuration.
 * Supports normal ranges, alert thresholds, measurement metadata.
 *
 * Includes automatic unit conversion for measurement values when unit changes.
 *
 * @see Issue #118
 * @see Issue #167 - Unit conversion
 */
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, Info } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import {
  useCreateDeviceTypeMutation,
  useUpdateDeviceTypeMutation,
} from '@/hooks/queries/useDeviceTypes'
import {
  DEVICE_CLASSES,
  COMMON_UNITS,
  DEFAULT_DEVICE_TYPE_FORM,
  type DeviceType,
  type DeviceTypeFormValues,
  type DeviceTypePayload,
} from '@/types/device-types'
import { convertMeasurementValues, canConvertUnit } from '@/lib/unit-conversion'

interface DeviceTypeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingType?: DeviceType | null
}

interface ValidationErrors {
  name?: string
  lower_normal?: string
  upper_normal?: string
  lower_alert?: string
  upper_alert?: string
  precision_digits?: string
  general?: string
}

export function DeviceTypeFormDialog({
  open,
  onOpenChange,
  editingType,
}: DeviceTypeFormDialogProps) {
  const { currentOrganization } = useOrganization()
  const { user } = useUser()
  const createMutation = useCreateDeviceTypeMutation()
  const updateMutation = useUpdateDeviceTypeMutation()

  const [form, setForm] = useState<DeviceTypeFormValues>(
    DEFAULT_DEVICE_TYPE_FORM
  )
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [previousUnit, setPreviousUnit] = useState<string>('')
  const [showConversionMessage, setShowConversionMessage] = useState(false)

  const isEditing = !!editingType
  const isPending = createMutation.isPending || updateMutation.isPending

  // Populate form when editing
  useEffect(() => {
    if (editingType) {
      setForm({
        name: editingType.name,
        description: editingType.description || '',
        device_class: editingType.device_class || '',
        unit: editingType.unit || '',
        lower_normal: String(editingType.lower_normal),
        upper_normal: String(editingType.upper_normal),
        lower_alert:
          editingType.lower_alert != null
            ? String(editingType.lower_alert)
            : '',
        upper_alert:
          editingType.upper_alert != null
            ? String(editingType.upper_alert)
            : '',
        precision_digits: String(editingType.precision_digits),
        icon: editingType.icon || '',
      })
      setPreviousUnit(editingType.unit || '')
    } else {
      setForm(DEFAULT_DEVICE_TYPE_FORM)
      setPreviousUnit('')
    }
    setErrors({})
    setShowConversionMessage(false)
  }, [editingType, open])

  // Handle unit changes - convert measurement values
  useEffect(() => {
    // Only convert if:
    // 1. It's not a new device type (has previous unit set)
    // 2. Unit actually changed
    // 3. Conversion is available and has valid values
    if (
      !previousUnit ||
      form.unit === previousUnit ||
      !form.lower_normal ||
      !form.upper_normal
    ) {
      return undefined
    }

    if (!canConvertUnit(previousUnit, form.unit)) {
      // Conversion not available, just update previous unit
      setPreviousUnit(form.unit)
      return undefined
    }

    let cleanup: (() => void) | undefined

    try {
      const converted = convertMeasurementValues(
        form.lower_normal,
        form.upper_normal,
        form.lower_alert,
        form.upper_alert,
        previousUnit,
        form.unit
      )

      setForm((prev) => ({
        ...prev,
        lower_normal: converted.lowerNormal,
        upper_normal: converted.upperNormal,
        lower_alert: converted.lowerAlert,
        upper_alert: converted.upperAlert,
      }))

      setShowConversionMessage(true)
      // Hide message after 3 seconds
      const timer = setTimeout(() => setShowConversionMessage(false), 3000)
      cleanup = () => clearTimeout(timer)
    } catch {
      // Conversion failed, silent failure
    }

    setPreviousUnit(form.unit)
    return cleanup
  }, [
    form.unit,
    form.lower_normal,
    form.upper_normal,
    form.lower_alert,
    form.upper_alert,
    previousUnit,
  ])

  // Suggested units based on selected device class
  const suggestedUnits = useMemo(() => {
    if (!form.device_class) return COMMON_UNITS
    const cls = DEVICE_CLASSES.find((c) => c.value === form.device_class)
    return cls?.suggestedUnits?.length ? cls.suggestedUnits : COMMON_UNITS
  }, [form.device_class])

  const updateField = useCallback(
    <K extends keyof DeviceTypeFormValues>(
      field: K,
      value: DeviceTypeFormValues[K]
    ) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      // Clear field error on change
      setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }))
    },
    []
  )

  function validate(): boolean {
    const errs: ValidationErrors = {}

    // Name required
    const trimName = form.name.trim()
    if (!trimName) {
      errs.name = 'Name is required'
    } else if (trimName.length > 100) {
      errs.name = 'Name must be 100 characters or less'
    }

    // Normal range required
    const lowerNormal = parseFloat(form.lower_normal)
    const upperNormal = parseFloat(form.upper_normal)

    if (form.lower_normal === '' || isNaN(lowerNormal)) {
      errs.lower_normal = 'Lower normal value is required'
    }
    if (form.upper_normal === '' || isNaN(upperNormal)) {
      errs.upper_normal = 'Upper normal value is required'
    }
    if (
      !errs.lower_normal &&
      !errs.upper_normal &&
      lowerNormal >= upperNormal
    ) {
      errs.upper_normal = 'Must be greater than lower normal'
    }

    // Alert thresholds (optional but validated)
    if (form.lower_alert !== '') {
      const lowerAlert = parseFloat(form.lower_alert)
      if (isNaN(lowerAlert)) {
        errs.lower_alert = 'Must be a valid number'
      } else if (!errs.lower_normal && lowerAlert > lowerNormal) {
        errs.lower_alert = 'Must be ≤ lower normal'
      }
    }
    if (form.upper_alert !== '') {
      const upperAlert = parseFloat(form.upper_alert)
      if (isNaN(upperAlert)) {
        errs.upper_alert = 'Must be a valid number'
      } else if (!errs.upper_normal && upperAlert < upperNormal) {
        errs.upper_alert = 'Must be ≥ upper normal'
      }
    }

    // Precision
    const precision = parseInt(form.precision_digits)
    if (isNaN(precision) || precision < 0 || precision > 6) {
      errs.precision_digits = 'Must be 0–6'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !currentOrganization) return

    const payload: DeviceTypePayload = {
      name: form.name.trim(),
      lower_normal: parseFloat(form.lower_normal),
      upper_normal: parseFloat(form.upper_normal),
      unit: form.unit || '',
      description: form.description.trim() || null,
      device_class: form.device_class || null,
      lower_alert: form.lower_alert ? parseFloat(form.lower_alert) : null,
      upper_alert: form.upper_alert ? parseFloat(form.upper_alert) : null,
      precision_digits: parseInt(form.precision_digits) || 2,
      icon: form.icon.trim() || null,
    }

    try {
      if (isEditing && editingType) {
        await updateMutation.mutateAsync({
          id: editingType.id,
          organizationId: currentOrganization.id,
          payload,
          userId: user?.id,
        })
      } else {
        await createMutation.mutateAsync({
          organizationId: currentOrganization.id,
          payload,
          userId: user?.id,
        })
      }
      onOpenChange(false)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save device type'
      if (message.includes('unique') || message.includes('duplicate')) {
        setErrors({ name: 'A device type with this name already exists' })
      } else {
        setErrors({ general: message })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Device Type' : 'Create Device Type'}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the configuration for this device type.'
                : 'Define a new device type with normal ranges and alert thresholds.'}
            </DialogDescription>
          </DialogHeader>

          {errors.general && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {errors.general}
            </div>
          )}

          {showConversionMessage && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <Info className="h-4 w-4 flex-shrink-0" />
              Normal Operating Range and Alert Thresholds have been
              automatically converted to the new unit.
            </div>
          )}

          <div className="grid gap-4 py-4">
            {/* ── Basic Info ── */}
            <div className="grid gap-2">
              <Label htmlFor="dt-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dt-name"
                placeholder="e.g., Indoor Temperature Sensor"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                className={errors.name ? 'border-destructive' : ''}
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dt-desc">Description</Label>
              <Textarea
                id="dt-desc"
                placeholder="Optional description of this device type..."
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
              />
            </div>

            <Separator />

            {/* ── Measurement Metadata ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dt-class">Device Class</Label>
                <Select
                  value={form.device_class}
                  onValueChange={(val) => updateField('device_class', val)}
                >
                  <SelectTrigger id="dt-class">
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_CLASSES.map((cls) => (
                      <SelectItem key={cls.value} value={cls.value}>
                        {cls.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dt-unit">Unit of Measurement</Label>
                <div className="flex gap-2">
                  <Input
                    id="dt-unit"
                    placeholder="e.g., °C"
                    value={form.unit}
                    onChange={(e) => updateField('unit', e.target.value)}
                    className="flex-1"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {suggestedUnits.map((u) => (
                    <Badge
                      key={u}
                      variant={form.unit === u ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => updateField('unit', u)}
                    >
                      {u}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dt-precision">Decimal Places</Label>
                <Input
                  id="dt-precision"
                  type="number"
                  min={0}
                  max={6}
                  value={form.precision_digits}
                  onChange={(e) =>
                    updateField('precision_digits', e.target.value)
                  }
                  className={
                    errors.precision_digits ? 'border-destructive' : ''
                  }
                />
                {errors.precision_digits && (
                  <p className="text-sm text-destructive">
                    {errors.precision_digits}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dt-icon">Icon Name</Label>
                <Input
                  id="dt-icon"
                  placeholder="e.g., thermometer"
                  value={form.icon}
                  onChange={(e) => updateField('icon', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Lucide icon name (optional)
                </p>
              </div>
            </div>

            <Separator />

            {/* ── Normal Operating Range ── */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h4 className="text-sm font-semibold">
                  Normal Operating Range
                </h4>
                <span className="text-xs text-destructive">* required</span>
              </div>
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                Values within this range are considered healthy/normal.
                {form.unit && (
                  <span>
                    Values in <strong>{form.unit}</strong>.
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dt-lower-normal">Lower Normal</Label>
                  <Input
                    id="dt-lower-normal"
                    type="number"
                    step="any"
                    placeholder="e.g., 18"
                    value={form.lower_normal}
                    onChange={(e) =>
                      updateField('lower_normal', e.target.value)
                    }
                    className={errors.lower_normal ? 'border-destructive' : ''}
                  />
                  {errors.lower_normal && (
                    <p className="text-sm text-destructive">
                      {errors.lower_normal}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dt-upper-normal">Upper Normal</Label>
                  <Input
                    id="dt-upper-normal"
                    type="number"
                    step="any"
                    placeholder="e.g., 26"
                    value={form.upper_normal}
                    onChange={(e) =>
                      updateField('upper_normal', e.target.value)
                    }
                    className={errors.upper_normal ? 'border-destructive' : ''}
                  />
                  {errors.upper_normal && (
                    <p className="text-sm text-destructive">
                      {errors.upper_normal}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Alert Thresholds ── */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <h4 className="text-sm font-semibold">Alert Thresholds</h4>
                <Badge variant="outline" className="text-xs">
                  Optional
                </Badge>
              </div>
              <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                Critical thresholds trigger alerts when readings exceed these
                values.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dt-lower-alert">
                    Lower Alert (Critical Low)
                  </Label>
                  <Input
                    id="dt-lower-alert"
                    type="number"
                    step="any"
                    placeholder="e.g., 10"
                    value={form.lower_alert}
                    onChange={(e) => updateField('lower_alert', e.target.value)}
                    className={errors.lower_alert ? 'border-destructive' : ''}
                  />
                  {errors.lower_alert && (
                    <p className="text-sm text-destructive">
                      {errors.lower_alert}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Must be ≤ lower normal
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dt-upper-alert">
                    Upper Alert (Critical High)
                  </Label>
                  <Input
                    id="dt-upper-alert"
                    type="number"
                    step="any"
                    placeholder="e.g., 35"
                    value={form.upper_alert}
                    onChange={(e) => updateField('upper_alert', e.target.value)}
                    className={errors.upper_alert ? 'border-destructive' : ''}
                  />
                  {errors.upper_alert && (
                    <p className="text-sm text-destructive">
                      {errors.upper_alert}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Must be ≥ upper normal
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? 'Saving...'
                  : 'Creating...'
                : isEditing
                  ? 'Save Changes'
                  : 'Create Device Type'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
