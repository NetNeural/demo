'use client'

/**
 * FacilityMapUploader — Upload / manage floor plan images for a facility map.
 * Handles drag-and-drop, file validation, Supabase Storage upload, preview,
 * and phone camera capture.
 */

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Upload, X, ImageIcon, Loader2, Replace, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { moderateImage } from '@/lib/image-moderation'

const VALID_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

interface FacilityMapUploaderProps {
  organizationId: string
  currentImageUrl?: string | null
  currentImagePath?: string | null
  onUploadComplete: (url: string, path: string, width: number, height: number) => void
  onRemove?: () => void
  compact?: boolean
}

export function FacilityMapUploader({
  organizationId,
  currentImageUrl,
  currentImagePath,
  onUploadComplete,
  onRemove,
  compact = false,
}: FacilityMapUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!VALID_TYPES.includes(file.type)) {
        toast.error('Please upload a valid image (PNG, JPG, WebP, or SVG)')
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File must be less than 10 MB')
        return
      }

      setUploading(true)
      try {
        // AI content moderation check
        toast.info('Checking image content...')
        const moderation = await moderateImage(file)
        if (!moderation.safe) {
          toast.error(`Image rejected: ${moderation.reason || 'Inappropriate content detected'}. Please upload an appropriate image.`)
          setUploading(false)
          return
        }

        // Get image dimensions
        const dimensions = await getImageDimensions(file)

        const supabase = createClient()
        const fileExt = file.name.split('.').pop() || 'png'
        const fileName = `${organizationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`

        // Remove old image if replacing
        if (currentImagePath) {
          await supabase.storage.from('facility-maps').remove([currentImagePath]).catch(() => {})
        }

        const { data, error } = await supabase.storage
          .from('facility-maps')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          })

        if (error) throw error

        const {
          data: { publicUrl },
        } = supabase.storage.from('facility-maps').getPublicUrl(data.path)

        onUploadComplete(publicUrl, data.path, dimensions.width, dimensions.height)
        toast.success('Floor plan uploaded')
      } catch (err) {
        console.error('Upload error:', err)
        toast.error(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [organizationId, currentImagePath, onUploadComplete]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => setDragActive(false)

  if (compact && currentImageUrl) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Replace className="mr-2 h-4 w-4" />}
          Replace Image
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
        >
          <Camera className="mr-2 h-4 w-4" />
          Take Photo
        </Button>
        {onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X className="h-4 w-4" />
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  return (
    <Card
      className={`transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-dashed'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <CardContent className="flex flex-col items-center justify-center py-8">
        {uploading ? (
          <Loader2 className="mb-3 h-10 w-10 animate-spin text-muted-foreground" />
        ) : (
          <div className="mb-3 rounded-full bg-muted p-3">
            {currentImageUrl ? (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        )}

        <p className="mb-1 text-sm font-medium">
          {currentImageUrl ? 'Replace floor plan image' : 'Upload a floor plan or site image'}
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          PNG, JPG, WebP, or SVG — up to 10 MB
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-2 h-4 w-4" />
            {currentImageUrl ? 'Replace' : 'Choose File'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="mr-2 h-4 w-4" />
            Take Photo
          </Button>
          {currentImageUrl && onRemove && (
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <X className="mr-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
            e.target.value = ''
          }}
        />
      </CardContent>
    </Card>
  )
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => {
      resolve({ width: 1920, height: 1080 }) // fallback
      URL.revokeObjectURL(img.src)
    }
    img.src = URL.createObjectURL(file)
  })
}
