'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MapPin, Plus, Edit, Trash2, Loader2 } from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { toast } from 'sonner'
import { handleApiError } from '@/lib/sentry-utils'

interface Location {
  id: string
  organization_id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

interface LocationsTabProps {
  organizationId: string
}

export function LocationsTab({ organizationId }: LocationsTabProps) {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [deletingLocation, setDeletingLocation] = useState<Location | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    latitude: null as number | null,
    longitude: null as number | null,
  })

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true)

      const response = await edgeFunctions.locations.list(organizationId)

      if (!response.success) {
        const error = new Error(
          response.error?.message || 'Failed to load locations'
        )

        handleApiError(error, {
          endpoint: `/functions/v1/locations`,
          method: 'GET',
          status: response.error?.status || 500,
          errorData: response.error,
          context: { organizationId },
        })

        toast.error('Failed to load locations')
        return
      }

      setLocations((response.data as Location[]) || [])
    } catch (error) {
      console.error('Error fetching locations:', error)
      handleApiError(
        error instanceof Error ? error : new Error('Unknown error'),
        {
          endpoint: `/functions/v1/locations`,
          method: 'GET',
          context: { organizationId },
        }
      )
      toast.error('Failed to load locations')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  const handleAdd = () => {
    setEditingLocation(null)
    setFormData({
      name: '',
      description: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postal_code: '',
      latitude: null,
      longitude: null,
    })
    setShowDialog(true)
  }

  const handleEdit = (location: Location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      description: location.description || '',
      address: location.address || '',
      city: location.city || '',
      state: location.state || '',
      country: location.country || '',
      postal_code: location.postal_code || '',
      latitude: location.latitude,
      longitude: location.longitude,
    })
    setShowDialog(true)
  }

  const handleGeocodeAddress = async () => {
    // Build address string from available fields
    const addressParts = [
      formData.address,
      formData.city,
      formData.state,
      formData.postal_code,
      formData.country,
    ].filter(Boolean)

    if (addressParts.length === 0) {
      toast.error('Please enter address information to geocode')
      return
    }

    const addressString = addressParts.join(', ')

    try {
      setGeocoding(true)
      console.log('🗺️ [Geocoding] Looking up:', addressString)

      // Use OpenStreetMap Nominatim API (free, no key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}&limit=1`,
        {
          headers: {
            'User-Agent': 'NetNeural IoT Platform', // Required by Nominatim
          },
        }
      )

      if (!response.ok) {
        throw new Error('Geocoding service unavailable')
      }

      const data = await response.json()

      if (!data || data.length === 0) {
        toast.error(
          'No coordinates found for this address. Try adding more details.'
        )
        return
      }

      const result = data[0]
      const lat = parseFloat(result.lat)
      const lon = parseFloat(result.lon)

      console.log('✅ [Geocoding] Found:', {
        lat,
        lon,
        display_name: result.display_name,
      })

      setFormData((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lon,
      }))

      toast.success('Coordinates found! 🗺️')
    } catch (error) {
      console.error('Geocoding error:', error)
      toast.error('Failed to geocode address. Please try again.')
    } finally {
      setGeocoding(false)
    }
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Location name is required')
      return
    }

    try {
      setSaving(true)

      console.log(
        `[Location ${editingLocation ? 'PATCH' : 'POST'}] Starting request:`,
        {
          formData,
          locationId: editingLocation?.id,
        }
      )

      const response = editingLocation
        ? await edgeFunctions.locations.update(editingLocation.id, formData)
        : await edgeFunctions.locations.create({
            ...formData,
            organization_id: organizationId,
          })

      console.log(
        `[Location ${editingLocation ? 'PATCH' : 'POST'}] Response:`,
        response
      )

      if (!response.success) {
        console.error(
          `[Location ${editingLocation ? 'PATCH' : 'POST'}] Failed:`,
          response.error
        )
        const error = new Error(
          response.error?.message || 'Failed to save location'
        )

        handleApiError(error, {
          endpoint: `/functions/v1/locations`,
          method: editingLocation ? 'PATCH' : 'POST',
          status: response.error?.status || 500,
          errorData: response.error,
          context: {
            organizationId,
            locationId: editingLocation?.id,
            formData,
          },
        })

        toast.error(
          `Failed to ${editingLocation ? 'update' : 'create'} location`
        )
        return
      }

      console.log(
        `[Location ${editingLocation ? 'PATCH' : 'POST'}] Success:`,
        response.data
      )

      toast.success(
        `Location ${editingLocation ? 'updated' : 'created'} successfully`
      )
      setShowDialog(false)
      fetchLocations()
    } catch (error) {
      console.error('Error saving location:', error)
      handleApiError(
        error instanceof Error ? error : new Error('Unknown error'),
        {
          endpoint: `/functions/v1/locations`,
          method: editingLocation ? 'PATCH' : 'POST',
          context: { organizationId, locationId: editingLocation?.id },
        }
      )
      toast.error('Failed to save location')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (location: Location) => {
    setDeletingLocation(location)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!deletingLocation) return

    try {
      setDeleting(true)

      const response = await edgeFunctions.locations.delete(deletingLocation.id)

      if (!response.success) {
        const error = new Error(
          response.error?.message || 'Failed to delete location'
        )

        handleApiError(error, {
          endpoint: `/functions/v1/locations`,
          method: 'DELETE',
          status: response.error?.status || 500,
          errorData: response.error,
          context: {
            organizationId,
            locationId: deletingLocation.id,
            locationName: deletingLocation.name,
          },
        })

        toast.error('Failed to delete location')
        return
      }

      toast.success('Location deleted successfully')
      setShowDeleteDialog(false)
      setDeletingLocation(null)
      fetchLocations()
    } catch (error) {
      console.error('Error deleting location:', error)
      handleApiError(
        error instanceof Error ? error : new Error('Unknown error'),
        {
          endpoint: `/functions/v1/locations`,
          method: 'DELETE',
          context: { organizationId, locationId: deletingLocation.id },
        }
      )
      toast.error('Failed to delete location')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Locations
              </CardTitle>
              <CardDescription>
                Manage physical locations for your organization
              </CardDescription>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : locations.length === 0 ? (
            <div className="py-8 text-center">
              <MapPin className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
              <p className="mb-4 text-muted-foreground">
                No locations added yet
              </p>
              <Button onClick={handleAdd} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Location
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {locations.map((location) => (
                <Card key={location.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {location.name}
                        </CardTitle>
                        {location.description && (
                          <CardDescription className="mt-1 text-sm">
                            {location.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(location)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {location.address && <p>{location.address}</p>}
                      {(location.city || location.state) && (
                        <p>
                          {location.city}
                          {location.city && location.state ? ', ' : ''}
                          {location.state}
                        </p>
                      )}
                      {location.postal_code && <p>{location.postal_code}</p>}
                      {location.country && <p>{location.country}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto bg-white dark:bg-white">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </DialogTitle>
            <DialogDescription>
              {editingLocation
                ? 'Update the location details below'
                : 'Enter the details for the new location'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Location Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Headquarters, Warehouse 1"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description of this location"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="Las Vegas"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  placeholder="NV"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="postal_code">Postal Code</Label>
                <Input
                  id="postal_code"
                  value={formData.postal_code}
                  onChange={(e) =>
                    setFormData({ ...formData, postal_code: e.target.value })
                  }
                  placeholder="89101"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  placeholder="United States"
                />
              </div>
            </div>

            {/* GPS Coordinates Section */}
            <div className="mt-4 border-t pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <Label className="text-base">GPS Coordinates</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Required for map display. Auto-fill from address or enter
                    manually.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeocodeAddress}
                  disabled={geocoding || !formData.address}
                >
                  {geocoding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Geocoding...
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-2 h-4 w-4" />
                      Geocode Address
                    </>
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        latitude: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder="e.g., 40.7128"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        longitude: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder="e.g., -74.0060"
                  />
                </div>
              </div>

              {formData.latitude && formData.longitude && (
                <p className="mt-2 flex items-center gap-1 text-xs text-green-600">
                  ✓ Coordinates set - map will be displayed
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingLocation ? 'Update Location' : 'Create Location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Location</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingLocation?.name}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setDeletingLocation(null)
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
