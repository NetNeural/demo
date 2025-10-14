'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Trash2, AlertTriangle } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

interface OrganizationSettingsTabProps {
  organizationId: string;
}

export function OrganizationSettingsTab({}: OrganizationSettingsTabProps) {
  const { currentOrganization, isOwner } = useOrganization();

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
              defaultValue={currentOrganization?.name}
              placeholder="Organization name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-slug">Slug</Label>
            <Input
              id="org-slug"
              defaultValue={currentOrganization?.slug}
              placeholder="organization-slug"
            />
          </div>

          <Button>Save Changes</Button>
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
            <Button variant="destructive">
              Delete Organization
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
