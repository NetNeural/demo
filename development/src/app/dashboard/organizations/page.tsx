'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  MapPin,
  Plug,
  Settings,
  Building2,
  Shield,
  Crown,
  Plus,
  CreditCard,
  Key,
  Briefcase,
  Network,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { OverviewTab } from './components/OverviewTab'
import { MembersTab } from './components/MembersTab'
import { LocationsTab } from './components/LocationsTab'
import { OrganizationIntegrationsTab } from './components/OrganizationIntegrationsTab'
import { OrganizationSettingsTab } from './components/OrganizationSettingsTab'
import { AccessRequestsTab } from './components/AccessRequestsTab'
import { ChildOrganizationsTab } from './components/ChildOrganizationsTab'
import { CreateOrganizationDialog } from './components/CreateOrganizationDialog'
import { BillingTab } from './components/BillingTab'
import { ApiKeysTab } from './components/ApiKeysTab'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function OrganizationsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <OrganizationsPageContent />
    </Suspense>
  )
}

function OrganizationsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  // Initialize activeTab from URL parameter or default to 'overview'
  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'overview'
  })

  const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false)

  // Update activeTab when URL parameter changes (e.g., browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle tab change - update both state and URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.push(`?${params.toString()}`, { scroll: false })
  }
  const {
    currentOrganization,
    isLoading,
    isOwner,
    isAdmin,
    isReseller,
    canCreateChildOrgs,
    refreshOrganizations,
  } = useOrganization()
  const { user } = useUser()
  const isSuperAdmin = user?.isSuperAdmin || false

  // Show loading state while fetching organizations
  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center p-12">
          <div className="space-y-4 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Loading organizations...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show no org message only after loading completes
  if (!currentOrganization) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Organization Management
          </h2>
          <p className="text-muted-foreground">
            Select an organization from the sidebar to manage
          </p>
        </div>
        <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12">
          <div className="space-y-4 text-center">
            <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-semibold">No organization selected</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Use the organization dropdown in the sidebar to select an
              organization to manage.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <OrganizationLogo
            settings={currentOrganization?.settings}
            name={currentOrganization?.name || 'NetNeural'}
            size="xl"
          />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {currentOrganization.name} Organization Management
            </h2>
            <p className="text-muted-foreground">
              Configure {currentOrganization.name} - members, devices,
              integrations, and settings. Switch organizations using the
              sidebar.
            </p>
          </div>
        </div>
        {(isSuperAdmin || canCreateChildOrgs) && (
          <div className="flex items-center gap-2">
            {isReseller && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Crown className="h-3 w-3" />
                {currentOrganization.parent_organization_id
                  ? 'Reseller'
                  : 'Platform Owner'}
              </Badge>
            )}
            <Button size="sm" onClick={() => setShowCreateOrgDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {canCreateChildOrgs
                ? 'Create Customer Org'
                : 'Create Organization'}
            </Button>
          </div>
        )}
      </div>

      <Tabs
        value={(() => {
          // Map flat tab IDs to group IDs
          const groupMap: Record<string, string> = {
            overview: 'overview',
            members: 'people', access: 'people',
            locations: 'infrastructure', integrations: 'infrastructure', 'api-keys': 'infrastructure',
            billing: 'business', customers: 'business',
            settings: 'settings',
          }
          return groupMap[activeTab] || 'overview'
        })()}
        onValueChange={(group) => {
          // When switching groups, navigate to default sub-tab
          const defaults: Record<string, string> = {
            overview: 'overview', people: 'members', infrastructure: 'locations',
            business: 'billing', settings: 'settings',
          }
          handleTabChange(defaults[group] || 'overview')
        }}
        className="space-y-6"
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>

          <TabsTrigger value="people" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>People & Access</span>
          </TabsTrigger>

          <TabsTrigger value="infrastructure" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            <span>Infrastructure</span>
          </TabsTrigger>

          {(isSuperAdmin || isOwner || isAdmin) && (
            <TabsTrigger value="business" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span>Business</span>
            </TabsTrigger>
          )}

          {(isSuperAdmin || isOwner) && (
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview — single tab, no sub-tabs */}
        <TabsContent value="overview">
          <OverviewTab organizationId={currentOrganization.id} />
        </TabsContent>

        {/* People & Access — Members + Access Requests */}
        <TabsContent value="people">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="members" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members
              </TabsTrigger>
              {(isSuperAdmin || isOwner || isAdmin) && (
                <TabsTrigger value="access" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Access Requests
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="members" className="mt-6">
              <MembersTab organizationId={currentOrganization.id} />
            </TabsContent>
            {(isSuperAdmin || isOwner || isAdmin) && (
              <TabsContent value="access" className="mt-6">
                <AccessRequestsTab organizationId={currentOrganization.id} />
              </TabsContent>
            )}
          </Tabs>
        </TabsContent>

        {/* Infrastructure — Locations + Integrations + API Keys */}
        <TabsContent value="infrastructure">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="locations" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Locations
              </TabsTrigger>
              <TabsTrigger value="integrations" className="flex items-center gap-2">
                <Plug className="h-4 w-4" />
                Integrations
              </TabsTrigger>
              {(isSuperAdmin || isOwner || isAdmin) && (
                <TabsTrigger value="api-keys" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Keys
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="locations" className="mt-6">
              <LocationsTab organizationId={currentOrganization.id} />
            </TabsContent>
            <TabsContent value="integrations" className="mt-6">
              <OrganizationIntegrationsTab organizationId={currentOrganization.id} />
            </TabsContent>
            {(isSuperAdmin || isOwner || isAdmin) && (
              <TabsContent value="api-keys" className="mt-6">
                <ApiKeysTab organizationId={currentOrganization.id} />
              </TabsContent>
            )}
          </Tabs>
        </TabsContent>

        {/* Business — Billing + Customer Orgs */}
        {(isSuperAdmin || isOwner || isAdmin) && (
          <TabsContent value="business">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="billing" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Billing
                </TabsTrigger>
                <TabsTrigger value="customers" className="flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Customer Orgs
                </TabsTrigger>
              </TabsList>
              <TabsContent value="billing" className="mt-6">
                <BillingTab organizationId={currentOrganization.id} />
              </TabsContent>
              <TabsContent value="customers" className="mt-6">
                <ChildOrganizationsTab organizationId={currentOrganization.id} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}

        {/* Settings — single tab, no sub-tabs */}
        {(isSuperAdmin || isOwner) && (
          <TabsContent value="settings">
            <OrganizationSettingsTab organizationId={currentOrganization.id} />
          </TabsContent>
        )}
      </Tabs>

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={showCreateOrgDialog}
        onOpenChange={setShowCreateOrgDialog}
        parentOrganizationId={
          canCreateChildOrgs ? currentOrganization.id : undefined
        }
        parentOrganizationName={
          canCreateChildOrgs ? currentOrganization.name : undefined
        }
        isSuperAdmin={isSuperAdmin}
        onCreated={async () => {
          await refreshOrganizations()
        }}
      />
    </div>
  )
}
