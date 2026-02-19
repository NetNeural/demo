/**
 * Device Type Selector
 * 
 * Reusable dropdown for selecting a device type from the organization's
 * configured types. Shows name, unit, and normal range in the options.
 * 
 * @see Issue #119
 */
'use client'

import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useDeviceTypesQuery } from '@/hooks/queries/useDeviceTypes'
import type { DeviceType } from '@/types/device-types'

interface DeviceTypeSelectorProps {
  value: string | null | undefined
  onValueChange: (typeId: string | null, deviceType: DeviceType | null) => void
  /** Show a "None" option to unassign */
  allowNone?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Custom placeholder */
  placeholder?: string
  /** Additional className */
  className?: string
}

export function DeviceTypeSelector({
  value,
  onValueChange,
  allowNone = true,
  disabled = false,
  placeholder = 'Select device type...',
  className,
}: DeviceTypeSelectorProps) {
  const { currentOrganization } = useOrganization()
  const { data: deviceTypes, isLoading } = useDeviceTypesQuery(currentOrganization?.id)

  const typesMap = useMemo(() => {
    const map = new Map<string, DeviceType>()
    deviceTypes?.forEach(dt => map.set(dt.id, dt))
    return map
  }, [deviceTypes])

  function handleChange(val: string) {
    if (val === '__none__') {
      onValueChange(null, null)
    } else {
      onValueChange(val, typesMap.get(val) || null)
    }
  }

  return (
    <Select
      value={value || (allowNone ? '__none__' : undefined)}
      onValueChange={handleChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? 'Loading...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value="__none__">
            <span className="text-muted-foreground">None (no device type)</span>
          </SelectItem>
        )}
        {deviceTypes?.map(dt => (
          <SelectItem key={dt.id} value={dt.id}>
            <span className="flex items-center gap-2">
              <span className="font-medium">{dt.name}</span>
              {dt.unit && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 font-mono">
                  {dt.unit}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {dt.lower_normal}–{dt.upper_normal}
              </span>
            </span>
          </SelectItem>
        ))}
        {!isLoading && (!deviceTypes || deviceTypes.length === 0) && (
          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
            No device types defined.
            <br />
            <span className="text-xs">Create one in Device Types page first.</span>
          </div>
        )}
      </SelectContent>
    </Select>
  )
}
