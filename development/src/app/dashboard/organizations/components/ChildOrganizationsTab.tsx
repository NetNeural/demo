'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDateFormatter } from '@/hooks/useDateFormatter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'lucide-react';
import { edgeFunctions } from '@/lib/edge-functions/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { CreateOrganizationDialog } from './CreateOrganizationDialog';
import { useUser } from '@/contexts/UserContext';
import { createClient } from '@/lib/supabase/client';

interface ChildOrg {
  id: string;
  name: string;
  slug: string;
  description?: string;
  subscriptionTier: string;
  isActive: boolean;
  userCount: number;
  deviceCount: number;
  alertCount: number;
  createdAt: string;
}

interface ResellerAgreement {
  id: string;
  status: string;
  agreement_type: string;
  max_child_organizations: number;
  revenue_share_percent: number;
  billing_model: string;
  accepted_at: string | null;
  agreement_version: string;
  effective_date: string | null;
  expiration_date: string | null;
}

interface ChildOrganizationsTabProps {
  organizationId: string;
}

export function ChildOrganizationsTab({ organizationId }: ChildOrganizationsTabProps) {
  const { fmt } = useDateFormatter();
  const { currentOrganization, refreshOrganizations } = useOrganization();
  const { user } = useUser();
  const [childOrgs, setChildOrgs] = useState<ChildOrg[]>([]);
  const [agreement, setAgreement] = useState<ResellerAgreement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const isSuperAdmin = user?.isSuperAdmin || false;

  const isMainOrg = !currentOrganization?.parent_organization_id;

  const fetchChildOrgs = useCallback(async () => {
    try {
      setIsLoading(true);

      if (isMainOrg && isSuperAdmin) {
        // Main (root) org: list ALL organizations
        const response = await edgeFunctions.organizations.list();
        if (response.success && response.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allOrgs = ((response.data as any).organizations || []) as ChildOrg[];
          // Exclude the current (main) org from the customer list
          setChildOrgs(allOrgs.filter((o) => o.id !== organizationId));
        }
      } else {
        // Child / reseller org: list only children
        const response = await edgeFunctions.organizations.listChildren(organizationId);
        if (response.success && response.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const orgs = (response.data as any).organizations || [];
          setChildOrgs(orgs);
        }
      }
    } catch (err) {
      console.error('Failed to fetch child organizations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, isMainOrg, isSuperAdmin]);

  const fetchAgreement = useCallback(async () => {
    // Main org doesn't have a reseller agreement
    if (isMainOrg) return;
    try {
      const supabase = createClient();
      // reseller_agreements table is new — not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('reseller_agreements')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setAgreement(data as ResellerAgreement);
      }
    } catch (err) {
      console.error('Failed to fetch reseller agreement:', err);
    }
  }, [organizationId, isMainOrg]);

  useEffect(() => {
    fetchChildOrgs();
    fetchAgreement();
  }, [fetchChildOrgs, fetchAgreement]);

  const handleOrgCreated = useCallback(async () => {
    await fetchChildOrgs();
    await refreshOrganizations();
  }, [fetchChildOrgs, refreshOrganizations]);

  const getTierBadge = (tier: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-700',
      starter: 'bg-blue-100 text-blue-700',
      professional: 'bg-purple-100 text-purple-700',
      reseller: 'bg-amber-100 text-amber-700',
      enterprise: 'bg-emerald-100 text-emerald-700',
    };
    return (
      <Badge className={colors[tier] || 'bg-gray-100 text-gray-700'}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </Badge>
    );
  };

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
    );
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
                <ScrollText className="w-5 h-5" />
                Reseller Agreement
              </CardTitle>
              <CardDescription>
                Your reseller contract with NetNeural
              </CardDescription>
            </div>
            {agreement ? (
              <Badge
                variant={agreement.status === 'active' ? 'default' : 'destructive'}
                className={agreement.status === 'active' ? 'bg-green-600' : ''}
              >
                {agreement.status.charAt(0).toUpperCase() + agreement.status.slice(1)}
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
                <p className="text-xs text-muted-foreground">Agreement Type</p>
                <p className="font-semibold text-sm capitalize">{agreement.agreement_type}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Max Customer Orgs</p>
                <p className="font-semibold text-sm">
                  {childOrgs.length} / {agreement.max_child_organizations}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Billing Model</p>
                <p className="font-semibold text-sm capitalize">
                  {agreement.billing_model.replace(/_/g, ' ')}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Version</p>
                <p className="font-semibold text-sm">v{agreement.agreement_version}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <div className="text-sm">
                <p className="font-semibold text-amber-700 dark:text-amber-400">No reseller agreement on file</p>
                <p className="text-muted-foreground">
                  Contact NetNeural to set up your reseller agreement. You can still create customer organizations.
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
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Customer Organizations
          </h3>
          <p className="text-sm text-muted-foreground">
            {isMainOrg
              ? 'All customer organizations on the platform'
              : 'Organizations managed through your reseller account'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchChildOrgs}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Customer Org
          </Button>
        </div>
      </div>

      {/* Customer Org Grid */}
      {childOrgs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h4 className="text-lg font-semibold mb-2">No customer organizations yet</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Create your first customer organization to start managing their IoT devices
              through your reseller account.
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Customer Org
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Orgs</span>
                </div>
                <p className="text-2xl font-bold mt-1">{childOrgs.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Devices</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {childOrgs.reduce((sum, org) => sum + (org.deviceCount || 0), 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Users</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {childOrgs.reduce((sum, org) => sum + (org.userCount || 0), 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Active Alerts</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  {childOrgs.reduce((sum, org) => sum + (org.alertCount || 0), 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Org Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {childOrgs.map((org) => (
              <Card key={org.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        {org.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {org.slug}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getTierBadge(org.subscriptionTier || 'starter')}
                      <Badge variant={org.isActive ? 'default' : 'destructive'} className={`text-xs ${org.isActive ? 'bg-green-600' : ''}`}>
                        {org.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {org.description && (
                    <p className="text-xs text-muted-foreground mb-3">{org.description}</p>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
                    <div>
                      <p className="text-lg font-bold">{org.deviceCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Devices</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{org.userCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Users</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{org.alertCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Alerts</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t text-xs text-muted-foreground">
                    <span>Created {fmt.dateOnly(org.createdAt)}</span>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" title="Switch to this org to manage it">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <Crown className="w-4 h-4" />
        <span>{isMainOrg ? 'Main Account' : 'Reseller Account'} — {currentOrganization?.name}</span>
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
  );
}
