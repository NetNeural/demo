'use client'

/**
 * MapManagerDialog — Dialog for creating / editing a facility map record.
 * Handles name, description, floor level, location assignment, and image upload.
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Loader2 } from 'lucide-react'
import { FacilityMapUploader } from './FacilityMapUploader'
import type { FacilityMap } from '@/types/facility-map'

interface Location {
  id: string
  name: string
}

interface MapManagerDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<FacilityMap>) => Promise<void>
  map?: FacilityMap | null
  locations: Location[]
  organizationId: string
}

export function MapManagerDialog({
  open,
  onClose,
  onSave,
  map,
  locations,
  organizationId,
}: MapManagerDialogProps) {
  const isEditing = !!map
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [floorLevel, setFloorLevel] = useState('0')
  const [locationId, setLocationId] = useState<string>('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [imageWidth, setImageWidth] = useState<number | null>(null)
  const [imageHeight, setImageHeight] = useState<number | null>(null)

  // Populate form when editing
  useEffect(() => {
    if (map) {
      setName(map.name)
      setDescription(map.description || '')
      setFloorLevel(String(map.floor_level))
      setLocationId(map.location_id || '')
      setImageUrl(map.image_url)
      setImagePath(map.image_path)
      setImageWidth(map.image_width)
      setImageHeight(map.image_height)
    } else {
      setName('')
      setDescription('')
      setFloorLevel('0')
      setLocationId('')
      setImageUrl(null)
      setImagePath(null)
      setImageWidth(null)
      setImageHeight(null)
    }
  }, [map, open])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...(map ? { id: map.id } : {}),
        name: name.trim(),
        description: description.trim() || null,
        floor_level: parseInt(floorLevel) || 0,
        location_id: locationId || null,
        image_url: imageUrl,
        image_path: imagePath,
        image_width: imageWidth,
        image_height: imageHeight,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Map' : 'Add Facility Map'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the map settings and floor plan image.'
              : 'Create a new facility map by uploading a floor plan image.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="map-name">Map Name *</Label>
            <Input
              id="map-name"
              placeholder="e.g. Ground Floor - Building A"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="map-desc">Description</Label>
            <Textarea
              id="map-desc"
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="floor-level">Floor Level</Label>
              <Input
                id="floor-level"
                type="number"
                value={floorLevel}
                onChange={(e) => setFloorLevel(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No location</SelectItem>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Floor Plan Image</Label>
            <FacilityMapUploader
              organizationId={organizationId}
              currentImageUrl={imageUrl}
              currentImagePath={imagePath}
              onUploadComplete={(url, path, w, h) => {
                setImageUrl(url)
                setImagePath(path)
                setImageWidth(w)
                setImageHeight(h)
              }}
              onRemove={() => {
                setImageUrl(null)
                setImagePath(null)
                setImageWidth(null)
                setImageHeight(null)
              }}
              compact={!!imageUrl}
            />
            {imageUrl && (
              <div className="mt-2 overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Floor plan preview"
                  className="h-32 w-full object-contain bg-muted"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Map'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
