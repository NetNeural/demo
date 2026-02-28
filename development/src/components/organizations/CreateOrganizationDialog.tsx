'use client'

import React, { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useToast } from '@/hooks/use-toast'
import { edgeFunctions } from '@/lib/edge-functions/client'

interface CreateOrganizationDialogProps {
  onSuccess?: (organizationId: string) => void
  trigger?: React.ReactNode
}

export function CreateOrganizationDialog({
  onSuccess,
  trigger,
}: CreateOrganizationDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Form state
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState<
    'free' | 'starter' | 'professional' | 'enterprise'
  >('starter')

  // Validation errors
  const [errors, setErrors] = useState<{
    name?: string
    slug?: string
    description?: string
  }>({})

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)

    // Auto-generate slug if not manually edited
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value))
    }
  }

  const generateSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
      .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  }

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    if (!name.trim()) {
      newErrors.name = 'Organization name is required'
    } else if (name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters'
    } else if (name.trim().length > 100) {
      newErrors.name = 'Name must be less than 100 characters'
    }

    if (!slug.trim()) {
      newErrors.slug = 'Slug is required'
    } else if (slug.trim().length < 3) {
      newErrors.slug = 'Slug must be at least 3 characters'
    } else if (slug.trim().length > 50) {
      newErrors.slug = 'Slug must be less than 50 characters'
    } else if (!/^[a-z0-9-]+$/.test(slug)) {
      newErrors.slug =
        'Slug can only contain lowercase letters, numbers, and hyphens'
    }

    if (description && description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      const response = await edgeFunctions.organizations.create({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        subscriptionTier,
      })

      if (!response.success) {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to create organization'
        )
      }

      toast({
        title: 'Success!',
        description: `Organization "${name}" has been created.`,
      })

      // Reset form
      setName('')
      setSlug('')
      setDescription('')
      setSubscriptionTier('starter')
      setErrors({})
      setOpen(false)

      // Call success callback with organization ID
      if (onSuccess && response.data) {
        const orgData = response.data as { organization?: { id: string } }
        if (orgData.organization?.id) {
          onSuccess(orgData.organization.id)
        }
      }
    } catch (error) {
      console.error('Error creating organization:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to create organization',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setOpen(false)
    setName('')
    setSlug('')
    setDescription('')
    setSubscriptionTier('starter')
    setErrors({})
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Organization
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogDescription>
              Create a new organization to manage devices, members, and
              integrations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="org-name">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="org-name"
                placeholder="e.g., Acme Manufacturing"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={isLoading}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="org-slug">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="org-slug"
                placeholder="e.g., acme-manufacturing"
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                disabled={isLoading}
                className={errors.slug ? 'border-red-500' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs and must be unique. Only lowercase letters,
                numbers, and hyphens.
              </p>
              {errors.slug && (
                <p className="text-sm text-red-500">{errors.slug}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="org-description">Description</Label>
              <Textarea
                id="org-description"
                placeholder="Brief description of your organization..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                rows={3}
                className={errors.description ? 'border-red-500' : ''}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/500 characters
              </p>
              {errors.description && (
                <p className="text-sm text-red-500">{errors.description}</p>
              )}
            </div>

            {/* Subscription Tier */}
            <div className="space-y-2">
              <Label htmlFor="subscription-tier">Subscription Tier</Label>
              <Select
                value={subscriptionTier}
                onValueChange={(value) =>
                  setSubscriptionTier(value as typeof subscriptionTier)
                }
                disabled={isLoading}
              >
                <SelectTrigger id="subscription-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (Up to 5 devices)</SelectItem>
                  <SelectItem value="starter">
                    Starter (Up to 50 devices)
                  </SelectItem>
                  <SelectItem value="professional">
                    Professional (Up to 500 devices)
                  </SelectItem>
                  <SelectItem value="enterprise">
                    Enterprise (Unlimited)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Organization
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
