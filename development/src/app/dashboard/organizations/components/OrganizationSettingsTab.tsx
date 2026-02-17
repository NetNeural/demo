'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Trash2, AlertTriangle, Upload, Image as ImageIcon, Palette } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { edgeFunctions } from '@/lib/edge-functions/client';
import { handleApiError } from '@/lib/sentry-utils';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import type { OrganizationSettings } from '@/types/organization';

interface OrganizationSettingsTabProps {
  organizationId: string;
}

export function OrganizationSettingsTab({}: OrganizationSettingsTabProps) {
  const { currentOrganization, isOwner, refreshOrganizations } = useOrganization();
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Branding settings state
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#64748b');
  const [accentColor, setAccentColor] = useState('#10b981');
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [timezone, setTimezone] = useState('UTC');

  // Sync state when currentOrganization changes
  useEffect(() => {
    if (currentOrganization) {
      setOrgName(currentOrganization.name || '');
      setOrgSlug(currentOrganization.slug || '');
      
      const settings: OrganizationSettings = currentOrganization.settings || {};
      setLogoUrl(settings.branding?.logo_url || '');
      setPrimaryColor(settings.branding?.primary_color || '#3b82f6');
      setSecondaryColor(settings.branding?.secondary_color || '#64748b');
      setAccentColor(settings.branding?.accent_color || '#10b981');
      setTheme(settings.theme || 'auto');
      setTimezone(settings.timezone || 'UTC');
    }
  }, [currentOrganization]);

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
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        
        img.onload = () => {
          // Calculate new dimensions (max 400x400, maintain aspect ratio)
          const MAX_SIZE = 400;
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
          
          // Create canvas and resize
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          // Use better image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to WebP with 85% quality
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log(`Image compressed: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB`);
                resolve(blob);
              } else {
                reject(new Error('Failed to compress image'));
              }
            },
            'image/webp',
            0.85
          );
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentOrganization) return;

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP, or SVG)');
      return;
    }

    // Validate initial file size (10MB max before compression)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    try {
      setIsUploadingLogo(true);
      const supabase = createClient();

      // Compress image before upload
      toast.info('Compressing image...');
      const compressedBlob = await compressImage(file);
      
      // Check compressed size (should be <500KB for logos)
      if (compressedBlob.size > 500 * 1024) {
        toast.warning(`Compressed to ${(compressedBlob.size / 1024).toFixed(0)}KB (larger than ideal 500KB). Consider using a simpler logo.`);
      }

      // Use .webp extension for compressed images, keep original for SVG
      const fileExt = file.type === 'image/svg+xml' ? 'svg' : 'webp';
      const fileName = `${currentOrganization.id}/logo-${Date.now()}.${fileExt}`;

      // Delete old logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('organization-assets').remove([oldPath]);
      }

      // Upload compressed logo
      const { data, error } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, compressedBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type === 'image/svg+xml' ? 'image/svg+xml' : 'image/webp'
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(data.path);

      setLogoUrl(publicUrl);
      toast.success(`Logo uploaded! (${(compressedBlob.size / 1024).toFixed(0)}KB) Click "Save Changes" to apply.`);
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      
      // Provide specific error messages
      let errorMessage = 'Failed to upload logo';
      
      if (error?.message?.includes('row-level security')) {
        errorMessage = 'Permission denied. Please ensure you are an organization owner and storage policies are applied.';
      } else if (error?.message?.includes('exceed')) {
        errorMessage = 'File too large. Maximum size is 512KB after compression.';
      } else if (error?.message) {
        errorMessage = `Upload failed: ${error.message}`;
      }
      
      toast.error(errorMessage);
      
      // Log detailed error for debugging
      console.error('Upload error details:', {
        message: error?.message,
        status: error?.status,
        statusText: error?.statusText,
        error: error
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!currentOrganization) return;

    try {
      setIsSaving(true);
      setSaveMessage('');

      // Get current settings to merge with updates
      const currentSettings: OrganizationSettings = currentOrganization.settings || {};
      
      const updatedSettings: OrganizationSettings = {
        ...currentSettings,
        branding: {
          logo_url: logoUrl,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
        },
        theme,
        timezone,
      };

      console.log('Saving organization settings:', {
        name: orgName.trim(),
        settings: updatedSettings
      });

      const response = await edgeFunctions.organizations.update(currentOrganization.id, {
        name: orgName.trim(),
        settings: updatedSettings,
      });

      if (!response.success) {
        const errorMessage = typeof response.error === 'string' 
          ? response.error 
          : 'Failed to update organization';
        
        // Send to Sentry with context
        handleApiError(new Error(errorMessage), {
          endpoint: `/functions/v1/organizations/${currentOrganization.id}`,
          method: 'PATCH',
          context: {
            organizationId: currentOrganization.id,
            organizationName: currentOrganization.name,
            newName: orgName.trim(),
          },
        });
        
        setSaveMessage(errorMessage);
        toast.error(errorMessage);
        return;
      }

      setSaveMessage('Organization updated successfully!');
      toast.success('Organization updated successfully!');
      await refreshOrganizations();

      // Clear success message after 3 seconds
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error updating organization:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update organization';
      setSaveMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentOrganization) return;

    // Require user to type organization name to confirm
    if (deleteConfirmation !== currentOrganization.name) {
      toast.error('Please type the organization name exactly to confirm deletion');
      return;
    }

    if (!confirm('Are you absolutely sure? This will permanently delete all organization data including devices, members, and locations. This action CANNOT be undone!')) {
      return;
    }

    try {
      setIsDeleting(true);

      const response = await edgeFunctions.organizations.delete(currentOrganization.id);

      if (!response.success) {
        const errorMessage = typeof response.error === 'string'
          ? response.error
          : 'Failed to delete organization';
        toast.error(errorMessage);
        return;
      }

      toast.success('Organization deleted successfully');
      
      // Refresh organizations list
      await refreshOrganizations();
      
      // Redirect to dashboard after short delay to allow state updates
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 500);
    } catch (error) {
      console.error('Error deleting organization:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete organization';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <div className="text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-semibold">Owner Only</h3>
            <p className="text-muted-foreground">
              Only organization owners can access settings.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Basic Organization Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
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
              className="bg-muted cursor-not-allowed"
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
            <ImageIcon className="w-5 h-5" />
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
                  <div className="relative w-24 h-24 border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                    <img 
                      src={logoUrl} 
                      alt="Organization logo" 
                      className="w-full h-full object-contain p-2"
                    />
                  </div>
                ) : (
                  <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
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
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WebP, or SVG. Auto-compressed to WebP at 400x400px (~200KB). Max 10MB before compression.
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

      {/* Theme Customization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Theme & Colors
          </CardTitle>
          <CardDescription>
            Set custom colors for your organization&apos;s interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-20 h-10 p-1 cursor-pointer"
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
                  className="w-20 h-10 p-1 cursor-pointer"
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
                  className="w-20 h-10 p-1 cursor-pointer"
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
            <Select value={theme} onValueChange={(value: 'light' | 'dark' | 'auto') => setTheme(value)}>
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
              Sets the default theme for all users in your organization. Users can override this in their personal settings.
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
                <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
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

      {/* Save Button */}
      <Card>
        <CardContent className="pt-6">
          {saveMessage && (
            <div className={`p-3 rounded-md text-sm mb-4 ${
              saveMessage.includes('success') 
                ? 'bg-green-50 text-green-900 border border-green-200' 
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}>
              {saveMessage}
            </div>
          )}

          <Button onClick={handleSave} disabled={isSaving} size="lg">
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <Trash2 className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-red-800">
            Irreversible actions that permanently affect this organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-red-900">
              Deleting this organization will permanently remove all associated devices, members, 
              locations, integrations, and data. This action cannot be undone.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-red-900">
                Type <strong>{currentOrganization?.name}</strong> to confirm deletion:
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
              disabled={isDeleting || deleteConfirmation !== currentOrganization?.name}
            >
              {isDeleting ? 'Deleting...' : 'Delete Organization'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
