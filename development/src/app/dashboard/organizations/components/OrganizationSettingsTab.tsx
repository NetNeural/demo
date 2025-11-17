'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Trash2, AlertTriangle } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { edgeFunctions } from '@/lib/edge-functions/client';
import { handleApiError } from '@/lib/sentry-utils';
import { toast } from 'sonner';

interface OrganizationSettingsTabProps {
  organizationId: string;
}

export function OrganizationSettingsTab({}: OrganizationSettingsTabProps) {
  const { currentOrganization, isOwner, refreshOrganizations } = useOrganization();
  const [orgName, setOrgName] = useState(currentOrganization?.name || '');
  const orgSlug = currentOrganization?.slug || '';
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const handleSave = async () => {
    if (!currentOrganization) return;

    try {
      setIsSaving(true);
      setSaveMessage('');

      const response = await edgeFunctions.organizations.update(currentOrganization.id, {
        name: orgName.trim(),
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Organization Settings
          </CardTitle>
          <CardDescription>
            Configure settings for {currentOrganization?.name}
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

          {saveMessage && (
            <div className={`p-3 rounded-md text-sm ${
              saveMessage.includes('success') 
                ? 'bg-green-50 text-green-900 border border-green-200' 
                : 'bg-red-50 text-red-900 border border-red-200'
            }`}>
              {saveMessage}
            </div>
          )}

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
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
