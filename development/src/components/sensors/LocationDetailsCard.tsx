'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MapPin, Edit2, X, Save, Loader2 } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Device } from '@/types/sensor-details'
import dynamic from 'next/dynamic'

// Dynamically import the map component (client-side only)
const LocationMap = dynamic(() => import('./LocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center rounded-lg bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
})

interface LocationDetailsCardProps {
  device: Device
}

interface Location {
  id: string
  name: string
  address?: string | null
  city?: string | null
  state?: string | null
  latitude?: number | null
  longitude?: number | null
}

export function LocationDetailsCard({ device }: LocationDetailsCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [loadingLocations, setLoadingLocations] = useState(true)

  // Form state
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    device.location_id || ''
  )
  const [installedAt, setInstalledAt] = useState<string>(
    (device.metadata?.installed_at as string) || ''
  )

  const fetchLocations = useCallback(async () => {
    if (!device.organization_id) {
      toast.error('Organization ID not found')
      setLoadingLocations(false)
      return
    }

    try {
      setLoadingLocations(true)
      const supabase = createClient()

      const { data, error } = await supabase
        .from('locations')
        .select('id, name, address, city, state, latitude, longitude')
        .eq('organization_id', device.organization_id)
        .order('name')

      if (error) throw error
      setLocations(data || [])
    } catch (error) {
      console.error('Error fetching locations:', error)
      toast.error('Failed to load locations')
    } finally {
      setLoadingLocations(false)
    }
  }, [device.organization_id])

  // Fetch locations on mount to display current location and enable map
  useEffect(() => {
    if (device.organization_id) {
      fetchLocations()
    } else {
      setLoadingLocations(false)
    }
  }, [device.organization_id, fetchLocations])

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const supabase = createClient()

      const updatePayload = {
        location_id: selectedLocationId || null,
        metadata: {
          ...device.metadata,
          installed_at: installedAt || null,
        },
        updated_at: new Date().toISOString(),
      }

      console.log('💾 [LocationDetailsCard] Saving location update:', {
        deviceId: device.id,
        selectedLocationId,
        updatePayload,
      })

      // Update device with new location and metadata
      const { error } = await supabase
        .from('devices')
        .update(updatePayload)
        .eq('id', device.id)

      if (error) throw error

      console.log('✅ [LocationDetailsCard] Location saved for device:', device.id)

      toast.success('Location details updated successfully')

      setIsEditing(false)

      // Brief delay so user sees the success toast before reload
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      console.error('Error updating location:', error)
      toast.error('Failed to update location details')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setSelectedLocationId(device.location_id || '')
    setInstalledAt((device.metadata?.installed_at as string) || '')
    setIsEditing(false)
  }

  // Get selected location display name
  const selectedLocation = locations.find(
    (loc) => loc.id === selectedLocationId
  )

  // Detect stale cross-org location_id (device was transferred but location_id wasn't cleared)
  // Only check after locations have actually loaded (length > 0 or loading finished with empty list)
  const isStaleLocation = !!(selectedLocationId && !loadingLocations && locations.length > 0 && !selectedLocation)

  // If the location_id is stale (cross-org), don't show the old location name
  const displayLocationName = isStaleLocation
    ? 'Not assigned'
    : selectedLocation?.name || (selectedLocationId ? device.location : null) || 'Not assigned'

  // Auto-clear stale location_id so the UI isn't stuck
  // Also persist the null to the database so it doesn't keep showing the old location
  useEffect(() => {
    if (isStaleLocation && !isEditing) {
      console.warn(
        '⚠️ [LocationDetailsCard] Stale location_id detected (likely from org transfer), clearing:',
        selectedLocationId
      )
      setSelectedLocationId('')

      // Persist the null location_id to the database
      const clearStaleLocation = async () => {
        try {
          const supabase = createClient()
          const { error } = await supabase
            .from('devices')
            .update({
              location_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', device.id)

          if (error) {
            console.error('Failed to clear stale location_id:', error)
          } else {
            console.log('✅ [LocationDetailsCard] Cleared stale location_id from database for device:', device.id)
          }
        } catch (err) {
          console.error('Error clearing stale location_id:', err)
        }
      }
      clearStaleLocation()
    }
  }, [isStaleLocation, isEditing, selectedLocationId, device.id])

  // Debug logging for map display
  useEffect(() => {
    if (selectedLocation) {
      console.log('🗺️ [LocationDetailsCard] Selected location:', {
        name: selectedLocation.name,
        hasLatitude: !!selectedLocation.latitude,
        hasLongitude: !!selectedLocation.longitude,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        willShowMap: !!(
          selectedLocation.latitude && selectedLocation.longitude
        ),
      })
    }
  }, [selectedLocation])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            📍 Location Details
          </CardTitle>
          {!isEditing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="mr-1 h-4 w-4" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="mr-1 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            {/* Location Selector */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              {loadingLocations ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading locations...
                </div>
              ) : (
                <Select
                  value={selectedLocationId || 'none'}
                  onValueChange={(value) =>
                    setSelectedLocationId(value === 'none' ? '' : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No location</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                        {location.city &&
                          ` - ${location.city}, ${location.state}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                Select the facility or building location
              </p>
            </div>

            {/* Installed At Input */}
            <div className="space-y-2">
              <Label htmlFor="installed_at">Installed At</Label>
              <Input
                id="installed_at"
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
                placeholder="e.g., Walk-in cooler, Bean room, Bathroom A"
              />
              <p className="text-xs text-muted-foreground">
                Specific room or area where the device is installed
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Display Mode */}
            <div>
              <p className="text-sm text-muted-foreground">Location</p>
              <p className="font-medium">{displayLocationName}</p>
              {selectedLocation && (
                <div className="mt-1 text-sm text-muted-foreground">
                  {selectedLocation.address && (
                    <div>{selectedLocation.address}</div>
                  )}
                  {(selectedLocation.city || selectedLocation.state) && (
                    <div>
                      {selectedLocation.city}
                      {selectedLocation.city && selectedLocation.state && ', '}
                      {selectedLocation.state}
                    </div>
                  )}
                </div>
              )}
            </div>
            {installedAt && (
              <div>
                <p className="text-sm text-muted-foreground">Installed At</p>
                <p className="font-medium">{installedAt}</p>
              </div>
            )}
            {device.metadata?.placement && (
              <div>
                <p className="text-sm text-muted-foreground">Placement</p>
                <p className="font-medium">{String(device.metadata.placement)}</p>
              </div>
            )}

            {/* Map display when location has coordinates */}
            {selectedLocation?.latitude && selectedLocation?.longitude && (
              <div className="mt-4">
                <p className="mb-2 text-sm text-muted-foreground">Map</p>
                <LocationMap
                  latitude={selectedLocation.latitude}
                  longitude={selectedLocation.longitude}
                  locationName={selectedLocation.name}
                  deviceName={device.name}
                  installedAt={installedAt}
                />
              </div>
            )}

            {/* Message when location exists but has no coordinates */}
            {selectedLocation &&
              !selectedLocation.latitude &&
              !selectedLocation.longitude && (
                <div className="mt-4 rounded-lg border border-dashed bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    📍 <strong>Map Not Available</strong>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add GPS coordinates (latitude/longitude) to this location to
                    display the map. Edit the location in{' '}
                    <strong>Organizations → Locations</strong> tab.
                  </p>
                </div>
              )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
