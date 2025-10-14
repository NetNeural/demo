'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plug, Plus, Check, X } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';
import { createClient } from '@/lib/supabase/client';

interface Integration {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
}

interface OrganizationIntegrationsTabProps {
  organizationId: string;
}

export function OrganizationIntegrationsTab({ organizationId }: OrganizationIntegrationsTabProps) {
  const { permissions } = useOrganization();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    if (!organizationId) {
      setIntegrations([]);
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

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/integrations?organization_id=${organizationId}`;
      
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
      setIntegrations(data.integrations || []);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <p className="text-muted-foreground">Loading integrations...</p>
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
              <Plug className="w-5 h-5" />
              Integrations ({integrations.length})
            </CardTitle>
            <CardDescription>
              Third-party integrations for this organization
            </CardDescription>
          </div>
          {permissions.canManageIntegrations && (
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Integration
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {integrations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No integrations configured for this organization</p>
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{integration.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{integration.type}</p>
                </div>
                {integration.status === 'active' ? (
                  <Badge variant="default" className="bg-green-500">
                    <Check className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <X className="w-3 h-3 mr-1" />
                    Inactive
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
