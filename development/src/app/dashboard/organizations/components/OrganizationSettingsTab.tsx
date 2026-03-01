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
  Shield,
  Key,
  ExternalLink,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { removeBackground } from '@imgly/background-removal'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { handleApiError } from '@/lib/sentry-utils'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { OrganizationSettings } from '@/types/organization'
import { DeviceTypeImageManager } from '@/components/organizations/DeviceTypeImageManager'
import { FeatureGate } from '@/components/FeatureGate'

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
  const [isUploadingSentinelLogo, setIsUploadingSentinelLogo] = useState(false)
  const [isUploadingBg, setIsUploadingBg] = useState(false)
  const [removeLogoBg, setRemoveLogoBg] = useState(false)
  const [removeSentinelBg, setRemoveSentinelBg] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sentinelFileInputRef = useRef<HTMLInputElement>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)

  // Branding settings state
  const [logoUrl, setLogoUrl] = useState('')
  const [sentinelLogoUrl, setSentinelLogoUrl] = useState('')
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
  const [loginBgFit, setLoginBgFit] = useState<
    'cover' | 'contain' | 'fill' | 'center'
  >('cover')
  const [loginBgPosition, setLoginBgPosition] = useState<{
    x: number
    y: number
  }>({ x: 50, y: 50 })
  const [loginBgPositionMobile, setLoginBgPositionMobile] = useState<{
    x: number
    y: number
  }>({ x: 50, y: 50 })
  const [loginHeadline, setLoginHeadline] = useState('')
  const [loginSubtitle, setLoginSubtitle] = useState('')
  const [loginCardOpacity, setLoginCardOpacity] = useState(70)
  const [loginShowLogo, setLoginShowLogo] = useState(true)
  const [loginEnhanceBg, setLoginEnhanceBg] = useState(false)
  const [loginShowAnimatedBg, setLoginShowAnimatedBg] = useState(true)

  // Sync state when currentOrganization changes
  useEffect(() => {
    if (currentOrganization) {
      setOrgName(currentOrganization.name || '')
      setOrgSlug(currentOrganization.slug || '')

      const settings: OrganizationSettings = currentOrganization.settings || {}
      setLogoUrl(settings.branding?.logo_url || '')
      setSentinelLogoUrl(settings.branding?.sentinel_logo_url || '')
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
      setLoginBgPosition(
        settings.login_page?.background_position || { x: 50, y: 50 }
      )
      setLoginBgPositionMobile(
        settings.login_page?.background_position_mobile ||
          settings.login_page?.background_position || { x: 50, y: 50 }
      )
      setLoginHeadline(settings.login_page?.headline || '')
      setLoginSubtitle(settings.login_page?.subtitle || '')
      setLoginCardOpacity(settings.login_page?.card_opacity ?? 70)
      setLoginShowLogo(settings.login_page?.show_logo !== false)
      setLoginEnhanceBg(settings.login_page?.enhance_bg === true)
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
  const compressImage = async (file: File, maxSize = 400): Promise<Blob> => {
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
          // Calculate new dimensions (maintain aspect ratio)
          const MAX_SIZE = maxSize
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

      let processedFile: File | Blob = file

      // Remove background if checkbox is checked
      if (removeLogoBg && file.type !== 'image/svg+xml') {
        try {
          toast.info('Removing background... This may take 15-30 seconds while the AI model loads.')
          const bgRemovedBlob = await removeBackground(file)
          processedFile = new File([bgRemovedBlob], file.name, { type: 'image/png' })
          toast.success('Background removed successfully')
        } catch (bgError: any) {
          console.error('Background removal failed:', bgError)
          toast.error(`Background removal failed: ${bgError?.message || 'Unknown error'}. Uploading with original background.`)
          // Continue with original file
        }
      }

      // Compress image before upload
      toast.info('Compressing image...')
      const compressedBlob = await compressImage(processedFile as File)

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

  /** Sentinel logo upload — mirrors handleLogoUpload but saves to sentinel-logo path */
  const handleSentinelLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file || !currentOrganization) return

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

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    try {
      setIsUploadingSentinelLogo(true)
      const supabase = createClient()

      let processedFile: File | Blob = file

      // Remove background if checkbox is checked
      if (removeSentinelBg && file.type !== 'image/svg+xml') {
        try {
          toast.info('Removing background... This may take 15-30 seconds while the AI model loads.')
          const bgRemovedBlob = await removeBackground(file)
          processedFile = new File([bgRemovedBlob], file.name, { type: 'image/png' })
          toast.success('Background removed successfully')
        } catch (bgError: any) {
          console.error('Background removal failed:', bgError)
          toast.error(`Background removal failed: ${bgError?.message || 'Unknown error'}. Uploading with original background.`)
          // Continue with original file
        }
      }

      toast.info('Compressing image...')
      const compressedBlob = await compressImage(processedFile as File, 800)

      const fileExt = file.type === 'image/svg+xml' ? 'svg' : 'webp'
      const fileName = `${currentOrganization.id}/sentinel-logo-${Date.now()}.${fileExt}`

      // Delete old sentinel logo if exists
      if (sentinelLogoUrl) {
        const oldPath = sentinelLogoUrl.split('/').slice(-2).join('/')
        await supabase.storage.from('organization-assets').remove([oldPath])
      }

      const { data, error } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, compressedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType:
            file.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/webp',
        })

      if (error) throw error

      const {
        data: { publicUrl },
      } = supabase.storage.from('organization-assets').getPublicUrl(data.path)

      setSentinelLogoUrl(publicUrl)
      toast.success(
        `Sentinel logo uploaded! (${(compressedBlob.size / 1024).toFixed(0)}KB) Click "Save Changes" to apply.`
      )
    } catch (error: any) {
      console.error('Error uploading Sentinel logo:', error)
      let errorMessage = 'Failed to upload Sentinel logo'
      if (error?.message?.includes('row-level security')) {
        errorMessage =
          'Permission denied. Please ensure you are an organization owner and storage policies are applied.'
      } else if (error?.message) {
        errorMessage = `Upload failed: ${error.message}`
      }
      toast.error(errorMessage)
    } finally {
      setIsUploadingSentinelLogo(false)
    }
  }

  const handleBgUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
          ...(isNetNeuralRoot ? { sentinel_logo_url: sentinelLogoUrl } : {}),
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
        },
        login_page: {
          background_url: loginBgUrl || null,
          background_color: loginBgColor,
          background_fit: loginBgFit,
          background_position: loginBgPosition,
          background_position_mobile: loginBgPositionMobile,
          headline: loginHeadline || null,
          subtitle: loginSubtitle || null,
          card_opacity: loginCardOpacity,
          show_logo: loginShowLogo,
          enhance_bg: loginEnhanceBg,
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

    // Require user to type organization name to confirm (case-insensitive, trimmed)
    if (
      deleteConfirmation.trim().toLowerCase() !==
      currentOrganization.name.trim().toLowerCase()
    ) {
      toast.error('Please type the organization name to confirm deletion')
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

  // NetNeural root org — only root org gets Sentinel logo upload
  const NETNEURAL_ROOT_ORG_ID = '00000000-0000-0000-0000-000000000001'
  const isNetNeuralRoot = currentOrganization?.id === NETNEURAL_ROOT_ORG_ID

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
          <div className={`grid gap-6 ${isNetNeuralRoot ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Organization Logo */}
            <div className="space-y-3">
              <Label>Organization Logo</Label>
              <div className="flex items-start gap-3">
                {/* Logo preview */}
                <div className="flex-shrink-0">
                  {logoUrl ? (
                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border-2 border-gray-200 bg-white">
                      <img
                        src={logoUrl}
                        alt="Organization logo"
                        className="h-full w-full object-contain p-1.5"
                      />
                    </div>
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                      <ImageIcon className="h-7 w-7 text-gray-400" />
                    </div>
                  )}
                </div>

                {/* Upload controls */}
                <div className="flex-1 min-w-0 space-y-2">
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
                    {isUploadingLogo ? 'Processing...' : 'Upload Logo'}
                  </Button>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remove-logo-bg"
                      checked={removeLogoBg}
                      onCheckedChange={(checked) => setRemoveLogoBg(checked === true)}
                    />
                    <Label htmlFor="remove-logo-bg" className="text-xs font-normal cursor-pointer">
                      Remove background
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WebP, or SVG. Auto-compressed to 400×400px.
                    Check &quot;Remove background&quot; before uploading to strip the background.
                  </p>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoUrl('')}
                      className="text-red-600 hover:text-red-700 h-auto p-0"
                    >
                      Remove Logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Sentinel Logo — NetNeural root org only */}
            {isNetNeuralRoot && (
              <div className="space-y-3">
                <Label>Sentinel Logo</Label>
                <div className="flex items-start gap-3">
                  {/* Sentinel logo preview */}
                  <div className="flex-shrink-0">
                    {sentinelLogoUrl ? (
                      <div className="relative h-20 w-20 overflow-hidden rounded-lg border-2 border-blue-200 bg-white">
                        <img
                          src={sentinelLogoUrl}
                          alt="Sentinel logo"
                          className="h-full w-full object-contain p-1.5"
                        />
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/50">
                        <Shield className="h-7 w-7 text-blue-400" />
                      </div>
                    )}
                  </div>

                  {/* Upload controls */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <input
                      ref={sentinelFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      onChange={handleSentinelLogoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => sentinelFileInputRef.current?.click()}
                      disabled={isUploadingSentinelLogo}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {isUploadingSentinelLogo
                        ? 'Processing...'
                        : 'Upload Sentinel Logo'}
                    </Button>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remove-sentinel-bg"
                        checked={removeSentinelBg}
                        onCheckedChange={(checked) => setRemoveSentinelBg(checked === true)}
                      />
                      <Label htmlFor="remove-sentinel-bg" className="text-xs font-normal cursor-pointer">
                        Remove background
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sentinel brand logo. PNG, JPG, WebP, or SVG. Auto-compressed to 800×800px.
                      Check &quot;Remove background&quot; before uploading to strip the background.
                    </p>
                    {sentinelLogoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSentinelLogoUrl('')}
                        className="text-red-600 hover:text-red-700 h-auto p-0"
                      >
                        Remove Sentinel Logo
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
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
          <CardDescription className="space-y-1">
            <span>
              Customize how the login page looks for{' '}
              {currentOrganization?.name || 'your organization'}. Share this
              link with your users so they see your branded login:
            </span>
            <a
              href={`${typeof window !== 'undefined' ? window.location.origin : ''}/auth/login?org=${currentOrganization?.slug || 'your-slug'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block break-all rounded bg-muted px-2 py-1 font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {typeof window !== 'undefined' ? window.location.origin : ''}
              /auth/login?org={currentOrganization?.slug || 'your-slug'}
            </a>
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
                  Recommended: 1920×1080 or larger. PNG, JPG, or WebP (max 10
                  MB). Auto-compressed to WebP — final size typically 200–500
                  KB.
                </p>
                {loginBgUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      // Delete file from storage
                      try {
                        const supabase = createClient()
                        const oldPath = loginBgUrl
                          .split('/')
                          .slice(-2)
                          .join('/')
                        await supabase.storage
                          .from('organization-assets')
                          .remove([oldPath])
                      } catch (e) {
                        console.warn('Could not delete old background file:', e)
                      }
                      setLoginBgUrl('')
                      toast.info(
                        'Background removed. Click "Save All Changes" to apply.'
                      )
                    }}
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
                <SelectItem value="cover">
                  Cover — fill window, may crop edges
                </SelectItem>
                <SelectItem value="contain">
                  Contain — fit inside, may show bars
                </SelectItem>
                <SelectItem value="fill">
                  Fill — stretch to fit exactly
                </SelectItem>
                <SelectItem value="center">
                  Center — original size, centered
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls how the background image fills the browser window.
            </p>
          </div>

          {/* Background Focal Point (Desktop & Mobile) */}
          {loginBgUrl && loginBgFit === 'cover' && (
            <div className="space-y-3">
              <Label>Image Focal Point</Label>
              <p className="text-xs text-muted-foreground">
                Click or drag on each preview to set where the image focuses.
                This ensures the important part of your image stays visible on
                both screen sizes.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Desktop preview */}
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Monitor className="h-4 w-4" /> Desktop ({loginBgPosition.x}
                    %, {loginBgPosition.y}%)
                  </span>
                  <div
                    className="relative h-32 w-full cursor-crosshair overflow-hidden rounded-lg border-2 border-gray-300 dark:border-gray-600"
                    style={{ aspectRatio: '16/9' }}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const setPos = (ev: {
                        clientX: number
                        clientY: number
                      }) => {
                        const x = Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              ((ev.clientX - rect.left) / rect.width) * 100
                            )
                          )
                        )
                        const y = Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              ((ev.clientY - rect.top) / rect.height) * 100
                            )
                          )
                        )
                        setLoginBgPosition({ x, y })
                      }
                      setPos(e)
                      const onMove = (ev: MouseEvent) => setPos(ev)
                      const onUp = () => {
                        document.removeEventListener('mousemove', onMove)
                        document.removeEventListener('mouseup', onUp)
                      }
                      document.addEventListener('mousemove', onMove)
                      document.addEventListener('mouseup', onUp)
                    }}
                  >
                    <img
                      src={loginBgUrl}
                      alt="Desktop preview"
                      className="h-full w-full object-cover"
                      style={{
                        objectPosition: `${loginBgPosition.x}% ${loginBgPosition.y}%`,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-lg"
                      style={{
                        left: `${loginBgPosition.x}%`,
                        top: `${loginBgPosition.y}%`,
                      }}
                    />
                  </div>
                </div>
                {/* Mobile preview */}
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                      <path d="M12 18h.01" />
                    </svg>
                    Mobile ({loginBgPositionMobile.x}%,{' '}
                    {loginBgPositionMobile.y}%)
                  </span>
                  <div
                    className="relative mx-auto h-32 w-20 cursor-crosshair overflow-hidden rounded-lg border-2 border-gray-300 dark:border-gray-600"
                    style={{ aspectRatio: '9/16' }}
                    onMouseDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const setPos = (ev: {
                        clientX: number
                        clientY: number
                      }) => {
                        const x = Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              ((ev.clientX - rect.left) / rect.width) * 100
                            )
                          )
                        )
                        const y = Math.max(
                          0,
                          Math.min(
                            100,
                            Math.round(
                              ((ev.clientY - rect.top) / rect.height) * 100
                            )
                          )
                        )
                        setLoginBgPositionMobile({ x, y })
                      }
                      setPos(e)
                      const onMove = (ev: MouseEvent) => setPos(ev)
                      const onUp = () => {
                        document.removeEventListener('mousemove', onMove)
                        document.removeEventListener('mouseup', onUp)
                      }
                      document.addEventListener('mousemove', onMove)
                      document.addEventListener('mouseup', onUp)
                    }}
                  >
                    <img
                      src={loginBgUrl}
                      alt="Mobile preview"
                      className="h-full w-full object-cover"
                      style={{
                        objectPosition: `${loginBgPositionMobile.x}% ${loginBgPositionMobile.y}%`,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-green-500 shadow-lg"
                      style={{
                        left: `${loginBgPositionMobile.x}%`,
                        top: `${loginBgPositionMobile.y}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLoginBgPosition({ x: 50, y: 50 })
                    setLoginBgPositionMobile({ x: 50, y: 50 })
                  }}
                >
                  Reset Both to Center
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setLoginBgPositionMobile({ ...loginBgPosition })
                  }
                >
                  Copy Desktop → Mobile
                </Button>
              </div>
            </div>
          )}

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
              Base background color. Visible when no background image is set, or
              behind transparent areas.
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
                Smaller text below the headline. Defaults to
                &ldquo;Sentinel&rdquo;.
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
              Controls the transparency of the login card. Lower values show
              more of the background.
            </p>
          </div>

          {/* Show Logo on Login Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Show Logo on Login</Label>
              <p className="text-xs text-muted-foreground">
                Display your organization logo above the name on the login page
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={loginShowLogo}
              onClick={() => setLoginShowLogo(!loginShowLogo)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                loginShowLogo ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  loginShowLogo ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Enhance Background Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Enhance Background</Label>
              <p className="text-xs text-muted-foreground">
                Apply AI-style enhancement — boosts brightness, contrast, and
                color vibrancy
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={loginEnhanceBg}
              onClick={() => setLoginEnhanceBg(!loginEnhanceBg)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                loginEnhanceBg ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  loginEnhanceBg ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
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

          {/* Preview — Desktop & Mobile side by side */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="flex items-end justify-center gap-6 rounded-lg border bg-gray-100 p-4 dark:bg-gray-900">
              {/* ── Desktop preview ── */}
              <div className="space-y-1">
                <p className="text-center text-[10px] font-medium text-muted-foreground">
                  <Monitor className="mr-1 inline h-3 w-3" />
                  Desktop
                </p>
                <div className="w-[320px] overflow-hidden rounded-md shadow-lg">
                  {/* Fake browser chrome */}
                  <div className="flex items-center gap-1.5 bg-gray-700 px-2 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    <span className="ml-2 flex-1 truncate rounded-sm bg-gray-600 px-2 py-0.5 text-[8px] text-gray-400">
                      {typeof window !== 'undefined'
                        ? window.location.origin
                        : ''}
                      /auth/login?org={currentOrganization?.slug || 'your-slug'}
                    </span>
                  </div>
                  {/* Page viewport (16:9) */}
                  <div
                    className="relative overflow-hidden"
                    style={{
                      backgroundColor: loginBgColor,
                      aspectRatio: '16 / 9',
                    }}
                  >
                    {loginBgUrl && (
                      <img
                        src={loginBgUrl}
                        alt="Background preview"
                        className={`absolute inset-0 h-full w-full ${
                          loginBgFit === 'cover'
                            ? 'object-cover'
                            : loginBgFit === 'contain'
                              ? 'object-contain'
                              : loginBgFit === 'fill'
                                ? 'object-fill'
                                : 'object-none'
                        }`}
                        style={
                          loginEnhanceBg
                            ? {
                                filter:
                                  'brightness(1.08) contrast(1.12) saturate(1.25)',
                              }
                            : undefined
                        }
                      />
                    )}
                    {loginBgUrl && (
                      <div className="absolute inset-0 bg-black/40" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="rounded-lg border border-white/10 px-4 py-3 text-center backdrop-blur-xl"
                        style={{
                          background: `rgba(15, 23, 42, ${loginCardOpacity / 100})`,
                        }}
                      >
                        {loginShowLogo && logoUrl && (
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="mx-auto mb-1 h-5 w-auto object-contain"
                          />
                        )}
                        <p className="text-[10px] font-bold text-white">
                          {loginHeadline ||
                            currentOrganization?.name ||
                            'Organization'}
                        </p>
                        <p className="text-[8px] text-gray-400">
                          {loginSubtitle || 'Sentinel'}
                        </p>
                        <div className="mx-auto mt-1 h-1 w-16 rounded bg-gray-600" />
                        <div className="mx-auto mt-0.5 h-1 w-16 rounded bg-gray-600" />
                        <div className="mx-auto mt-1 h-2 w-16 rounded bg-blue-600" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Mobile preview ── */}
              <div className="space-y-1">
                <p className="text-center text-[10px] font-medium text-muted-foreground">
                  📱 Mobile
                </p>
                {/* Phone frame */}
                <div className="w-[120px] overflow-hidden rounded-[14px] border-[3px] border-gray-800 bg-gray-800 shadow-lg">
                  {/* Status bar */}
                  <div className="flex items-center justify-between bg-black/60 px-2 py-0.5">
                    <span className="text-[5px] text-white/70">9:41</span>
                    <div className="mx-auto h-1.5 w-8 rounded-full bg-gray-700" />
                    <div className="flex gap-0.5">
                      <span className="text-[5px] text-white/70">5G</span>
                      <span className="text-[5px] text-white/70">🔋</span>
                    </div>
                  </div>
                  {/* Phone viewport (9:19.5 mobile ratio ≈ iPhone) */}
                  <div
                    className="relative overflow-hidden"
                    style={{
                      backgroundColor: loginBgColor,
                      aspectRatio: '9 / 16',
                    }}
                  >
                    {loginBgUrl && (
                      <img
                        src={loginBgUrl}
                        alt="Mobile preview"
                        className="absolute inset-0 h-full w-full object-cover object-center"
                        style={
                          loginEnhanceBg
                            ? {
                                filter:
                                  'brightness(1.08) contrast(1.12) saturate(1.25)',
                              }
                            : undefined
                        }
                      />
                    )}
                    {loginBgUrl && (
                      <div className="absolute inset-0 bg-black/40" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center p-2">
                      <div
                        className="w-full rounded-md border border-white/10 px-2 py-2 text-center backdrop-blur-xl"
                        style={{
                          background: `rgba(15, 23, 42, ${loginCardOpacity / 100})`,
                        }}
                      >
                        {loginShowLogo && logoUrl && (
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="mx-auto mb-0.5 h-3 w-auto object-contain"
                          />
                        )}
                        <p className="text-[7px] font-bold leading-tight text-white">
                          {loginHeadline ||
                            currentOrganization?.name ||
                            'Organization'}
                        </p>
                        <p className="text-[5px] text-gray-400">
                          {loginSubtitle || 'Sentinel'}
                        </p>
                        <div className="mx-auto mt-0.5 h-0.5 w-10 rounded bg-gray-600" />
                        <div className="mx-auto mt-0.5 h-0.5 w-10 rounded bg-gray-600" />
                        <div className="mx-auto mt-0.5 h-1.5 w-10 rounded bg-blue-600" />
                      </div>
                    </div>
                  </div>
                  {/* Home indicator */}
                  <div className="flex justify-center bg-black/60 py-1">
                    <div className="h-0.5 w-8 rounded-full bg-white/40" />
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

      {/* SSO Configuration — Enterprise only */}
      <FeatureGate feature="sso" showUpgradePrompt>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Single Sign-On (SSO)
            </CardTitle>
            <CardDescription>
              Configure SAML 2.0 SSO for your organization. Members can sign in
              using your corporate identity provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">SAML 2.0 Integration</p>
                  <p className="text-sm text-muted-foreground">
                    SSO setup requires coordination with your IT team. Contact
                    support to begin the configuration process for your identity
                    provider (Okta, Azure AD, Google Workspace, etc.).
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SSO Status</Label>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-sm text-muted-foreground">
                    Not configured
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <p className="text-sm text-muted-foreground">—</p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" disabled>
                <Key className="mr-2 h-4 w-4" />
                Configure SSO
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href="https://docs.netneural.ai/sso"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  SSO Documentation
                </a>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Enterprise feature — supports SAML 2.0 with Okta, Azure AD, Google
              Workspace, OneLogin, and other IdPs.
            </p>
          </CardContent>
        </Card>
      </FeatureGate>

      {/* Show delete for all organizations except the NetNeural root org */}
      {currentOrganization?.id !== NETNEURAL_ROOT_ORG_ID && (
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
                Deleting this organization will permanently remove all
                associated devices, members, locations, integrations, and data.
                This action cannot be undone.
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
                  isDeleting ||
                  deleteConfirmation.trim().toLowerCase() !==
                    currentOrganization?.name?.trim().toLowerCase()
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
