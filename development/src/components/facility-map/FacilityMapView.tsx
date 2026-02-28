'use client'

/**
 * FacilityMapView — Main orchestration component for the Facilities Map feature.
 * Loads maps, devices, and placements; manages state for the canvas, palette,
 * and map CRUD. Supports real-time device status via Supabase subscriptions.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Map as MapIcon,
  Plus,
  Edit2,
  Trash2,
  Eye,
  MoreVertical,
  Building2,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Filter,
  X,
  PenTool,
  Flame,
  Layers,
  Info,
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
  MapZone,
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
  const [mapPlacementCounts, setMapPlacementCounts] = useState<Record<string, number>>({})
  const [telemetryMap, setTelemetryMap] = useState<Record<string, Record<string, unknown>>>({})
  const [viewMode, _setViewMode] = useState<'single' | 'collage'>(() => {
    if (typeof window === 'undefined') return 'single'
    try {
      const saved = localStorage.getItem('facility-map-view-mode')
      if (saved === 'collage') return 'collage'
    } catch { /* ignore */ }
    return 'single'
  })
  const setViewMode = useCallback((m: 'single' | 'collage') => {
    _setViewMode(m)
    try { localStorage.setItem('facility-map-view-mode', m) } catch { /* ignore */ }
  }, [])
  const [isCollageFullscreen, setIsCollageFullscreen] = useState(false)
  /** Persistent display options (stored in localStorage) */
  const [mapDisplayOpts, setMapDisplayOpts] = useState(() => {
    if (typeof window === 'undefined') return { deviceName: false, deviceType: false, location: false, deviceCount: false }
    try {
      const saved = localStorage.getItem('facility-map-display')
      if (saved) return JSON.parse(saved) as Record<string, boolean>
    } catch { /* ignore */ }
    return { deviceName: false, deviceType: false, location: false, deviceCount: false }
  })
  /** All placements across all maps, keyed by map id */
  const [allPlacements, setAllPlacements] = useState<Record<string, DeviceMapPlacement[]>>({})
  /** Device type filter — hidden device types */
  const [hiddenDeviceTypes, setHiddenDeviceTypes] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const saved = localStorage.getItem('facility-map-hidden-types')
      if (saved) return new Set(JSON.parse(saved) as string[])
    } catch { /* ignore */ }
    return new Set()
  })

  /** Zones for the current map */
  const [zones, setZones] = useState<MapZone[]>([])
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [zoneDrawing, setZoneDrawing] = useState(false)
  const [showZones, setShowZones] = useState(true)
  /** Heatmap metric (null = off) */
  const [heatmapMetric, setHeatmapMetric] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(true)

  const router = useRouter()
  const collageFullscreenRef = useRef<HTMLDivElement | null>(null)

  // Helper to toggle a display option and persist to localStorage
  const toggleDisplayOpt = useCallback((key: string) => {
    setMapDisplayOpts((prev) => {
      const next = { ...prev, [key]: !prev[key as keyof typeof prev] }
      try { localStorage.setItem('facility-map-display', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  // Device type filter helpers
  const toggleDeviceType = useCallback((deviceType: string) => {
    setHiddenDeviceTypes((prev) => {
      const next = new Set(prev)
      if (next.has(deviceType)) next.delete(deviceType)
      else next.add(deviceType)
      try { localStorage.setItem('facility-map-hidden-types', JSON.stringify([...next])) } catch { /* ignore */ }
      return next
    })
  }, [])

  const showAllDeviceTypes = useCallback(() => {
    setHiddenDeviceTypes(new Set())
    try { localStorage.setItem('facility-map-hidden-types', '[]') } catch { /* ignore */ }
  }, [])

  const hideAllDeviceTypes = useCallback(() => {
    const allTypes = new Set(devices.map((d) => d.device_type).filter(Boolean))
    setHiddenDeviceTypes(allTypes)
    try { localStorage.setItem('facility-map-hidden-types', JSON.stringify([...allTypes])) } catch { /* ignore */ }
  }, [devices])

  // Compute device types with counts from currently placed devices
  const deviceTypeChips = useMemo(() => {
    const typeCounts: Record<string, number> = {}
    const allPlacedDevices = placements.map((p) => p.device).filter(Boolean)
    for (const d of allPlacedDevices) {
      const t = d?.device_type || 'Unknown'
      typeCounts[t] = (typeCounts[t] || 0) + 1
    }
    return Object.entries(typeCounts).sort((a, b) => a[0].localeCompare(b[0]))
  }, [placements])

  // Filtered placements (respects device type filter)
  const filteredPlacements = useMemo(() =>
    placements.filter((p) => !hiddenDeviceTypes.has(p.device?.device_type || 'Unknown')),
    [placements, hiddenDeviceTypes]
  )

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

  // Load device counts per map for thumbnail badges
  const loadMapPlacementCounts = useCallback(async () => {
    if (maps.length === 0) return
    try {
      const { data, error } = await supabaseRef.current
        .from('device_map_placements')
        .select('facility_map_id')
        .in('facility_map_id', maps.map((m: { id: string }) => m.id))

      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data || []) {
        counts[row.facility_map_id] = (counts[row.facility_map_id] || 0) + 1
      }
      setMapPlacementCounts(counts)
    } catch (err) {
      console.error('Failed to load placement counts:', err)
    }
  }, [maps])

  // Load all placements across all maps for collage view
  const loadAllPlacements = useCallback(async () => {
    if (maps.length === 0) return
    try {
      const { data, error } = await supabaseRef.current
        .from('device_map_placements')
        .select(`
          *,
          device:devices(id, name, device_type, status, battery_level, signal_strength, last_seen)
        `)
        .in('facility_map_id', maps.map((m: { id: string }) => m.id))

      if (error) throw error
      const grouped: Record<string, DeviceMapPlacement[]> = {}
      for (const row of (data || []) as DeviceMapPlacement[]) {
        if (!grouped[row.facility_map_id]) grouped[row.facility_map_id] = []
        grouped[row.facility_map_id]!.push(row)
      }
      setAllPlacements(grouped)
    } catch (err) {
      console.error('Failed to load all placements:', err)
    }
  }, [maps])

  // Load latest telemetry for placed devices (shown in marker tooltips)
  const loadTelemetry = useCallback(async () => {
    if (placements.length === 0) {
      setTelemetryMap({})
      return
    }
    const deviceIds = [...new Set(placements.map((p) => p.device_id))]
    try {
      const { data, error } = await supabaseRef.current
        .from('device_telemetry_history')
        .select('device_id, telemetry, received_at')
        .in('device_id', deviceIds)
        .order('received_at', { ascending: false })
        .limit(deviceIds.length * 2)

      if (error) throw error
      const map: Record<string, Record<string, unknown>> = {}
      for (const row of data || []) {
        if (!map[row.device_id]) {
          map[row.device_id] = row.telemetry as Record<string, unknown>
        }
      }
      setTelemetryMap(map)
    } catch (err) {
      console.error('Failed to load telemetry:', err)
    }
  }, [placements])

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

  // Load placement counts when maps or placements change
  useEffect(() => {
    loadMapPlacementCounts()
  }, [loadMapPlacementCounts, placements])

  // Load all placements for collage view
  useEffect(() => {
    loadAllPlacements()
  }, [loadAllPlacements, placements])

  // Load telemetry when placements change
  useEffect(() => {
    loadTelemetry()
  }, [loadTelemetry])

  // --- Zones ---
  const loadZones = useCallback(async () => {
    if (!selectedMapId) { setZones([]); return }
    try {
      const { data, error } = await supabaseRef.current
        .from('facility_map_zones')
        .select('*')
        .eq('facility_map_id', selectedMapId)
        .order('z_order', { ascending: true })

      if (error) throw error
      setZones((data || []) as MapZone[])
    } catch (err) {
      console.error('Failed to load zones:', err)
    }
  }, [selectedMapId])

  useEffect(() => { loadZones() }, [loadZones])

  const handleCreateZone = useCallback(async (points: { x: number; y: number }[]) => {
    if (!selectedMapId || points.length < 3) return
    setZoneDrawing(false)
    const name = prompt('Zone name:')
    if (!name) return
    const color = prompt('Zone color (hex, e.g. #3B82F6):', '#3B82F6') || '#3B82F6'
    try {
      const { error } = await supabaseRef.current
        .from('facility_map_zones')
        .insert({
          facility_map_id: selectedMapId,
          name,
          color,
          points,
          z_order: zones.length,
        })
      if (error) throw error
      toast.success(`Zone "${name}" created`)
      await loadZones()
    } catch (err) {
      console.error('Create zone error:', err)
      toast.error('Failed to create zone')
    }
  }, [selectedMapId, zones.length, loadZones])

  const handleDeleteZone = useCallback(async () => {
    if (!selectedZoneId) return
    try {
      const { error } = await supabaseRef.current
        .from('facility_map_zones')
        .delete()
        .eq('id', selectedZoneId)
      if (error) throw error
      setSelectedZoneId(null)
      toast.success('Zone deleted')
      await loadZones()
    } catch (err) {
      console.error('Delete zone error:', err)
      toast.error('Failed to delete zone')
    }
  }, [selectedZoneId, loadZones])

  const handleDeleteZoneById = useCallback(async (zoneId: string) => {
    try {
      const { error } = await supabaseRef.current
        .from('facility_map_zones')
        .delete()
        .eq('id', zoneId)
      if (error) throw error
      if (selectedZoneId === zoneId) setSelectedZoneId(null)
      toast.success('Zone deleted')
      await loadZones()
    } catch (err) {
      console.error('Delete zone error:', err)
      toast.error('Failed to delete zone')
    }
  }, [selectedZoneId, loadZones])

  // --- Heatmap available metrics ---
  const availableMetrics = useMemo(() => {
    const metrics = new Set<string>()
    for (const tele of Object.values(telemetryMap)) {
      for (const [key, val] of Object.entries(tele)) {
        if (typeof val === 'number') metrics.add(key)
      }
    }
    return [...metrics].sort()
  }, [telemetryMap])

  // Collage fullscreen toggle
  const toggleCollageFullscreen = useCallback(() => {
    if (!collageFullscreenRef.current) return
    if (!document.fullscreenElement) {
      collageFullscreenRef.current.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handler = () => setIsCollageFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Arrow navigation helpers
  const selectedMapIndex = maps.findIndex((m) => m.id === selectedMapId)
  const canGoPrev = selectedMapIndex > 0
  const canGoNext = selectedMapIndex < maps.length - 1 && selectedMapIndex >= 0
  const goToPrevMap = () => {
    if (canGoPrev && maps[selectedMapIndex - 1]) {
      setSelectedMapId(maps[selectedMapIndex - 1]!.id)
      setMode('view')
      setDeviceToPlace(null)
      setSelectedPlacementId(null)
    }
  }
  const goToNextMap = () => {
    if (canGoNext && maps[selectedMapIndex + 1]) {
      setSelectedMapId(maps[selectedMapIndex + 1]!.id)
      setMode('view')
      setDeviceToPlace(null)
      setSelectedPlacementId(null)
    }
  }

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

        // Bulk placement: auto-select next unplaced device
        const allPlacedIds = new Set([...placements.map((p) => p.device_id), deviceId])
        const nextUnplaced = devices.find((d) => !allPlacedIds.has(d.id))
        if (nextUnplaced) {
          setDeviceToPlace(nextUnplaced.id)
          // Stay in 'place' mode
          const remaining = devices.filter((d) => !allPlacedIds.has(d.id)).length - 1
          toast.success(
            remaining > 0
              ? `Device placed! ${remaining} more available to place`
              : 'Device placed! Last device ready to place'
          )
        } else {
          setDeviceToPlace(null)
          setMode('edit')
          toast.success('All devices placed on map!')
        }
      } catch (err) {
        console.error('Place device error:', err)
        toast.error('Failed to place device')
      }
    },
    [selectedMapId, devices, placements]
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
              <MapIcon className="h-12 w-12 text-muted-foreground" />
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

  return (
    <div className="space-y-4">
      {/* Top bar: View mode toggle + Mode toggle + actions */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Single / Collage toggle */}
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          <Button
            variant={viewMode === 'single' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setViewMode('single')
              if (!selectedMapId && maps.length > 0) setSelectedMapId(maps[0]!.id)
            }}
          >
            <ImageIcon className="mr-1 h-3 w-3" />
            Single
          </Button>
          <Button
            variant={viewMode === 'collage' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('collage')}
          >
            <Grid2X2 className="mr-1 h-3 w-3" />
            Collage
          </Button>
        </div>

        {/* Map thumbnails + Add Map */}
        {maps.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {maps.map((m) => (
              <button
                key={m.id}
                className={`relative h-9 w-14 shrink-0 overflow-hidden rounded border transition-all ${
                  m.id === selectedMapId && viewMode === 'single'
                    ? 'ring-2 ring-primary border-primary'
                    : 'border-muted hover:border-foreground/30'
                }`}
                onClick={() => {
                  setSelectedMapId(m.id)
                  setViewMode('single')
                  setMode('view')
                  setDeviceToPlace(null)
                  setSelectedPlacementId(null)
                }}
                title={m.name}
              >
                {m.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image_url}
                    alt={m.name}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <MapIcon className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                {(mapPlacementCounts[m.id] || 0) > 0 && (
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[8px] font-medium text-white">
                    {mapPlacementCounts[m.id]}
                  </span>
                )}
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 border border-dashed px-2 text-xs"
              onClick={() => {
                setEditingMap(null)
                setDialogOpen(true)
              }}
            >
              <Plus className="mr-1 h-3 w-3" /> Add New Map
            </Button>
          </div>
        )}

        {/* Edit mode toggle (only in single view with a selected map) */}
        {viewMode === 'single' && selectedMap && (
          <Button
            variant={mode === 'view' ? 'outline' : 'default'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              if (mode === 'view') {
                setMode('edit')
                setDeviceToPlace(null)
              } else {
                setMode('view')
                setDeviceToPlace(null)
                setSelectedPlacementId(null)
              }
            }}
          >
            {mode === 'view' ? (
              <><Plus className="mr-1 h-3 w-3" />Add Devices to Map</>            ) : (
              <><Eye className="mr-1 h-3 w-3" />Done Editing</>            )}
          </Button>
        )}



        {/* Show device name labels checkbox (single view) */}
        {viewMode === 'single' && selectedMap && (
          <div className="flex flex-wrap items-center gap-3">
            {([
              ['deviceName', 'Device Name'],
              ['deviceType', 'Device Type'],
              ['location', 'Location'],
              ['deviceCount', 'Device Count'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <Checkbox
                  id={`opt-${key}`}
                  checked={!!mapDisplayOpts[key as keyof typeof mapDisplayOpts]}
                  onCheckedChange={() => toggleDisplayOpt(key)}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor={`opt-${key}`} className="text-xs cursor-pointer select-none">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        )}

        {/* Collage display options */}
        {viewMode === 'collage' && (
          <div className="flex flex-wrap items-center gap-3">
            {([
              ['deviceName', 'Device Name'],
              ['deviceType', 'Device Type'],
              ['location', 'Location'],
              ['deviceCount', 'Device Count'],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <Checkbox
                  id={`opt-col-${key}`}
                  checked={!!mapDisplayOpts[key as keyof typeof mapDisplayOpts]}
                  onCheckedChange={() => toggleDisplayOpt(key)}
                  className="h-3.5 w-3.5"
                />
                <Label htmlFor={`opt-col-${key}`} className="text-xs cursor-pointer select-none">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        )}

        {/* Collage fullscreen button */}
        {viewMode === 'collage' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={toggleCollageFullscreen}
          >
            {isCollageFullscreen ? <Minimize2 className="mr-1 h-3 w-3" /> : <Maximize2 className="mr-1 h-3 w-3" />}
            {isCollageFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </Button>
        )}



        {/* Map title + actions (single view) */}
        {viewMode === 'single' && selectedMap && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm font-medium">{selectedMap.name}</span>
            <span className="text-xs text-muted-foreground">{selectedMapIndex + 1}/{maps.length}</span>
            {selectedMap.floor_level !== 0 && (
              <Badge variant="outline" className="text-[10px]">Floor {selectedMap.floor_level}</Badge>
            )}
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
        )}

        {/* Map counter (collage) */}
        {viewMode === 'collage' && (
          <span className="ml-auto text-sm text-muted-foreground">{maps.length} map{maps.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* === SINGLE VIEW === */}
      {viewMode === 'single' && selectedMap && (
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            {/* Map with left/right arrows */}
            <div className="relative">
              {/* Left arrow */}
              {canGoPrev && (
                <button
                  className="absolute left-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white shadow-lg transition-colors hover:bg-black/70"
                  onClick={goToPrevMap}
                  title={`Previous: ${maps[selectedMapIndex - 1]?.name}`}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {/* Right arrow */}
              {canGoNext && (
                <button
                  className="absolute right-2 top-1/2 z-30 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white shadow-lg transition-colors hover:bg-black/70"
                  onClick={goToNextMap}
                  title={`Next: ${maps[selectedMapIndex + 1]?.name}`}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              <Card className="overflow-hidden">
                <FacilityMapCanvas
                  facilityMap={selectedMap}
                  placements={filteredPlacements}
                  availableDevices={devices}
                  mode={mode === 'place' ? 'place' : mode}
                  selectedPlacementId={selectedPlacementId}
                  deviceToPlace={deviceToPlace}
                  onPlaceDevice={handlePlaceDevice}
                  onMovePlacement={handleMovePlacement}
                  onSelectPlacement={setSelectedPlacementId}
                  onRemovePlacement={handleRemovePlacement}
                  onDeviceNavigate={(deviceId) => router.push(`/dashboard/devices/view?id=${deviceId}`)}
                  telemetryMap={telemetryMap}
                  showLabels={mapDisplayOpts.deviceName}
                  showDeviceType={mapDisplayOpts.deviceType}
                  showDeviceCount={mapDisplayOpts.deviceCount}
                  showLocation={mapDisplayOpts.location}
                  zones={showZones ? zones : []}
                  zoneEditMode={mode === 'edit' || mode === 'place'}
                  selectedZoneId={selectedZoneId}
                  onSelectZone={setSelectedZoneId}
                  onCreateZone={handleCreateZone}
                  zoneDrawing={zoneDrawing}
                  heatmapMetric={showHeatmap ? heatmapMetric : null}
                  statusBarExtra={
                    <>
                      {/* Device type filter chips */}
                      {deviceTypeChips.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Filter className="h-3 w-3 text-muted-foreground" />
                          {deviceTypeChips.map(([type, count]) => {
                            const isHidden = hiddenDeviceTypes.has(type)
                            return (
                              <button
                                key={type}
                                onClick={() => toggleDeviceType(type)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-all ${
                                  isHidden
                                    ? 'border-muted bg-muted/50 text-muted-foreground line-through opacity-60'
                                    : 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20'
                                }`}
                              >
                                {type} ({count})
                                {isHidden && <X className="h-2.5 w-2.5" />}
                              </button>
                            )
                          })}
                          {hiddenDeviceTypes.size > 0 && (
                            <button onClick={showAllDeviceTypes} className="text-[10px] text-primary underline hover:no-underline">Show All</button>
                          )}
                          {hiddenDeviceTypes.size === 0 && deviceTypeChips.length > 2 && (
                            <button onClick={hideAllDeviceTypes} className="text-[10px] text-muted-foreground underline hover:no-underline">Hide All</button>
                          )}
                        </div>
                      )}

                      {/* Heatmap + Zone controls box — right-aligned, two rows */}
                      {(availableMetrics.length > 0 || zones.length > 0 || mode === 'edit' || mode === 'place') && (
                        <div className="ml-auto flex flex-col items-end gap-0.5 rounded border bg-muted/20 px-2 py-1">
                          {/* Row 1: Heatmap */}
                          {availableMetrics.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant={heatmapMetric ? 'default' : 'outline'}
                                size="sm"
                                className={`h-6 text-[10px] px-2 ${heatmapMetric ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                                onClick={() => setHeatmapMetric(heatmapMetric ? null : availableMetrics[0]!)}
                              >
                                <Flame className="mr-1 h-3 w-3" />
                                Heatmap
                              </Button>
                              {heatmapMetric && (
                                <select
                                  value={heatmapMetric}
                                  onChange={(e) => setHeatmapMetric(e.target.value)}
                                  className="h-6 rounded border bg-background px-1 text-[10px]"
                                >
                                  {availableMetrics.map((m) => (
                                    <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                                  ))}
                                </select>
                              )}
                              {heatmapMetric && (
                                <div className="flex items-center gap-1">
                                  <Checkbox
                                    id="toggle-heatmap-vis"
                                    checked={showHeatmap}
                                    onCheckedChange={() => setShowHeatmap(!showHeatmap)}
                                    className="h-3 w-3"
                                  />
                                  <Label htmlFor="toggle-heatmap-vis" className="text-[10px] cursor-pointer">Show</Label>
                                </div>
                              )}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-[10px] text-muted-foreground flex items-center gap-0.5 hover:text-foreground">
                                    <Info className="h-3 w-3" /> Help
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="left" className="w-72 text-xs space-y-2">
                                  <p className="font-semibold">Heatmap Overlay</p>
                                  <p className="text-muted-foreground">The heatmap uses <strong>Inverse Distance Weighting (IDW)</strong> to interpolate telemetry values between device positions.</p>
                                  <div className="flex items-center gap-1">
                                    <span className="h-3 w-3 rounded-sm bg-blue-500" />
                                    <span className="text-muted-foreground">Low</span>
                                    <span className="h-3 w-3 rounded-sm bg-cyan-400" />
                                    <span className="h-3 w-3 rounded-sm bg-green-500" />
                                    <span className="text-muted-foreground">Mid</span>
                                    <span className="h-3 w-3 rounded-sm bg-yellow-400" />
                                    <span className="h-3 w-3 rounded-sm bg-red-500" />
                                    <span className="text-muted-foreground">High</span>
                                  </div>
                                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li>Select a metric from the dropdown</li>
                                    <li>Requires 2+ devices with numeric telemetry</li>
                                    <li>Use the <strong>Show</strong> checkbox to toggle visibility</li>
                                  </ul>
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}

                          {/* Row 2: Zone */}
                          <div className="flex items-center gap-1.5">
                            {(mode === 'edit' || mode === 'place') && (
                              <Button
                                variant={zoneDrawing ? 'default' : 'outline'}
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => setZoneDrawing(!zoneDrawing)}
                              >
                                <PenTool className="mr-1 h-3 w-3" />
                                {zoneDrawing ? 'Cancel' : 'Draw Zone'}
                              </Button>
                            )}
                            {zones.length > 0 && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                                    <Layers className="h-3 w-3" />{zones.length} zone{zones.length !== 1 ? 's' : ''}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="left" className="w-56 p-2">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold">Zones</span>
                                    <div className="flex items-center gap-1.5">
                                      <Checkbox
                                        id="toggle-zones-vis"
                                        checked={showZones}
                                        onCheckedChange={() => setShowZones(!showZones)}
                                        className="h-3 w-3"
                                      />
                                      <Label htmlFor="toggle-zones-vis" className="text-[10px] cursor-pointer">Show</Label>
                                    </div>
                                  </div>
                                  <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {zones.map((z) => (
                                      <div key={z.id} className="flex items-center justify-between rounded px-1.5 py-1 hover:bg-muted/50 group">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: z.color }} />
                                          <span className="text-[11px] truncate">{z.name}</span>
                                        </div>
                                        <button
                                          onClick={() => handleDeleteZoneById(z.id)}
                                          className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                          title={`Delete ${z.name}`}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                            {(mode === 'edit' || mode === 'place') && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-[10px] text-muted-foreground flex items-center gap-0.5 hover:text-foreground">
                                    <Info className="h-3 w-3" /> Help
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="left" className="w-64 text-xs space-y-2">
                                  <p className="font-semibold">How to Draw Zones</p>
                                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                    <li>Click <strong>Draw Zone</strong> to start</li>
                                    <li>Click on the map to place polygon points</li>
                                    <li>Double-click to finish the polygon</li>
                                    <li>Enter a name and color for the zone</li>
                                  </ol>
                                  <p className="text-muted-foreground">Click a zone to select it. Use the zone list to manage or delete zones.</p>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  }
                />
              </Card>

              {/* Map indicator dots */}
              {maps.length > 1 && (
                <div className="flex items-center justify-center gap-1.5 pt-2">
                  {maps.map((m) => (
                    <button
                      key={m.id}
                      className={`h-2 rounded-full transition-all ${
                        m.id === selectedMapId ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                      }`}
                      onClick={() => {
                        setSelectedMapId(m.id)
                        setMode('view')
                        setDeviceToPlace(null)
                        setSelectedPlacementId(null)
                      }}
                      title={m.name}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Device palette (only in edit mode) */}
            {(mode === 'edit' || mode === 'place') && (
              <div className="min-h-[300px] max-h-[520px]">
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
        </div>
      )}

      {/* Single view no map selected */}
      {viewMode === 'single' && !selectedMap && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-8 w-8 opacity-50" />
            <p>No map selected. Add a map below or switch to collage view.</p>
          </CardContent>
        </Card>
      )}

      {/* === COLLAGE VIEW === */}
      {viewMode === 'collage' && (
        <div
          ref={collageFullscreenRef}
          className={`grid gap-4 ${
            maps.length === 1
              ? 'grid-cols-1'
              : maps.length === 2
              ? 'grid-cols-2'
              : maps.length === 3
              ? 'grid-cols-3'
              : 'grid-cols-2 lg:grid-cols-4'
          } ${isCollageFullscreen ? 'bg-background p-4 overflow-hidden' : ''}`}
        >
          {maps.map((m) => {
            const mapPlacements = (allPlacements[m.id] || []).filter(
              (p) => !hiddenDeviceTypes.has(p.device?.device_type || 'Unknown')
            )
            return (
              <Card key={m.id} className="overflow-hidden relative">
                {/* Map label overlay — location only */}
                {mapDisplayOpts.location && m.location?.name && (
                <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
                  <Badge variant="outline" className="text-xs font-medium shadow-sm bg-background/90 backdrop-blur-sm">
                    {m.location.name}
                  </Badge>
                </div>
                )}
                <FacilityMapCanvas
                  facilityMap={m}
                  placements={mapPlacements}
                  availableDevices={devices}
                  mode="view"
                  selectedPlacementId={null}
                  deviceToPlace={null}
                  onPlaceDevice={() => {}}
                  onMovePlacement={() => {}}
                  onSelectPlacement={() => {}}
                  onRemovePlacement={() => {}}
                  onDeviceNavigate={(deviceId) => router.push(`/dashboard/devices/view?id=${deviceId}`)}
                  telemetryMap={telemetryMap}
                  showLabels={mapDisplayOpts.deviceName}
                  showDeviceType={mapDisplayOpts.deviceType}
                  showLocation={mapDisplayOpts.location}
                  compact
                  hideFullscreen
                />
              </Card>
            )
          })}
        </div>
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
