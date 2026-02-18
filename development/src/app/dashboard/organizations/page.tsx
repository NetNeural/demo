'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Plug, 
  Settings,
  Building2,
  Shield
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { useOrganization } from '@/contexts/OrganizationContext';
import { OverviewTab } from './components/OverviewTab';
import { MembersTab } from './components/MembersTab';
import { LocationsTab } from './components/LocationsTab';
import { OrganizationIntegrationsTab } from './components/OrganizationIntegrationsTab';
import { OrganizationSettingsTab } from './components/OrganizationSettingsTab';
import { AccessRequestsTab } from './components/AccessRequestsTab';

export default function OrganizationsPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');

  // Set active tab from URL parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  const { 
    currentOrganization,
    isOwner,
    isAdmin 
  } = useOrganization();

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Organization Management"
          description="Select an organization from the sidebar to manage"
        />
        <div className="flex items-center justify-center p-12 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-4">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold">No organization selected</p>
            <p className="text-sm text-muted-foreground max-w-md">
              Use the organization dropdown in the sidebar to select an organization to manage.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Management"
        description={`Configure ${currentOrganization.name} - members, devices, integrations, and settings. Switch organizations using the sidebar.`}
      />

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </TabsTrigger>
          
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Members</span>
          </TabsTrigger>
          
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>Locations</span>
          </TabsTrigger>
          
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Plug className="w-4 h-4" />
            <span>Integrations</span>
          </TabsTrigger>
          
          {(isOwner || isAdmin) && (
            <TabsTrigger value="access" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>Access Requests</span>
            </TabsTrigger>
          )}
          
          {isOwner && (
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab organizationId={currentOrganization.id} />
        </TabsContent>

        <TabsContent value="members">
          <MembersTab organizationId={currentOrganization.id} />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsTab organizationId={currentOrganization.id} />
        </TabsContent>

        <TabsContent value="integrations">
          <OrganizationIntegrationsTab organizationId={currentOrganization.id} />
        </TabsContent>

        {(isOwner || isAdmin) && (
          <TabsContent value="access">
            <AccessRequestsTab organizationId={currentOrganization.id} />
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="settings">
            <OrganizationSettingsTab organizationId={currentOrganization.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
