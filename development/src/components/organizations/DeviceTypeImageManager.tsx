'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface DeviceTypeImageManagerProps {
  organizationId: string;
  /** Current device type → image URL mapping */
  deviceTypeImages: Record<string, string>;
  /** Called when the mapping changes (caller should persist via save) */
  onChange: (images: Record<string, string>) => void;
}

/**
 * Compress and resize a device type image before upload.
 * Max 200x200px, WebP at 85% quality.
 */
function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml') {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;

      img.onload = () => {
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = (height * MAX_SIZE) / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = (width * MAX_SIZE) / height;
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/webp',
          0.85,
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

/** Slugify a device type name for use as a storage path segment */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const VALID_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

export function DeviceTypeImageManager({
  organizationId,
  deviceTypeImages,
  onChange,
}: DeviceTypeImageManagerProps) {
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [newTypeName, setNewTypeName] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const newFileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (deviceType: string, file: File) => {
    if (!VALID_TYPES.includes(file.type)) {
      toast.error('Please upload a valid image (PNG, JPG, WebP, or SVG)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File must be less than 10MB');
      return;
    }

    try {
      setUploadingType(deviceType);
      const supabase = createClient();

      toast.info('Compressing image...');
      const compressed = await compressImage(file);

      const fileExt = file.type === 'image/svg+xml' ? 'svg' : 'webp';
      const slug = slugify(deviceType);
      const fileName = `${organizationId}/device-types/${slug}-${Date.now()}.${fileExt}`;

      // Remove old image if exists
      const oldUrl = deviceTypeImages[deviceType];
      if (oldUrl) {
        try {
          // Extract path after the bucket name
          const urlParts = oldUrl.split('/organization-assets/');
          if (urlParts[1]) {
            await supabase.storage.from('organization-assets').remove([urlParts[1]]);
          }
        } catch {
          // Best-effort removal
        }
      }

      const { data, error } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, compressed, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/webp',
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from('organization-assets').getPublicUrl(data.path);

      const updated = { ...deviceTypeImages, [deviceType]: publicUrl };
      onChange(updated);
      toast.success(`Image uploaded for "${deviceType}". Click "Save All Changes" to apply.`);
    } catch (error: unknown) {
      console.error('Error uploading device type image:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to upload image';
      toast.error(message);
    } finally {
      setUploadingType(null);
    }
  };

  const handleRemove = (deviceType: string) => {
    const updated = { ...deviceTypeImages };
    delete updated[deviceType];
    onChange(updated);
    toast.info(`Image removed for "${deviceType}". Click "Save All Changes" to apply.`);
  };

  const handleAddNewType = () => {
    const name = newTypeName.trim();
    if (!name) {
      toast.error('Enter a device type name first');
      return;
    }
    if (deviceTypeImages[name]) {
      toast.error(`"${name}" already has an image`);
      return;
    }
    // Trigger file input for the new type
    setNewTypeName('');
    // Store name temporarily so we can reference it in the file handler
    const input = newFileInputRef.current;
    if (input) {
      input.dataset.deviceType = name;
      input.click();
    }
  };

  const handleNewFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const deviceType = event.target.dataset.deviceType;
    if (file && deviceType) {
      handleUpload(deviceType, file);
    }
    // Reset input so same file can be re-selected
    event.target.value = '';
  };

  const existingTypes = Object.keys(deviceTypeImages);

  return (
    <div className="space-y-4">
      {/* Existing device type images */}
      {existingTypes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {existingTypes.map((deviceType) => (
            <div
              key={deviceType}
              className="flex items-center gap-3 p-3 border rounded-lg bg-card"
            >
              {/* Thumbnail */}
              <div className="flex-shrink-0 w-12 h-12 border rounded-md overflow-hidden bg-white flex items-center justify-center">
                {deviceTypeImages[deviceType] ? (
                  <img
                    src={deviceTypeImages[deviceType]}
                    alt={deviceType}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-gray-400" />
                )}
              </div>

              {/* Label + actions */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{deviceType}</p>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    ref={(el) => {
                      fileInputRefs.current[deviceType] = el;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(deviceType, f);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={uploadingType === deviceType}
                    onClick={() => fileInputRefs.current[deviceType]?.click()}
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    {uploadingType === deviceType ? 'Uploading...' : 'Replace'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                    onClick={() => handleRemove(deviceType)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {existingTypes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No device type images configured yet. Add images to visually identify
          devices on your dashboard.
        </p>
      )}

      {/* Add new device type image */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-device-type" className="text-xs">
            Device Type Name
          </Label>
          <Input
            id="new-device-type"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            placeholder="e.g. Wireless Access Point"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddNewType();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddNewType}
          disabled={!!uploadingType}
        >
          <Upload className="w-4 h-4 mr-1" />
          Add Image
        </Button>
      </div>

      {/* Hidden file input for new type uploads */}
      <input
        ref={newFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
        onChange={handleNewFileSelected}
        className="hidden"
      />

      <p className="text-xs text-muted-foreground">
        Upload images for each device type. Images are compressed to 200×200px WebP (~50KB).
        Supported formats: PNG, JPG, WebP, SVG. These images appear on device cards across
        the dashboard.
      </p>
    </div>
  );
}
