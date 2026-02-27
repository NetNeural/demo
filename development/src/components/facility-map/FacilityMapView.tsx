'use client'

/**
 * FacilityMapView — Main orchestration component for the Facilities Map feature.
 * Loads maps, devices, and placements; manages state for the canvas, palette,
 * and map CRUD. Supports real-time device status via Supabase subscriptions.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import {
  Map,
  Plus,
  Edit2,
  Trash2,
  Eye,
  MousePointer2,
  MoreVertical,
  Building2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { FacilityMapCanvas } from './FacilityMapCanvas'
import { DevicePalette } from './DevicePalette'
import { MapManagerDialog } from './MapManagerDialog'
import type {
  FacilityMap,
  DeviceMapPlacement,
  PlacedDevice,
  PlacementMode,
} from '@/types/facility-map'

interface FacilityMapViewProps {
  organizationId: string
}

export function FacilityMapView({ organizationId }: FacilityMapViewProps) {
  // --- State ---
  const [maps, setMaps] = useState<FacilityMap[]>([])
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null)
  const [placements, setPlacements] = useState<DeviceMapPlacement[]>([])
  const [devices, setDevices] = useState<PlacedDevice[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  const [loading, setLoading] = useState(true)
  const [loadingDevices, setLoadingDevices] = useState(true)
  const [mode, setMode] = useState<PlacementMode>('view')
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(null)
  const [deviceToPlace, setDeviceToPlace] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMap, setEditingMap] = useState<FacilityMap | null>(null)
  const [deleteMapId, setDeleteMapId] = useState<string | null>(null)

  // Cast to any for new tables not yet in generated Database types
  // (will be resolved after running `supabase gen types`)
  const supabaseRef = useRef(createClient() as any)

  const selectedMap = maps.find((m) => m.id === selectedMapId) || null

  // --- Data Loading ---
  const loadMaps = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseRef.current
        .from('facility_maps')
        .select('*, location:locations(id, name)')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      const mapsData = (data || []) as FacilityMap[]
      setMaps(mapsData)

      // Auto-select first map if none selected
      if (!selectedMapId && mapsData.length > 0) {
        setSelectedMapId(mapsData[0]!.id)
      }
    } catch (err) {
      console.error('Failed to load facility maps:', err)
      toast.error('Failed to load facility maps')
    } finally {
      setLoading(false)
    }
  }, [organizationId, selectedMapId])

  const loadPlacements = useCallback(async () => {
    if (!selectedMapId) {
      setPlacements([])
      return
    }

    try {
      const { data, error } = await supabaseRef.current
        .from('device_map_placements')
        .select(`
          *,
          device:devices(id, name, device_type, status, battery_level, signal_strength, last_seen)
        `)
        .eq('facility_map_id', selectedMapId)

      if (error) throw error
      setPlacements((data || []) as DeviceMapPlacement[])
    } catch (err) {
      console.error('Failed to load placements:', err)
    }
  }, [selectedMapId])

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true)
    try {
      const { data, error } = await supabaseRef.current
        .from('devices')
        .select('id, name, device_type, status, battery_level, signal_strength, last_seen')
        .eq('organization_id', organizationId)
        .order('name')

      if (error) throw error
      setDevices((data || []) as PlacedDevice[])
    } catch (err) {
      console.error('Failed to load devices:', err)
    } finally {
      setLoadingDevices(false)
    }
  }, [organizationId])

  const loadLocations = useCallback(async () => {
    try {
      const { data } = await supabaseRef.current
        .from('locations')
        .select('id, name')
        .eq('organization_id', organizationId)
        .order('name')

      setLocations(data || [])
    } catch (err) {
      console.error('Failed to load locations:', err)
    }
  }, [organizationId])

  // Initial load
  useEffect(() => {
    loadMaps()
    loadDevices()
    loadLocations()
  }, [loadMaps, loadDevices, loadLocations])

  // Load placements when map changes
  useEffect(() => {
    loadPlacements()
  }, [loadPlacements])

  // Real-time device status subscription
  useEffect(() => {
    const channel = supabaseRef.current
      .channel('facility-map-devices')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'devices',
          filter: `organization_id=eq.${organizationId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const updated = payload.new as PlacedDevice
          setDevices((prev) =>
            prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d))
          )
          // Also update placement device data
          setPlacements((prev) =>
            prev.map((p) =>
              p.device_id === updated.id
                ? { ...p, device: { ...p.device!, ...updated } }
                : p
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabaseRef.current.removeChannel(channel)
    }
  }, [organizationId])

  // --- Map CRUD ---
  const handleSaveMap = useCallback(
    async (data: Partial<FacilityMap>) => {
      try {
        if (data.id) {
          // Update
          const { error } = await supabaseRef.current
            .from('facility_maps')
            .update({
              name: data.name,
              description: data.description,
              floor_level: data.floor_level,
              location_id: data.location_id === 'none' ? null : data.location_id,
              image_url: data.image_url,
              image_path: data.image_path,
              image_width: data.image_width,
              image_height: data.image_height,
            })
            .eq('id', data.id)

          if (error) throw error
          toast.success('Map updated')
        } else {
          // Create
          const { data: newMap, error } = await supabaseRef.current
            .from('facility_maps')
            .insert({
              organization_id: organizationId,
              name: data.name,
              description: data.description,
              floor_level: data.floor_level || 0,
              location_id: data.location_id === 'none' ? null : data.location_id,
              image_url: data.image_url,
              image_path: data.image_path,
              image_width: data.image_width,
              image_height: data.image_height,
            })
            .select()
            .single()

          if (error) throw error
          setSelectedMapId(newMap.id)
          toast.success('Map created')
        }

        await loadMaps()
      } catch (err) {
        console.error('Save map error:', err)
        toast.error('Failed to save map')
        throw err
      }
    },
    [organizationId, loadMaps]
  )

  const handleDeleteMap = useCallback(async () => {
    if (!deleteMapId) return
    try {
      const mapToDelete = maps.find((m) => m.id === deleteMapId)

      // Delete storage image
      if (mapToDelete?.image_path) {
        await supabaseRef.current.storage
          .from('facility-maps')
          .remove([mapToDelete.image_path])
          .catch(() => {})
      }

      const { error } = await supabaseRef.current
        .from('facility_maps')
        .delete()
        .eq('id', deleteMapId)

      if (error) throw error

      if (selectedMapId === deleteMapId) {
        setSelectedMapId(null)
      }
      setDeleteMapId(null)
      toast.success('Map deleted')
      await loadMaps()
    } catch (err) {
      console.error('Delete map error:', err)
      toast.error('Failed to delete map')
    }
  }, [deleteMapId, maps, selectedMapId, loadMaps])

  // --- Placement CRUD ---
  const handlePlaceDevice = useCallback(
    async (deviceId: string, xPercent: number, yPercent: number) => {
      if (!selectedMapId) return

      try {
        const { data, error } = await supabaseRef.current
          .from('device_map_placements')
          .insert({
            facility_map_id: selectedMapId,
            device_id: deviceId,
            x_percent: xPercent,
            y_percent: yPercent,
          })
          .select(`
            *,
            device:devices(id, name, device_type, status, battery_level, signal_strength, last_seen)
          `)
          .single()

        if (error) throw error

        setPlacements((prev) => [...prev, data as DeviceMapPlacement])
        setDeviceToPlace(null)
        setMode('edit')
        toast.success('Device placed on map')
      } catch (err) {
        console.error('Place device error:', err)
        toast.error('Failed to place device')
      }
    },
    [selectedMapId]
  )

  const handleMovePlacement = useCallback(
    async (placementId: string, xPercent: number, yPercent: number) => {
      try {
        const { error } = await supabaseRef.current
          .from('device_map_placements')
          .update({ x_percent: xPercent, y_percent: yPercent })
          .eq('id', placementId)

        if (error) throw error

        setPlacements((prev) =>
          prev.map((p) =>
            p.id === placementId ? { ...p, x_percent: xPercent, y_percent: yPercent } : p
          )
        )
      } catch (err) {
        console.error('Move placement error:', err)
        toast.error('Failed to update position')
      }
    },
    []
  )

  const handleRemovePlacement = useCallback(
    async (placementId: string) => {
      try {
        const { error } = await supabaseRef.current
          .from('device_map_placements')
          .delete()
          .eq('id', placementId)

        if (error) throw error

        setPlacements((prev) => prev.filter((p) => p.id !== placementId))
        if (selectedPlacementId === placementId) setSelectedPlacementId(null)
        toast.success('Device removed from map')
      } catch (err) {
        console.error('Remove placement error:', err)
        toast.error('Failed to remove device from map')
      }
    },
    [selectedPlacementId]
  )

  // --- Render ---
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    )
  }

  // Empty state — no maps yet
  if (maps.length === 0 && !loading) {
    return (
      <>
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Map className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No Facility Maps Yet</h3>
            <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
              Upload a floor plan or site image, then drag and drop devices to see their
              real-time status overlaid on your facility layout.
            </p>
            <Button
              onClick={() => {
                setEditingMap(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Map
            </Button>
          </CardContent>
        </Card>

        {/* Dialog must render even in empty state so it can open */}
        <MapManagerDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false)
            setEditingMap(null)
          }}
          onSave={handleSaveMap}
          map={editingMap}
          locations={locations}
          organizationId={organizationId}
        />
      </>
    )
  }

  // Also need imports for scrolling
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  return (
    <div className="space-y-4">
      {/* Horizontal scrolling map thumbnails */}
      <div className="flex items-center gap-3">
        <div
          ref={scrollContainerRef}
          className="flex flex-1 gap-3 overflow-x-auto pb-2 scrollbar-thin"
          style={{ scrollBehavior: 'smooth' }}
        >
          {maps.map((m) => (
            <button
              key={m.id}
              className={`group relative flex-shrink-0 rounded-lg border-2 transition-all ${
                selectedMapId === m.id
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-muted hover:border-primary/50'
              }`}
              onClick={() => {
                setSelectedMapId(m.id)
                setMode('view')
                setDeviceToPlace(null)
                setSelectedPlacementId(null)
              }}
              style={{ width: '140px' }}
            >
              {/* Thumbnail image */}
              <div className="h-20 w-full overflow-hidden rounded-t-md bg-muted">
                {m.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image_url}
                    alt={m.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Map className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
              </div>
              {/* Label */}
              <div className="px-2 py-1.5">
                <p className="truncate text-xs font-medium">{m.name}</p>
                {m.floor_level !== 0 && (
                  <p className="text-[10px] text-muted-foreground">Floor {m.floor_level}</p>
                )}
              </div>
              {/* Delete button on hover */}
              <button
                className="absolute right-1 top-1 hidden rounded-full bg-destructive/90 p-1 text-white group-hover:block"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteMapId(m.id)
                }}
                title="Delete map"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </button>
          ))}

          {/* Add new map card */}
          <button
            className="flex h-[104px] w-[140px] flex-shrink-0 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            onClick={() => {
              setEditingMap(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-6 w-6" />
            <span className="text-xs font-medium">Add Map</span>
          </button>
        </div>
      </div>

      {/* Mode toggle + actions bar */}
      {selectedMap && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border p-0.5">
            <Button
              variant={mode === 'view' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setMode('view')
                setDeviceToPlace(null)
                setSelectedPlacementId(null)
              }}
            >
              <Eye className="mr-1 h-3 w-3" />
              View
            </Button>
            <Button
              variant={mode === 'edit' || mode === 'place' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setMode('edit')
                setDeviceToPlace(null)
              }}
            >
              <MousePointer2 className="mr-1 h-3 w-3" />
              Edit
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingMap(selectedMap)
                    setDialogOpen(true)
                  }}
                >
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Map Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteMapId(selectedMap.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Map
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      {/* Main content area */}
      {selectedMap ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          {/* Map canvas */}
          <Card className="overflow-hidden">
            <FacilityMapCanvas
              facilityMap={selectedMap}
              placements={placements}
              availableDevices={devices}
              mode={mode === 'place' ? 'place' : mode}
              selectedPlacementId={selectedPlacementId}
              deviceToPlace={deviceToPlace}
              onPlaceDevice={handlePlaceDevice}
              onMovePlacement={handleMovePlacement}
              onSelectPlacement={setSelectedPlacementId}
              onRemovePlacement={handleRemovePlacement}
            />
          </Card>

          {/* Device palette (only in edit mode) */}
          {(mode === 'edit' || mode === 'place') && (
            <div className="min-h-[300px] max-h-[500px]">
              <DevicePalette
                devices={devices}
                placements={placements}
                deviceToPlace={deviceToPlace}
                onSelectToPlace={(id) => {
                  setDeviceToPlace(id)
                  setMode(id ? 'place' : 'edit')
                }}
                onRemovePlacement={handleRemovePlacement}
                loading={loadingDevices}
              />
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-8 w-8 opacity-50" />
            <p>Select a map from the thumbnails above</p>
          </CardContent>
        </Card>
      )}

      {/* Map creation / edit dialog */}
      <MapManagerDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditingMap(null)
        }}
        onSave={handleSaveMap}
        map={editingMap}
        locations={locations}
        organizationId={organizationId}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteMapId} onOpenChange={(o) => !o && setDeleteMapId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Facility Map?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the map, its floor plan image, and all device
              placements. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMap}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Map
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
