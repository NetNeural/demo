'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Plus } from 'lucide-react';
import { edgeFunctions } from '@/lib/edge-functions';

interface Alert {
  id: string;
  deviceName?: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  timestamp: string;
}

interface OrganizationAlertsTabProps {
  organizationId: string;
}

export function OrganizationAlertsTab({ organizationId }: OrganizationAlertsTabProps) {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!organizationId) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await edgeFunctions.alerts.list(organizationId);

      if (!response.success) {
        const errorMsg = response.error?.message || 'Failed to fetch alerts';
        throw new Error(errorMsg);
      }

      setAlerts((response.data?.alerts as Alert[]) || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <p className="text-muted-foreground">Loading alerts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Recent Alerts ({alerts.length})
            </CardTitle>
            <CardDescription>
              Organization-specific alerts for quick reference.{' '}
              <button
                onClick={() => router.push('/dashboard/alerts')}
                className="text-primary hover:underline font-medium"
              >
                View all alerts →
              </button>
            </CardDescription>
          </div>
          <Button onClick={() => router.push(`/dashboard/alerts?organization=${organizationId}`)}>
            <Plus className="w-4 h-4 mr-2" />
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No alerts for this organization</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm text-muted-foreground">
                      {alert.deviceName || 'Unknown Device'} • {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Badge className={`${getSeverityColor(alert.severity)} text-white`}>
                  {alert.severity}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
