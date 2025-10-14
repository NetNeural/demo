'use client';

import React, { useState } from 'react';
import { Building2, Users as UsersIcon, Smartphone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsSection } from './shared/SettingsSection';
import { SettingsFormGroup } from './shared/SettingsFormGroup';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
  deviceCount?: number;
  userCount?: number;
}

interface OrganizationsTabProps {
  initialOrganizations?: Organization[];
}

export default function OrganizationsTab({
  initialOrganizations = [],
}: OrganizationsTabProps) {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [newOrgIndustry, setNewOrgIndustry] = useState('');

  const handleCreateOrganization = async () => {
    console.log('Creating organization:', { newOrgName, newOrgSlug, newOrgIndustry });
    // TODO: Implement API call
  };

  const getRoleBadge = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return <Badge className="bg-purple-500">OWNER</Badge>;
      case 'admin':
        return <Badge className="bg-blue-500">ADMIN</Badge>;
      case 'member':
        return <Badge variant="secondary">MEMBER</Badge>;
      default:
        return <Badge variant="outline">GUEST</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Organizations */}
      <SettingsSection
        icon={<Building2 className="w-5 h-5" />}
        title="Current Organizations"
        description="Organizations you're a member of"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => (
            <div
              key={org.id}
              className="border rounded-lg p-4 space-y-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <h4 className="font-semibold">{org.name}</h4>
                {getRoleBadge(org.role)}
              </div>

              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Smartphone className="w-4 h-4" />
                  <span>{org.deviceCount || 0} devices</span>
                </div>
                <div className="flex items-center gap-1">
                  <UsersIcon className="w-4 h-4" />
                  <span>{org.userCount || 0} users</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" className="flex-1">
                  Configure
                </Button>
                {org.role === 'admin' && (
                  <Button size="sm" variant="outline" className="flex-1">
                    Manage
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Create New Organization */}
      <SettingsSection
        icon={<Plus className="w-5 h-5" />}
        title="Create New Organization"
        description="Set up a new organization for your team"
      >
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <SettingsFormGroup
              label="Organization Name"
              description="The display name for your organization"
              required
            >
              <Input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g., Acme Industries"
              />
            </SettingsFormGroup>

            <SettingsFormGroup
              label="Organization Slug"
              description="URL-friendly identifier"
              required
            >
              <Input
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value)}
                placeholder="e.g., acme-industries"
              />
            </SettingsFormGroup>

            <SettingsFormGroup label="Industry" description="Primary industry sector">
              <Select value={newOrgIndustry} onValueChange={setNewOrgIndustry}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="agriculture">Agriculture</SelectItem>
                  <SelectItem value="energy">Energy</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </SettingsFormGroup>
          </div>

          <Button onClick={handleCreateOrganization}>Create Organization</Button>
        </div>
      </SettingsSection>
    </div>
  );
}
