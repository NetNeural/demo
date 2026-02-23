'use client'

import { useState, useRef, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Settings,
  Trash2,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Palette,
  Monitor,
  LogIn,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { handleApiError } from '@/lib/sentry-utils'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { OrganizationSettings } from '@/types/organization'
import { DeviceTypeImageManager } from '@/components/organizations/DeviceTypeImageManager'

interface OrganizationSettingsTabProps {
  organizationId: string
}

export function OrganizationSettingsTab({}: OrganizationSettingsTabProps) {
  const { currentOrganization, isOwner, refreshOrganizations } =
    useOrganization()
  const { user } = useUser()
  const [orgName, setOrgName] = useState('')
  const [orgSlug, setOrgSlug] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingBg, setIsUploadingBg] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)

  // Branding settings state
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#3b82f6')
  const [secondaryColor, setSecondaryColor] = useState('#64748b')
  const [accentColor, setAccentColor] = useState('#10b981')
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto')
  const [timezone, setTimezone] = useState('UTC')
  const [deviceTypeImages, setDeviceTypeImages] = useState<
    Record<string, string>
  >({})

  // Login page appearance state
  const [loginBgUrl, setLoginBgUrl] = useState('')
  const [loginBgColor, setLoginBgColor] = useState('#030712')
  const [loginBgFit, setLoginBgFit] = useState<'cover' | 'contain' | 'fill' | 'center'>('cover')
  const [loginHeadline, setLoginHeadline] = useState('')
  const [loginSubtitle, setLoginSubtitle] = useState('')
  const [loginCardOpacity, setLoginCardOpacity] = useState(70)
  const [loginShowAnimatedBg, setLoginShowAnimatedBg] = useState(true)

  // Sync state when currentOrganization changes
  useEffect(() => {
    if (currentOrganization) {
      setOrgName(currentOrganization.name || '')
      setOrgSlug(currentOrganization.slug || '')

      const settings: OrganizationSettings = currentOrganization.settings || {}
      setLogoUrl(settings.branding?.logo_url || '')
      setPrimaryColor(settings.branding?.primary_color || '#3b82f6')
      setSecondaryColor(settings.branding?.secondary_color || '#64748b')
      setAccentColor(settings.branding?.accent_color || '#10b981')
      setTheme(settings.theme || 'auto')
      setTimezone(settings.timezone || 'UTC')
      setDeviceTypeImages(
        (settings.device_type_images as Record<string, string>) || {}
      )

      // Login page settings
      setLoginBgUrl(settings.login_page?.background_url || '')
      setLoginBgColor(settings.login_page?.background_color || '#030712')
      setLoginBgFit(settings.login_page?.background_fit || 'cover')
      setLoginHeadline(settings.login_page?.headline || '')
      setLoginSubtitle(settings.login_page?.subtitle || '')
      setLoginCardOpacity(settings.login_page?.card_opacity ?? 70)
      setLoginShowAnimatedBg(settings.login_page?.show_animated_bg !== false)
    }
  }, [currentOrganization])

  /**
   * Compress and resize image before upload
   * Industry best practices:
   * - Max dimensions: 400x400px (sufficient for logos)
   * - WebP format for optimal compression
   * - Quality: 85% (good balance)
   * - Target size: <500KB
   */
  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // Skip SVG files (they're already optimized and vector-based)
      if (file.type === 'image/svg+xml') {
        resolve(file)
        return
      }

      const reader = new FileReader()
      reader.readAsDataURL(file)

      reader.onload = (e) => {
        const img = new Image()
        img.src = e.target?.result as string

        img.onload = () => {
          // Calculate new dimensions (max 400x400, maintain aspect ratio)
          const MAX_SIZE = 400
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_SIZE) {
              height = (height * MAX_SIZE) / width
              width = MAX_SIZE
            }
          } else {
            if (height > MAX_SIZE) {
              width = (width * MAX_SIZE) / height
              height = MAX_SIZE
            }
          }

          // Create canvas and resize
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          // Use better image smoothing
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)

          // Convert to WebP with 85% quality
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log(
                  `Image compressed: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB`
                )
                resolve(blob)
              } else {
                reject(new Error('Failed to compress image'))
              }
            },
            'image/webp',
            0.85
          )
        }

        img.onerror = () => reject(new Error('Failed to load image'))
      }

      reader.onerror = () => reject(new Error('Failed to read file'))
    })
  }

  /**
   * Compress and resize background image before upload
   * Backgrounds need higher resolution than logos:
   * - Max dimensions: 1920px (full HD width)
   * - WebP format for optimal compression
   * - Quality: 80% (good balance for large images)
   * - Target size: <500KB after compression
   */
  const compressBgImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)

      reader.onload = (e) => {
        const img = new Image()
        img.src = e.target?.result as string

        img.onload = () => {
          const MAX_SIZE = 1920
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_SIZE) {
              height = (height * MAX_SIZE) / width
              width = MAX_SIZE
            }
          } else {
            if (height > MAX_SIZE) {
              width = (width * MAX_SIZE) / height
              height = MAX_SIZE
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log(
                  `Background compressed: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB (${width}x${height})`
                )
                resolve(blob)
              } else {
                reject(new Error('Failed to compress background image'))
              }
            },
            'image/webp',
            0.8
          )
        }

        img.onerror = () => reject(new Error('Failed to load image'))
      }

      reader.onerror = () => reject(new Error('Failed to read file'))
    })
  }

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file || !currentOrganization) return

    // Validate file type
    const validTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/svg+xml',
    ]
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP, or SVG)')
      return
    }

    // Validate initial file size (10MB max before compression)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    try {
      setIsUploadingLogo(true)
      const supabase = createClient()

      // Compress image before upload
      toast.info('Compressing image...')
      const compressedBlob = await compressImage(file)

      // Check compressed size (should be <500KB for logos)
      if (compressedBlob.size > 500 * 1024) {
        toast.warning(
          `Compressed to ${(compressedBlob.size / 1024).toFixed(0)}KB (larger than ideal 500KB). Consider using a simpler logo.`
        )
      }

      // Use .webp extension for compressed images, keep original for SVG
      const fileExt = file.type === 'image/svg+xml' ? 'svg' : 'webp'
      const fileName = `${currentOrganization.id}/logo-${Date.now()}.${fileExt}`

      // Delete old logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.split('/').slice(-2).join('/')
        await supabase.storage.from('organization-assets').remove([oldPath])
      }

      // Upload compressed logo
      const { data, error } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, compressedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType:
            file.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/webp',
        })

      if (error) throw error

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('organization-assets').getPublicUrl(data.path)

      setLogoUrl(publicUrl)
      toast.success(
        `Logo uploaded! (${(compressedBlob.size / 1024).toFixed(0)}KB) Click "Save Changes" to apply.`
      )
    } catch (error: any) {
      console.error('Error uploading logo:', error)

      // Provide specific error messages
      let errorMessage = 'Failed to upload logo'

      if (error?.message?.includes('row-level security')) {
        errorMessage =
          'Permission denied. Please ensure you are an organization owner and storage policies are applied.'
      } else if (error?.message?.includes('exceed')) {
        errorMessage =
          'File too large. Maximum size is 512KB after compression.'
      } else if (error?.message) {
        errorMessage = `Upload failed: ${error.message}`
      }

      toast.error(errorMessage)

      // Log detailed error for debugging
      console.error('Upload error details:', {
        message: error?.message,
        status: error?.status,
        statusText: error?.statusText,
        error: error,
      })
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleBgUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file || !currentOrganization) return

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (PNG, JPG, or WebP)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    try {
      setIsUploadingBg(true)
      const supabase = createClient()

      toast.info('Compressing background image...')
      // Compress with larger max size for backgrounds (1920px)
      const compressedBlob = await compressBgImage(file)

      const fileExt = 'webp'
      const fileName = `${currentOrganization.id}/login-bg-${Date.now()}.${fileExt}`

      // Delete old background if exists
      if (loginBgUrl) {
        const oldPath = loginBgUrl.split('/').slice(-2).join('/')
        await supabase.storage.from('organization-assets').remove([oldPath])
      }

      const { data, error } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, compressedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'image/webp',
        })

      if (error) throw error

      const {
        data: { publicUrl },
      } = supabase.storage.from('organization-assets').getPublicUrl(data.path)

      setLoginBgUrl(publicUrl)
      toast.success('Background uploaded! Click "Save All Changes" to apply.')
    } catch (error: any) {
      console.error('Error uploading background:', error)
      toast.error(error?.message || 'Failed to upload background image')
    } finally {
      setIsUploadingBg(false)
    }
  }

  const handleSave = async () => {
    if (!currentOrganization) return

    try {
      setIsSaving(true)
      setSaveMessage('')

      // Get current settings to merge with updates
      const currentSettings: OrganizationSettings =
        currentOrganization.settings || {}

      const updatedSettings: OrganizationSettings = {
        ...currentSettings,
        branding: {
          logo_url: logoUrl,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
        },
        login_page: {
          background_url: loginBgUrl || undefined,
          background_color: loginBgColor,
          background_fit: loginBgFit,
          headline: loginHeadline || undefined,
          subtitle: loginSubtitle || undefined,
          card_opacity: loginCardOpacity,
          show_animated_bg: loginShowAnimatedBg,
        },
        theme,
        timezone,
        device_type_images: deviceTypeImages,
      }

      console.log('Saving organization settings:', {
        name: orgName.trim(),
        settings: updatedSettings,
      })

      const response = await edgeFunctions.organizations.update(
        currentOrganization.id,
        {
          name: orgName.trim(),
          settings: updatedSettings,
        }
      )

      if (!response.success) {
        const errorMessage =
          typeof response.error === 'string'
            ? response.error
            : 'Failed to update organization'

        // Send to Sentry with context
        handleApiError(new Error(errorMessage), {
          endpoint: `/functions/v1/organizations/${currentOrganization.id}`,
          method: 'PATCH',
          context: {
            organizationId: currentOrganization.id,
            organizationName: currentOrganization.name,
            newName: orgName.trim(),
          },
        })

        setSaveMessage(errorMessage)
        toast.error(errorMessage)
        return
      }

      setSaveMessage('Organization updated successfully!')
      toast.success('Organization updated successfully!')
      await refreshOrganizations()

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Error updating organization:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update organization'
      setSaveMessage(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!currentOrganization) return

    // Require user to type organization name to confirm
    if (deleteConfirmation !== currentOrganization.name) {
      toast.error(
        'Please type the organization name exactly to confirm deletion'
      )
      return
    }

    if (
      !confirm(
        'Are you absolutely sure? This will permanently delete all organization data including devices, members, and locations. This action CANNOT be undone!'
      )
    ) {
      return
    }

    try {
      setIsDeleting(true)

      const response = await edgeFunctions.organizations.delete(
        currentOrganization.id
      )

      if (!response.success) {
        const errorMessage =
          typeof response.error === 'string'
            ? response.error
            : 'Failed to delete organization'
        toast.error(errorMessage)
        return
      }

      toast.success('Organization deleted successfully')

      // Refresh organizations list
      await refreshOrganizations()

      // Redirect to dashboard after short delay to allow state updates
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 500)
    } catch (error) {
      console.error('Error deleting organization:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to delete organization'
      toast.error(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  // Allow super_admin or organization owner to access settings
  const canAccessSettings = isOwner || user?.role === 'super_admin'

  if (!canAccessSettings) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="space-y-3 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Owner Only</h3>
            <p className="text-muted-foreground">
              Only organization owners can access settings.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Basic Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Organization Settings
          </CardTitle>
          <CardDescription>
            Configure basic settings for {currentOrganization?.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Organization name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug (read-only)</Label>
            <Input
              id="org-slug"
              value={orgSlug}
              placeholder="organization-slug"
              disabled
              className="cursor-not-allowed bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Slug cannot be changed after organization creation
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Branding & Logo Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Branding & Logo
          </CardTitle>
          <CardDescription>
            Customize your organization&apos;s visual identity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Organization Logo</Label>
            <div className="flex items-start gap-4">
              {/* Logo preview */}
              <div className="flex-shrink-0">
                {logoUrl ? (
                  <div className="relative h-24 w-24 overflow-hidden rounded-lg border-2 border-gray-200 bg-white">
                    <img
                      src={logoUrl}
                      alt="Organization logo"
                      className="h-full w-full object-contain p-2"
                    />
                  </div>
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Upload controls */}
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WebP, or SVG. Auto-compressed to WebP at 400x400px
                  (~200KB). Max 10MB before compression.
                </p>
                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoUrl('')}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove Logo
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device Type Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Device Type Images
          </CardTitle>
          <CardDescription>
            Upload images for each device type. These appear on device cards
            across the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeviceTypeImageManager
            organizationId={currentOrganization?.id || ''}
            deviceTypeImages={deviceTypeImages}
            onChange={setDeviceTypeImages}
          />
        </CardContent>
      </Card>

      {/* Theme Customization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme & Colors
          </CardTitle>
          <CardDescription>
            Set custom colors for your organization&apos;s interface. These will
            apply to all users by default, but individual users can override
            with personal preferences.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Live Color Preview */}
          <div className="rounded-lg border bg-card p-4">
            <p className="mb-3 text-sm font-medium">Preview:</p>
            <div className="flex gap-2">
              <button
                className="rounded-md px-4 py-2 font-medium text-white transition-colors"
                style={{ backgroundColor: primaryColor }}
              >
                Primary Button
              </button>
              <button
                className="rounded-md px-4 py-2 font-medium text-white transition-colors"
                style={{ backgroundColor: secondaryColor }}
              >
                Secondary Button
              </button>
              <button
                className="rounded-md px-4 py-2 font-medium text-white transition-colors"
                style={{ backgroundColor: accentColor }}
              >
                Accent Button
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-20 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Secondary Color */}
            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary-color"
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-20 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#64748b"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <Label htmlFor="accent-color">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accent-color"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-20 cursor-pointer p-1"
                />
                <Input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#10b981"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Theme Mode */}
          <div className="space-y-2">
            <Label htmlFor="theme-mode">Default Theme Mode</Label>
            <Select
              value={theme}
              onValueChange={(value: 'light' | 'dark' | 'auto') =>
                setTheme(value)
              }
            >
              <SelectTrigger id="theme-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="auto">Auto (System)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Sets the default theme for all users in your organization. Users
              can override this in their personal settings.
            </p>
          </div>

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">
                  Eastern Time (ET)
                </SelectItem>
                <SelectItem value="America/Chicago">
                  Central Time (CT)
                </SelectItem>
                <SelectItem value="America/Denver">
                  Mountain Time (MT)
                </SelectItem>
                <SelectItem value="America/Los_Angeles">
                  Pacific Time (PT)
                </SelectItem>
                <SelectItem value="Europe/London">London (GMT)</SelectItem>
                <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                <SelectItem value="Asia/Shanghai">Shanghai (CST)</SelectItem>
                <SelectItem value="Australia/Sydney">Sydney (AEST)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Login Page Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Login Page Appearance
          </CardTitle>
          <CardDescription>
            Customize how the login page looks for your organization. Users access it via{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              /auth/login?org={currentOrganization?.slug || 'your-slug'}
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Background Image */}
          <div className="space-y-2">
            <Label>Background Image</Label>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                {loginBgUrl ? (
                  <div className="relative h-24 w-40 overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-950">
                    <img
                      src={loginBgUrl}
                      alt="Login background"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-24 w-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                    <ImageIcon className="h-8 w-8 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  ref={bgFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleBgUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => bgFileInputRef.current?.click()}
                  disabled={isUploadingBg}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isUploadingBg ? 'Uploading...' : 'Upload Background'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Recommended: 1920×1080 or larger. PNG, JPG, or WebP (max 10 MB).
                  Auto-compressed to WebP — final size typically 200–500 KB.
                </p>
                {loginBgUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLoginBgUrl('')}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove Background
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Background Fit */}
          <div className="space-y-2">
            <Label htmlFor="login-bg-fit">Background Fit</Label>
            <Select
              value={loginBgFit}
              onValueChange={(value: 'cover' | 'contain' | 'fill' | 'center') =>
                setLoginBgFit(value)
              }
            >
              <SelectTrigger id="login-bg-fit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover — fill window, may crop edges</SelectItem>
                <SelectItem value="contain">Contain — fit inside, may show bars</SelectItem>
                <SelectItem value="fill">Fill — stretch to fit exactly</SelectItem>
                <SelectItem value="center">Center — original size, centered</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls how the background image fills the browser window.
            </p>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <Label htmlFor="login-bg-color">Background Color</Label>
            <div className="flex gap-2">
              <Input
                id="login-bg-color"
                type="color"
                value={loginBgColor}
                onChange={(e) => setLoginBgColor(e.target.value)}
                className="h-10 w-20 cursor-pointer p-1"
              />
              <Input
                type="text"
                value={loginBgColor}
                onChange={(e) => setLoginBgColor(e.target.value)}
                placeholder="#030712"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Base background color. Visible when no background image is set, or behind transparent areas.
            </p>
          </div>

          {/* Custom Headline & Subtitle */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="login-headline">Custom Headline</Label>
              <Input
                id="login-headline"
                value={loginHeadline}
                onChange={(e) => setLoginHeadline(e.target.value)}
                placeholder={currentOrganization?.name || 'Organization Name'}
              />
              <p className="text-xs text-muted-foreground">
                Main heading shown above the login form. Defaults to org name.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-subtitle">Custom Subtitle</Label>
              <Input
                id="login-subtitle"
                value={loginSubtitle}
                onChange={(e) => setLoginSubtitle(e.target.value)}
                placeholder="Sentinel"
              />
              <p className="text-xs text-muted-foreground">
                Smaller text below the headline. Defaults to &ldquo;Sentinel&rdquo;.
              </p>
            </div>
          </div>

          {/* Card Opacity */}
          <div className="space-y-2">
            <Label htmlFor="login-card-opacity">
              Login Card Opacity: {loginCardOpacity}%
            </Label>
            <input
              id="login-card-opacity"
              type="range"
              min={20}
              max={100}
              value={loginCardOpacity}
              onChange={(e) => setLoginCardOpacity(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <p className="text-xs text-muted-foreground">
              Controls the transparency of the login card. Lower values show more of the background.
            </p>
          </div>

          {/* Animated Background Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Animated Background</Label>
              <p className="text-xs text-muted-foreground">
                Show floating IoT icons and gradient orbs on the login page
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={loginShowAnimatedBg}
              onClick={() => setLoginShowAnimatedBg(!loginShowAnimatedBg)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                loginShowAnimatedBg ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  loginShowAnimatedBg ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex justify-center rounded-lg border bg-gray-100 p-4 dark:bg-gray-900">
              {/* Scaled-down browser-window thumbnail */}
              <div className="w-[320px] overflow-hidden rounded-md shadow-lg">
                {/* Fake browser chrome */}
                <div className="flex items-center gap-1.5 bg-gray-700 px-2 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  <span className="ml-2 flex-1 rounded-sm bg-gray-600 px-2 py-0.5 text-[8px] text-gray-400 truncate">
                    /auth/login?org={currentOrganization?.slug || 'your-slug'}
                  </span>
                </div>
                {/* Page viewport (16:9 aspect ratio) */}
                <div
                  className="relative overflow-hidden"
                  style={{ backgroundColor: loginBgColor, aspectRatio: '16 / 9' }}
                >
                  {loginBgUrl && (
                    <img
                      src={loginBgUrl}
                      alt="Background preview"
                      className={`absolute inset-0 h-full w-full ${
                        loginBgFit === 'cover' ? 'object-cover' :
                        loginBgFit === 'contain' ? 'object-contain' :
                        loginBgFit === 'fill' ? 'object-fill' :
                        'object-none'
                      }`}
                    />
                  )}
                  {loginBgUrl && <div className="absolute inset-0 bg-black/40" />}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="rounded-lg border border-white/10 px-4 py-3 text-center backdrop-blur-xl"
                      style={{
                        background: `rgba(15, 23, 42, ${loginCardOpacity / 100})`,
                      }}
                    >
                      <p className="text-[10px] font-bold text-white">
                        {loginHeadline || currentOrganization?.name || 'Organization'}
                      </p>
                      <p className="text-[8px] text-gray-400">
                        {loginSubtitle || 'Sentinel'}
                      </p>
                      <div className="mt-1 h-1 w-16 rounded bg-gray-600 mx-auto" />
                      <div className="mt-0.5 h-1 w-16 rounded bg-gray-600 mx-auto" />
                      <div className="mt-1 h-2 w-16 rounded bg-blue-600 mx-auto" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Card>
        <CardContent className="pt-6">
          {saveMessage && (
            <div
              className={`mb-4 rounded-md p-3 text-sm ${
                saveMessage.includes('success')
                  ? 'border border-green-200 bg-green-50 text-green-900'
                  : 'border border-red-200 bg-red-50 text-red-900'
              }`}
            >
              {saveMessage}
            </div>
          )}

          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Only show delete for child organizations — root org (no parent) cannot be deleted */}
      {currentOrganization?.parent_organization_id && (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-red-800">
            Irreversible actions that permanently affect this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-red-900">
              Deleting this organization will permanently remove all associated
              devices, members, locations, integrations, and data. This action
              cannot be undone.
            </p>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-red-900">
                Type <strong>{currentOrganization?.name}</strong> to confirm
                deletion:
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type organization name"
                className="border-red-300 focus:border-red-500"
              />
            </div>

            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                isDeleting || deleteConfirmation !== currentOrganization?.name
              }
            >
              {isDeleting ? 'Deleting...' : 'Delete Organization'}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
