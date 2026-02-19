'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrganization } from '@/contexts/OrganizationContext';
import { 
  Smartphone, 
  Users, 
  AlertTriangle, 
  Plug,
  TrendingUp,
  Activity
} from 'lucide-react';
import { ResellerAgreementSection } from './ResellerAgreementSection';
import { useDateFormatter } from '@/hooks/useDateFormatter';

interface OverviewTabProps {
  organizationId: string;
}

export function OverviewTab({ organizationId }: OverviewTabProps) {
  const { fmt } = useDateFormatter();
  const { currentOrganization, stats, userRole } = useOrganization();

  if (!currentOrganization) {
    return <div>No organization selected</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalDevices || currentOrganization.deviceCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Registered devices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || currentOrganization.userCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Organization members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeAlerts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Unresolved alerts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
            <Plug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeIntegrations || 0}</div>
            <p className="text-xs text-muted-foreground">
              Configured integrations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Information about {currentOrganization.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Organization Name</p>
              <p className="text-base font-semibold">{currentOrganization.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Your Role</p>
              <Badge variant="secondary" className="capitalize">
                {userRole}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Organization ID</p>
              <code className="text-sm bg-muted px-2 py-1 rounded">{organizationId}</code>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="text-base">
                {currentOrganization.created_at 
                  ? fmt.longDate(currentOrganization.created_at)
                  : 'Unknown'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reseller Agreement Section */}
      <ResellerAgreementSection organizationId={organizationId} />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Latest events in your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <p className="text-sm">Activity tracking will be available soon</p>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Device Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Online</span>
                <span className="text-sm font-medium">{stats?.onlineDevices || 0} ({stats?.totalDevices ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all" 
                  style={{ width: stats?.totalDevices ? `${(stats.onlineDevices / stats.totalDevices) * 100}%` : '0%' }}
                />
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm">Offline</span>
                <span className="text-sm font-medium">{stats?.totalDevices ? stats.totalDevices - stats.onlineDevices : 0} ({stats?.totalDevices ? Math.round(((stats.totalDevices - stats.onlineDevices) / stats.totalDevices) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all" 
                  style={{ width: stats?.totalDevices ? `${((stats.totalDevices - stats.onlineDevices) / stats.totalDevices) * 100}%` : '0%' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Alerts</span>
                <Badge variant={stats?.activeAlerts ? "destructive" : "secondary"}>
                  {stats?.activeAlerts || 0}
                </Badge>
              </div>
              {stats?.activeAlerts === 0 && (
                <p className="text-xs text-muted-foreground">
                  No active alerts - all systems operating normally
                </p>
              )}
              {(stats?.activeAlerts || 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  View alerts tab for details and to acknowledge
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
