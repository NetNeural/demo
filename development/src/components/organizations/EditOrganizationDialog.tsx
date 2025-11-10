'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { edgeFunctions } from '@/lib/edge-functions/client';
import type { UserOrganization } from '@/types/organization';

interface EditOrganizationDialogProps {
  organization: UserOrganization | {
    id: string;
    name: string;
    slug: string;
    description?: string;
    subscriptionTier?: string;
    is_active: boolean;
  };
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function EditOrganizationDialog({
  organization,
  onSuccess,
  trigger,
}: EditOrganizationDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'starter' | 'professional' | 'enterprise'>('starter');
  const [isActive, setIsActive] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
  }>({});

  // Initialize form when dialog opens or organization changes
  useEffect(() => {
    if (open && organization) {
      setName(organization.name);
      setDescription('description' in organization ? organization.description || '' : '');
      setSubscriptionTier(
        ('subscriptionTier' in organization ? organization.subscriptionTier : 'starter') as typeof subscriptionTier
      );
      setIsActive(organization.is_active);
    }
  }, [open, organization]);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'Organization name is required';
    } else if (name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    } else if (name.trim().length > 100) {
      newErrors.name = 'Name must be less than 100 characters';
    }

    if (description && description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await edgeFunctions.organizations.update(organization.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        subscriptionTier,
        isActive,
      });

      if (!response.success) {
        throw new Error(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to update organization'
        );
      }

      toast({
        title: 'Success!',
        description: `Organization "${name}" has been updated.`,
      });

      setOpen(false);

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update organization',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            Edit Organization
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>
              Update organization details and settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Organization Name */}
            <div className="space-y-2">
              <Label htmlFor="edit-org-name">
                Organization Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-org-name"
                placeholder="e.g., Acme Manufacturing"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Slug (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="edit-org-slug">Slug</Label>
              <Input
                id="edit-org-slug"
                value={organization.slug}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs text-muted-foreground">
                Slug cannot be changed after creation
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-org-description">Description</Label>
              <Textarea
                id="edit-org-description"
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
              <Label htmlFor="edit-subscription-tier">Subscription Tier</Label>
              <Select
                value={subscriptionTier}
                onValueChange={(value) => setSubscriptionTier(value as typeof subscriptionTier)}
                disabled={isLoading}
              >
                <SelectTrigger id="edit-subscription-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (Up to 5 devices)</SelectItem>
                  <SelectItem value="starter">Starter (Up to 50 devices)</SelectItem>
                  <SelectItem value="professional">Professional (Up to 500 devices)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (Unlimited)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="is-active">Active Status</Label>
                <p className="text-sm text-muted-foreground">
                  Inactive organizations cannot be accessed by members
                </p>
              </div>
              <Switch
                id="is-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={isLoading}
              />
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
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
