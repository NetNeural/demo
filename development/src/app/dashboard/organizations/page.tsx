'use client';

import { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Smartphone, 
  MapPin, 
  Plug, 
  Bell, 
  Settings,
  Building2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { useOrganization } from '@/contexts/OrganizationContext';
import { OverviewTab } from './components/OverviewTab';
import { MembersTab } from './components/MembersTab';
import { OrganizationDevicesTab } from './components/OrganizationDevicesTab';
import { LocationsTab } from './components/LocationsTab';
import { OrganizationIntegrationsTab } from './components/OrganizationIntegrationsTab';
import { OrganizationAlertsTab } from './components/OrganizationAlertsTab';
import { OrganizationSettingsTab } from './components/OrganizationSettingsTab';

export default function OrganizationsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const { 
    currentOrganization, 
    canManageMembers, 
    canManageIntegrations,
    isOwner 
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
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7 gap-2">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          
          {canManageMembers && (
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Members</span>
            </TabsTrigger>
          )}
          
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">Devices</span>
          </TabsTrigger>
          
          <TabsTrigger value="locations" className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="hidden sm:inline">Locations</span>
          </TabsTrigger>
          
          {canManageIntegrations && (
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Plug className="w-4 h-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
          )}
          
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          
          {isOwner && (
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab organizationId={currentOrganization.id} />
        </TabsContent>

        {canManageMembers && (
          <TabsContent value="members">
            <MembersTab organizationId={currentOrganization.id} />
          </TabsContent>
        )}

        <TabsContent value="devices">
          <OrganizationDevicesTab organizationId={currentOrganization.id} />
        </TabsContent>

        <TabsContent value="locations">
          <LocationsTab organizationId={currentOrganization.id} />
        </TabsContent>

        {canManageIntegrations && (
          <TabsContent value="integrations">
            <OrganizationIntegrationsTab organizationId={currentOrganization.id} />
          </TabsContent>
        )}

        <TabsContent value="alerts">
          <OrganizationAlertsTab organizationId={currentOrganization.id} />
        </TabsContent>

        {isOwner && (
          <TabsContent value="settings">
            <OrganizationSettingsTab organizationId={currentOrganization.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
