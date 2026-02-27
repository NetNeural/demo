/**
 * Type definitions for the Facilities Map feature
 */

export interface FacilityMap {
  id: string
  organization_id: string
  location_id: string | null
  name: string
  description: string | null
  floor_level: number
  image_url: string | null
  image_path: string | null
  image_width: number | null
  image_height: number | null
  is_active: boolean
  sort_order: number
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  created_by: string | null
  // Joined data
  location?: { id: string; name: string } | null
  placements?: DeviceMapPlacement[]
}

export interface DeviceMapPlacement {
  id: string
  facility_map_id: string
  device_id: string
  x_percent: number
  y_percent: number
  label: string | null
  icon_size: 'small' | 'medium' | 'large'
  rotation: number
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
  // Joined device data
  device?: PlacedDevice | null
}

export interface PlacedDevice {
  id: string
  name: string
  device_type: string
  status: 'online' | 'offline' | 'warning' | 'error' | 'maintenance'
  battery_level: number | null
  signal_strength: number | null
  last_seen: string | null
}

export interface MapViewport {
  scale: number
  offsetX: number
  offsetY: number
}

export type PlacementMode = 'view' | 'place' | 'edit'
