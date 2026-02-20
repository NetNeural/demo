'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Plug, 
  Settings,
  Building2,
  Shield,
  Crown,
  Plus
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useUser } from '@/contexts/UserContext';
import { OverviewTab } from './components/OverviewTab';
import { MembersTab } from './components/MembersTab';
import { LocationsTab } from './components/LocationsTab';
import { OrganizationIntegrationsTab } from './components/OrganizationIntegrationsTab';
import { OrganizationSettingsTab } from './components/OrganizationSettingsTab';
import { AccessRequestsTab } from './components/AccessRequestsTab';
import { ChildOrganizationsTab } from './components/ChildOrganizationsTab';
import { CreateOrganizationDialog } from './components/CreateOrganizationDialog';

export default function OrganizationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Initialize activeTab from URL parameter or default to 'overview'
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'overview';
  });
  
  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);

  // Update activeTab when URL parameter changes (e.g., browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);

  // Handle tab change - update both state and URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`?${params.toString()}`, { scroll: false });
  };
  const { 
    currentOrganization,
    isLoading,
    isOwner,
    isAdmin,
    isReseller,
    canCreateChildOrgs,
    refreshOrganizations,
  } = useOrganization();
  const { user } = useUser();
  const isSuperAdmin = user?.isSuperAdmin || false;

  // Show loading state while fetching organizations
  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-center p-12">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Loading organizations...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show no org message only after loading completes
  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Organization Management</h2>
          <p className="text-muted-foreground">Select an organization from the sidebar to manage</p>
        </div>
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
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={currentOrganization?.name || 'NetNeural'}
            size="xl"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{currentOrganization.name} Organization Management</h2>
            <p className="text-muted-foreground">
              Configure {currentOrganization.name} - members, devices, integrations, and settings. Switch organizations using the sidebar.
            </p>
          </div>
        </div>
        {(isSuperAdmin || canCreateChildOrgs) && (
          <div className="flex items-center gap-2">
            {isReseller && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Reseller
              </Badge>
            )}
            <Button size="sm" onClick={() => setShowCreateOrgDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {canCreateChildOrgs ? 'Create Customer Org' : 'Create Organization'}
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
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
          
          {(isSuperAdmin || isOwner || isAdmin) && (
            <TabsTrigger value="customers" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              <span>Customer Orgs</span>
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

        {(isSuperAdmin || isOwner || isAdmin) && (
          <TabsContent value="customers">
            <ChildOrganizationsTab organizationId={currentOrganization.id} />
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="settings">
            <OrganizationSettingsTab organizationId={currentOrganization.id} />
          </TabsContent>
        )}
      </Tabs>

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={showCreateOrgDialog}
        onOpenChange={setShowCreateOrgDialog}
        parentOrganizationId={canCreateChildOrgs ? currentOrganization.id : undefined}
        parentOrganizationName={canCreateChildOrgs ? currentOrganization.name : undefined}
        isSuperAdmin={isSuperAdmin}
        onCreated={async () => {
          await refreshOrganizations();
        }}
      />
    </div>
  );
}
