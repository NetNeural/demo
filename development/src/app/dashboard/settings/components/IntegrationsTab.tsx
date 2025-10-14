'use client';

import React, { useState } from 'react';
import { Plug, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SettingsSection } from './shared/SettingsSection';

interface Integration {
  id: string;
  type: string;
  name: string;
  status: 'active' | 'pending' | 'inactive' | 'not-configured';
  config: Record<string, unknown>;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface IntegrationsTabProps {
  organizations?: Organization[];
  initialOrganization?: string;
}

export default function IntegrationsTab({
  organizations = [],
  initialOrganization = '',
}: IntegrationsTabProps) {
  const [selectedOrganization, setSelectedOrganization] = useState(initialOrganization);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadIntegrations = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/integrations?organization_id=${selectedOrganization}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Define API response type
      interface IntegrationApiResponse {
        id: string;
        type: string;
        name: string;
        status: 'active' | 'inactive' | 'not-configured';
        settings?: Record<string, unknown>;
      }

      // Transform API response to match Integration interface
      const transformedIntegrations: Integration[] = (data.integrations || []).map((integration: IntegrationApiResponse) => ({
        id: integration.id,
        type: integration.type,
        name: integration.name,
        status: integration.status,
        config: integration.settings || {}
      }));

      setIntegrations(transformedIntegrations);
    } catch (error) {
      console.error('Error loading integrations:', error);
      // Show empty state on error instead of mock data
      setIntegrations([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrganization]);

  // Load integrations when organization changes
  React.useEffect(() => {
    if (selectedOrganization) {
      loadIntegrations();
    }
  }, [selectedOrganization, loadIntegrations]);

  const handleTestIntegration = async (integration: Integration) => {
    console.log('Testing integration:', integration.name);
    // TODO: Implement test integration
  };

  const handleSaveConfig = async () => {
    console.log('Saving config for:', selectedIntegration?.name);
    setShowConfigModal(false);
    // TODO: Implement save config
  };

  const getStatusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-500">
            <Check className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500">
            <AlertCircle className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>;
      case 'not-configured':
        return <Badge variant="outline">Not Configured</Badge>;
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'golioth':
        return '🌐';
      case 'email':
        return '📧';
      case 'slack':
        return '💬';
      case 'webhook':
        return '🔗';
      default:
        return '🔌';
    }
  };

  return (
    <div className="space-y-6">
      {/* Organization Selection */}
      <SettingsSection
        icon={<Plug className="w-5 h-5" />}
        title="Integrations"
        description="Connect with external services and platforms"
      >
        <div className="space-y-4">
          <div className="max-w-md">
            <label className="text-sm font-medium mb-2 block">Select Organization</label>
            <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an organization..." />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Integrations Grid */}
          {selectedOrganization && (
            <div className="mt-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading integrations...
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {integrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="border rounded-lg p-4 space-y-4 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{getIntegrationIcon(integration.type)}</span>
                          <div>
                            <h4 className="font-semibold">{integration.name}</h4>
                            <p className="text-sm text-muted-foreground capitalize">
                              {integration.type}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(integration.status)}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={integration.status === 'not-configured' ? 'default' : 'outline'}
                          onClick={() => {
                            setSelectedIntegration(integration);
                            setShowConfigModal(true);
                          }}
                          className="flex-1"
                        >
                          {integration.status === 'not-configured' ? 'Configure' : 'Edit'}
                        </Button>
                        {integration.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestIntegration(integration)}
                          >
                            Test
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Configuration Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {selectedIntegration?.name}</DialogTitle>
            <DialogDescription>
              Update the configuration for this integration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedIntegration?.type === 'golioth' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    defaultValue={String(selectedIntegration.config.apiKey || '')}
                    placeholder="Enter Golioth API key"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project ID</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.projectId || '')}
                    placeholder="Enter project ID"
                  />
                </div>
              </>
            )}

            {selectedIntegration?.type === 'email' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Host</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.smtpHost || '')}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Port</label>
                  <Input
                    type="number"
                    defaultValue={String(selectedIntegration.config.smtpPort || '')}
                    placeholder="587"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input placeholder="your-email@gmail.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" placeholder="Enter password" />
                </div>
              </>
            )}

            {selectedIntegration?.type === 'slack' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook URL</label>
                  <Input placeholder="https://hooks.slack.com/services/..." />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Channel</label>
                  <Input placeholder="#alerts" />
                </div>
              </>
            )}

            {selectedIntegration?.type === 'webhook' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook URL</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.url || '')}
                    placeholder="https://api.example.com/webhook"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Secret Key (Optional)</label>
                  <Input type="password" placeholder="Enter secret key" />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
