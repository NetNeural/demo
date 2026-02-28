/**
 * Device Type Selector
 *
 * Searchable dropdown for selecting a device type from the organization's
 * configured types. Shows name, unit, and normal range in the options.
 * Includes a search/filter input for quick lookup when the list is long.
 *
 * @see Issue #119
 * @see Issue #170 - Search/filter capability
 */
'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ChevronsUpDown, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useDeviceTypesQuery } from '@/hooks/queries/useDeviceTypes'
import type { DeviceType } from '@/types/device-types'
import { UNIT_FULL_NAMES } from '@/types/device-types'

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
  const { data: deviceTypes, isLoading } = useDeviceTypesQuery(
    currentOrganization?.id
  )
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const typesMap = useMemo(() => {
    const map = new Map<string, DeviceType>()
    deviceTypes?.forEach((dt) => map.set(dt.id, dt))
    return map
  }, [deviceTypes])

  /** Filter device types by search query (name, unit, or device class) */
  const filteredTypes = useMemo(() => {
    if (!deviceTypes) return []
    if (!search.trim()) return deviceTypes
    const q = search.toLowerCase().trim()
    return deviceTypes.filter(
      (dt) =>
        dt.name.toLowerCase().includes(q) ||
        dt.unit?.toLowerCase().includes(q) ||
        dt.device_class?.toLowerCase().includes(q) ||
        (dt.unit && UNIT_FULL_NAMES[dt.unit]?.toLowerCase().includes(q))
    )
  }, [deviceTypes, search])

  /** Get display label for selected value */
  const selectedType = value ? typesMap.get(value) : null
  const displayLabel = selectedType
    ? selectedType.name
    : allowNone && !value
      ? 'None (no device type)'
      : placeholder

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setSearch('')
    }
  }, [open])

  function handleSelect(typeId: string | null) {
    if (typeId === null) {
      onValueChange(null, null)
    } else {
      onValueChange(typeId, typesMap.get(typeId) || null)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            'w-full justify-between font-normal',
            !selectedType && !allowNone && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {isLoading ? 'Loading...' : displayLabel}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        {/* Search input */}
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            ref={searchInputRef}
            placeholder="Search device types..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="ml-1 rounded p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3 opacity-50" />
            </button>
          )}
        </div>

        {/* Options list */}
        <div className="max-h-[300px] overflow-y-auto p-1">
          {allowNone && (
            <button
              className={cn(
                'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                !value && 'bg-accent'
              )}
              onClick={() => handleSelect(null)}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  !value ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span className="text-muted-foreground">
                None (no device type)
              </span>
            </button>
          )}

          {filteredTypes.map((dt) => (
            <button
              key={dt.id}
              className={cn(
                'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                value === dt.id && 'bg-accent'
              )}
              onClick={() => handleSelect(dt.id)}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4 shrink-0',
                  value === dt.id ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span className="flex items-center gap-2">
                <span className="font-medium">{dt.name}</span>
                {dt.unit && (
                  <Badge
                    variant="outline"
                    className="px-1 py-0 font-mono text-[10px]"
                    title={UNIT_FULL_NAMES[dt.unit] || dt.unit}
                  >
                    {dt.unit}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {dt.lower_normal}–{dt.upper_normal}
                </span>
              </span>
            </button>
          ))}

          {filteredTypes.length === 0 && search && (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No device types matching &quot;{search}&quot;
            </div>
          )}

          {!isLoading && (!deviceTypes || deviceTypes.length === 0) && (
            <div className="px-2 py-3 text-center text-sm text-muted-foreground">
              No device types defined.
              <br />
              <span className="text-xs">
                Create one in Device Types page first.
              </span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
