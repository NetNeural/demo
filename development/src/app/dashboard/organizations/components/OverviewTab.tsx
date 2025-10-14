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

interface OverviewTabProps {
  organizationId: string;
}

export function OverviewTab({ organizationId }: OverviewTabProps) {
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
              +12% from last month
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
              +2 new this week
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
              -5 from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
            <Plug className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">
              All systems operational
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
              <p className="text-base">January 15, 2024</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-3 border-b">
              <div className="w-2 h-2 mt-2 rounded-full bg-green-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">New device registered</p>
                <p className="text-xs text-muted-foreground">Temperature Sensor #245 added to Building A</p>
                <p className="text-xs text-muted-foreground mt-1">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 pb-3 border-b">
              <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Member invited</p>
                <p className="text-xs text-muted-foreground">john.doe@example.com invited as Member</p>
                <p className="text-xs text-muted-foreground mt-1">5 hours ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3 pb-3 border-b">
              <div className="w-2 h-2 mt-2 rounded-full bg-amber-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Alert triggered</p>
                <p className="text-xs text-muted-foreground">High temperature detected on Sensor #189</p>
                <p className="text-xs text-muted-foreground mt-1">1 day ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 mt-2 rounded-full bg-purple-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Integration configured</p>
                <p className="text-xs text-muted-foreground">Golioth integration successfully connected</p>
                <p className="text-xs text-muted-foreground mt-1">2 days ago</p>
              </div>
            </div>
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
                <span className="text-sm font-medium">234 (95%)</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full w-[95%]" />
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm">Offline</span>
                <span className="text-sm font-medium">11 (5%)</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full w-[5%]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Critical</span>
                <Badge variant="destructive">3</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">High</span>
                <Badge variant="default" className="bg-orange-500">8</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Medium</span>
                <Badge variant="default" className="bg-amber-500">15</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Low</span>
                <Badge variant="secondary">24</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
