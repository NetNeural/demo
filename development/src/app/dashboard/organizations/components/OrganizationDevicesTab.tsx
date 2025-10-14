'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Plus, Power, AlertCircle } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  location: string;
  lastSeen: string;
}

interface OrganizationDevicesTabProps {
  organizationId: string;
}

export function OrganizationDevicesTab({ organizationId }: OrganizationDevicesTabProps) {
  const { canManageDevices } = useOrganization();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    if (!organizationId) {
      setDevices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices?organization_id=${organizationId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDevices(data.devices || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Devices ({devices.length})
              </CardTitle>
              <CardDescription>
                Devices registered in this organization (ID: {organizationId})
              </CardDescription>
            </div>
            {canManageDevices && (
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Device
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading devices...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No devices found for this organization</p>
              {canManageDevices && (
                <p className="text-sm text-muted-foreground mt-2">Click &quot;Add Device&quot; to register your first device</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 mt-1 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-muted-foreground">{device.location}</p>
                    <p className="text-xs text-muted-foreground">Last seen: {device.lastSeen}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {device.status === 'online' ? (
                    <Badge variant="default" className="bg-green-500">
                      <Power className="w-3 h-3 mr-1" />
                      Online
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Offline
                    </Badge>
                  )}
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
