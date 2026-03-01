'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Plus,
  Users,
  Smartphone,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ScrollText,
  Crown,
  LayoutGrid,
  List,
} from 'lucide-react'
import { edgeFunctions } from '@/lib/edge-functions/client'
import { useOrganization } from '@/contexts/OrganizationContext'
import { CreateOrganizationDialog } from './CreateOrganizationDialog'
import { useUser } from '@/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'

interface ChildOrg {
  id: string
  name: string
  slug: string
  description?: string
  subscriptionTier: string
  isActive: boolean
  parentOrganizationId?: string
  depth?: number
  userCount: number
  deviceCount: number
  alertCount: number
  createdAt: string
}

interface ResellerAgreement {
  id: string
  status: string
  agreement_type: string
  max_child_organizations: number
  revenue_share_percent: number
  billing_model: string
  accepted_at: string | null
  agreement_version: string
  effective_date: string | null
  expiration_date: string | null
}

interface ChildOrganizationsTabProps {
  organizationId: string
}

export function ChildOrganizationsTab({
  organizationId,
}: ChildOrganizationsTabProps) {
  const { fmt } = useDateFormatter()
  const { currentOrganization, refreshOrganizations, switchOrganization } =
    useOrganization()
  const { user } = useUser()
  const router = useRouter()
  const [childOrgs, setChildOrgs] = useState<ChildOrg[]>([])
  const [agreement, setAgreement] = useState<ResellerAgreement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')

  const isSuperAdmin = user?.isSuperAdmin || false
  const canManageOrgs = isSuperAdmin // Only super admins can switch to and manage other organizations

  const isMainOrg = !currentOrganization?.parent_organization_id

  const fetchChildOrgs = useCallback(async () => {
    try {
      setIsLoading(true)

      console.log('[ChildOrgs] Fetching child orgs for:', organizationId)

      // Always use listChildren to get descendants (including sub-organizations)
      // This uses the recursive function to get the entire hierarchy
      const response =
        await edgeFunctions.organizations.listChildren(organizationId)

      console.log('[ChildOrgs] API response:', response)

      if (response.success && response.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orgs = (response.data as any).organizations || []

        console.log('[ChildOrgs] Found organizations:', orgs.length, orgs)

        // Filter out the parent organization from the list (shouldn't be a child of itself)
        const filtered = orgs.filter(
          (org: ChildOrg) => org.id !== organizationId
        )

        console.log('[ChildOrgs] After filtering:', filtered.length, filtered)

        setChildOrgs(filtered)
      } else {
        console.error('[ChildOrgs] API error:', response.error)
      }
    } catch (err) {
      console.error('[ChildOrgs] Failed to fetch child organizations:', err)
    } finally {
      setIsLoading(false)
    }
  }, [organizationId])

  const fetchAgreement = useCallback(async () => {
    // Main org doesn't have a reseller agreement
    if (isMainOrg) return
    try {
      const supabase = createClient()
      // reseller_agreements table is new — not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('reseller_agreements')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        setAgreement(data as ResellerAgreement)
      }
    } catch (err) {
      console.error('Failed to fetch reseller agreement:', err)
    }
  }, [organizationId, isMainOrg])

  useEffect(() => {
    fetchChildOrgs()
    fetchAgreement()
  }, [fetchChildOrgs, fetchAgreement])

  const handleOrgCreated = useCallback(async () => {
    await fetchChildOrgs()
    await refreshOrganizations()
  }, [fetchChildOrgs, refreshOrganizations])

  const handleManageOrg = useCallback(
    (orgId: string) => {
      if (canManageOrgs) {
        switchOrganization(orgId)
        router.push('/dashboard')
      }
    },
    [canManageOrgs, switchOrganization, router]
  )

  const getTierBadge = (tier: string) => {
    // Normalize: if subscription_tier is 'reseller', show actual plan as 'starter'
    const displayTier = tier === 'reseller' ? 'starter' : tier
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-700',
      starter: 'bg-blue-100 text-blue-700',
      professional: 'bg-purple-100 text-purple-700',
      enterprise: 'bg-emerald-100 text-emerald-700',
    }
    return (
      <div className="flex items-center gap-1">
        <Badge className={colors[displayTier] || 'bg-gray-100 text-gray-700'}>
          {displayTier.charAt(0).toUpperCase() + displayTier.slice(1)}
        </Badge>
        {tier === 'reseller' && (
          <Badge className="bg-amber-100 text-amber-700">
            Reseller
          </Badge>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Reseller Agreement Summary — only shown for child (reseller) orgs */}
      {currentOrganization?.parent_organization_id && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5" />
                  Reseller Agreement
                </CardTitle>
                <CardDescription>
                  Your reseller contract with NetNeural
                </CardDescription>
              </div>
              {agreement ? (
                <Badge
                  variant={
                    agreement.status === 'active' ? 'default' : 'destructive'
                  }
                  className={
                    agreement.status === 'active' ? 'bg-green-600' : ''
                  }
                >
                  {agreement.status.charAt(0).toUpperCase() +
                    agreement.status.slice(1)}
                </Badge>
              ) : (
                <Badge variant="outline">No Agreement</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {agreement ? (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Agreement Type
                  </p>
                  <p className="text-sm font-semibold capitalize">
                    {agreement.agreement_type}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Max Customer Orgs
                  </p>
                  <p className="text-sm font-semibold">
                    {childOrgs.length} / {agreement.max_child_organizations}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Billing Model</p>
                  <p className="text-sm font-semibold capitalize">
                    {agreement.billing_model.replace(/_/g, ' ')}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="text-sm font-semibold">
                    v{agreement.agreement_version}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg bg-amber-50 p-4 dark:bg-amber-950/20">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-700 dark:text-amber-400">
                    No reseller agreement on file
                  </p>
                  <p className="text-muted-foreground">
                    Contact NetNeural to set up your reseller agreement. You can
                    still create customer organizations.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Customer Organizations Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="h-5 w-5" />
            Customer Organizations
          </h3>
          <p className="text-sm text-muted-foreground">
            {isMainOrg
              ? 'All customer organizations on the platform'
              : 'Organizations managed through your reseller account'}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center rounded-md border">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchChildOrgs}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Customer Org
          </Button>
        </div>
      </div>

      {/* Customer Org Grid */}
      {childOrgs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <h4 className="mb-2 text-lg font-semibold">
              No customer organizations yet
            </h4>
            <p className="mb-4 max-w-md text-sm text-muted-foreground">
              Create your first customer organization to start managing their
              IoT devices through your reseller account.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Customer Org
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pb-3 pt-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Total Orgs
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold">{childOrgs.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pb-3 pt-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Total Devices
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {childOrgs.reduce(
                    (sum, org) => sum + (org.deviceCount || 0),
                    0
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pb-3 pt-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Total Users
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {childOrgs.reduce(
                    (sum, org) => sum + (org.userCount || 0),
                    0
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pb-3 pt-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Active Alerts
                  </span>
                </div>
                <p className="mt-1 text-2xl font-bold">
                  {childOrgs.reduce(
                    (sum, org) => sum + (org.alertCount || 0),
                    0
                  )}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Org Cards / List */}
          {viewMode === 'cards' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {childOrgs.map((org) => (
                <Card
                  key={org.id}
                  className="transition-colors hover:border-primary/50"
                  style={{
                    marginLeft:
                      org.depth && org.depth > 1
                        ? `${(org.depth - 1) * 16}px`
                        : '0',
                    borderLeft:
                      org.depth && org.depth > 1
                        ? '3px solid #06b6d4'
                        : undefined,
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-base">
                          {org.depth && org.depth > 1 && (
                            <span className="text-xs text-muted-foreground">
                              {'└─'.repeat(org.depth - 1)}
                            </span>
                          )}
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold text-white">
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          {org.name}
                          {org.depth && org.depth > 1 && (
                            <Badge variant="outline" className="text-xs">
                              L{org.depth}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {org.slug}
                        </CardDescription>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getTierBadge(org.subscriptionTier || 'starter')}
                        <Badge
                          variant={org.isActive ? 'default' : 'destructive'}
                          className={`text-xs ${org.isActive ? 'bg-green-600' : ''}`}
                        >
                          {org.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {org.description && (
                      <p className="mb-3 text-xs text-muted-foreground">
                        {org.description}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2 border-t pt-2 text-center">
                      <div>
                        <p className="text-lg font-bold">
                          {org.deviceCount || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Devices</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">
                          {org.userCount || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Users</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">
                          {org.alertCount || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Alerts</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs text-muted-foreground">
                      <span>Created {fmt.dateOnly(org.createdAt)}</span>
                      {canManageOrgs && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleManageOrg(org.id)}
                          title="Switch to this org to manage it"
                        >
                          <ExternalLink className="mr-1 h-3 w-3" />
                          Manage
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* List / Table View */
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-medium">
                          Organization
                        </th>
                        <th className="p-3 text-left font-medium">Level</th>
                        <th className="p-3 text-left font-medium">Tier</th>
                        <th className="p-3 text-center font-medium">Status</th>
                        <th className="p-3 text-center font-medium">Devices</th>
                        <th className="p-3 text-center font-medium">Users</th>
                        <th className="p-3 text-center font-medium">Alerts</th>
                        <th className="p-3 text-left font-medium">Created</th>
                        <th className="p-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {childOrgs.map((org) => (
                        <tr
                          key={org.id}
                          className="border-b transition-colors last:border-0 hover:bg-muted/30"
                          style={{
                            backgroundColor:
                              org.depth && org.depth > 1
                                ? `rgba(6, 182, 212, ${0.02 * (org.depth - 1)})`
                                : undefined,
                          }}
                        >
                          <td className="p-3">
                            <div
                              className="flex items-center gap-2"
                              style={{
                                paddingLeft:
                                  org.depth && org.depth > 1
                                    ? `${(org.depth - 1) * 20}px`
                                    : '0',
                              }}
                            >
                              {org.depth && org.depth > 1 && (
                                <span className="text-xs text-muted-foreground">
                                  └─
                                </span>
                              )}
                              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white">
                                {org.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium">{org.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {org.slug}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            {org.depth && org.depth > 1 ? (
                              <Badge variant="outline" className="text-xs">
                                L{org.depth}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Direct
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {getTierBadge(org.subscriptionTier || 'starter')}
                          </td>
                          <td className="p-3 text-center">
                            <Badge
                              variant={org.isActive ? 'default' : 'destructive'}
                              className={`text-xs ${org.isActive ? 'bg-green-600' : ''}`}
                            >
                              {org.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-medium">
                            {org.deviceCount || 0}
                          </td>
                          <td className="p-3 text-center font-medium">
                            {org.userCount || 0}
                          </td>
                          <td className="p-3 text-center font-medium">
                            {org.alertCount || 0}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {fmt.dateOnly(org.createdAt)}
                          </td>
                          <td className="p-3 text-right">
                            {canManageOrgs && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => handleManageOrg(org.id)}
                                title="Switch to this org to manage it"
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                Manage
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <Crown className="h-4 w-4" />
        <span>
          {isMainOrg ? 'Main Account' : 'Reseller Account'} —{' '}
          {currentOrganization?.name}
        </span>
      </div>

      {/* Create Dialog */}
      <CreateOrganizationDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        parentOrganizationId={organizationId}
        parentOrganizationName={currentOrganization?.name}
        isSuperAdmin={isSuperAdmin}
        onCreated={handleOrgCreated}
      />
    </div>
  )
}
