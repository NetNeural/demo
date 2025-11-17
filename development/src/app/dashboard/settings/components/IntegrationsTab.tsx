'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plug, Check, AlertCircle, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { edgeFunctions } from '@/lib/edge-functions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { handleApiError } from '@/lib/sentry-utils';
import { GoliothConfigDialog } from '@/components/integrations/GoliothConfigDialog';
import { ConflictResolutionDialog } from '@/components/integrations/ConflictResolutionDialog';
import { AwsIotConfigDialog } from '@/components/integrations/AwsIotConfigDialog';
import { AzureIotConfigDialog } from '@/components/integrations/AzureIotConfigDialog';
import { EmailConfigDialog } from '@/components/integrations/EmailConfigDialog';
import { SlackConfigDialog } from '@/components/integrations/SlackConfigDialog';
import { WebhookConfigDialog } from '@/components/integrations/WebhookConfigDialog';
import { MqttConfigDialog } from '@/components/integrations/MqttConfigDialog';
import { NetNeuralHubConfigDialog } from '@/components/integrations/NetNeuralHubConfigDialog';
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

// Integration type definitions with descriptions
const INTEGRATION_TYPES = [
  {
    value: 'golioth',
    label: '🌐 Golioth',
    icon: '🌐',
    description: 'Connect to Golioth IoT platform for device management, OTA updates, and cloud services',
    purpose: 'Device Management & Cloud Sync',
    requiredFields: ['API Key', 'Project ID'],
    useCases: 'Device provisioning, firmware updates, remote configuration, device monitoring'
  },
  {
    value: 'aws_iot',
    label: '☁️ AWS IoT Core',
    icon: '☁️',
    description: 'Integrate with Amazon Web Services IoT Core for scalable device connectivity',
    purpose: 'Enterprise Cloud IoT',
    requiredFields: ['Region', 'Access Key ID', 'Secret Access Key'],
    useCases: 'Device shadows, fleet management, AWS service integration, scalable IoT deployments'
  },
  {
    value: 'azure_iot',
    label: '🔵 Azure IoT Hub',
    icon: '🔵',
    description: 'Connect to Microsoft Azure IoT Hub for enterprise-grade IoT solutions',
    purpose: 'Microsoft Cloud Integration',
    requiredFields: ['Connection String', 'Hub Name'],
    useCases: 'Device twins, direct methods, Azure service integration, enterprise IoT'
  },
  {
    value: 'email',
    label: '📧 Email (SMTP)',
    icon: '📧',
    description: 'Send email notifications and alerts via SMTP server',
    purpose: 'Email Notifications',
    requiredFields: ['SMTP Host', 'Port', 'Username', 'Password'],
    useCases: 'Alert notifications, daily reports, device status emails, user notifications'
  },
  {
    value: 'slack',
    label: '💬 Slack',
    icon: '💬',
    description: 'Send real-time notifications to Slack channels for team collaboration',
    purpose: 'Team Messaging',
    requiredFields: ['Webhook URL', 'Channel'],
    useCases: 'Real-time alerts, team notifications, incident reports, device status updates'
  },
  {
    value: 'webhook',
    label: '🔗 Custom Webhook',
    icon: '🔗',
    description: 'Send HTTP POST requests to custom endpoints for event-driven integrations',
    purpose: 'Custom Integrations',
    requiredFields: ['Webhook URL'],
    useCases: 'Custom automation, third-party integrations, event forwarding, data pipelines'
  },
  {
    value: 'mqtt',
    label: '📡 MQTT Broker',
    icon: '📡',
    description: 'Connect to MQTT broker for pub/sub messaging with IoT devices',
    purpose: 'Device Messaging',
    requiredFields: ['Broker URL', 'Port'],
    useCases: 'Real-time device communication, telemetry streaming, command & control'
  },
  {
    value: 'netneural_hub',
    label: '🚀 NetNeural Hub',
    icon: '🚀',
    description: 'Multi-protocol hub for NetNeural custom devices (nRF9151, nRF52840, VMark, Universal Sensor)',
    purpose: 'Custom Device Management',
    requiredFields: ['Protocol Endpoints'],
    useCases: 'Direct device communication, protocol optimization, custom firmware support, edge processing'
  }
] as const;

interface Integration {
  id: string;
  type: string;
  name: string;
  status: 'active' | 'pending' | 'inactive' | 'not-configured';
  config: Record<string, unknown>;
  organization_id?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface IntegrationsTabProps {
  organizations?: Organization[];
  initialOrganization?: string;
  hideOrganizationSelector?: boolean;
}

export default function IntegrationsTab({
  organizations = [],
  initialOrganization = '',
  hideOrganizationSelector = false,
}: IntegrationsTabProps) {
  const router = useRouter();
  const [selectedOrganization, setSelectedOrganization] = useState(initialOrganization);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showGoliothConfig, setShowGoliothConfig] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [showAwsIotConfig, setShowAwsIotConfig] = useState(false);
  const [showAzureIotConfig, setShowAzureIotConfig] = useState(false);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [showSlackConfig, setShowSlackConfig] = useState(false);
  const [showWebhookConfig, setShowWebhookConfig] = useState(false);
  const [showMqttConfig, setShowMqttConfig] = useState(false);
  const [showNetNeuralHubConfig, setShowNetNeuralHubConfig] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // State for new integration
  const [newIntegrationType, setNewIntegrationType] = useState('');
  const [newIntegrationName, setNewIntegrationName] = useState('');
  const [integrationConfig, setIntegrationConfig] = useState<Record<string, string>>({});

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
        organization_id?: string;
      }

      // Transform API response to match Integration interface
      // API returns { success, data: { integrations: [...] } }
      const integrationsData = data.data?.integrations || data.integrations || [];
      const transformedIntegrations: Integration[] = integrationsData.map((integration: IntegrationApiResponse) => ({
        id: integration.id,
        type: integration.type,
        name: integration.name,
        status: integration.status,
        config: integration.settings || {},
        organization_id: integration.organization_id || selectedOrganization
      }));

      setIntegrations(transformedIntegrations);
    } catch (error) {
      console.error('Error loading integrations:', error);
      
      // Try fallback using edgeFunctions client
      try {
        const response = await edgeFunctions.integrations.list(selectedOrganization);
        
        if (!response.success) throw new Error(typeof response.error === 'string' ? response.error : 'Failed to load integrations');

        console.log('Loaded integrations via fallback edgeFunctions client');
        
        const integrationsList = (response.data as any)?.integrations || [];
        const fallbackIntegrations: Integration[] = integrationsList.map((integration: any) => ({
          id: integration.id,
          type: integration.type || integration.integrationType,
          name: integration.name,
          status: integration.status || 'not-configured',
          config: integration.config || integration.settings || {},
          organization_id: integration.organizationId || integration.organization_id || selectedOrganization
        }));

        setIntegrations(fallbackIntegrations);
        
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        toast({
          title: 'Failed to load integrations',
          description: (fallbackError as Error)?.message || 'Unknown error occurred',
          variant: 'destructive'
        });
        // Show empty state on error
        setIntegrations([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrganization, toast]);

  // Load integrations when organization changes
  React.useEffect(() => {
    if (selectedOrganization) {
      loadIntegrations();
    }
  }, [selectedOrganization, loadIntegrations]);

  const handleDeleteIntegration = async (integration: Integration) => {
    setIntegrationToDelete(integration);
    setShowDeleteDialog(true);
  };

  const confirmDeleteIntegration = async () => {
    if (!integrationToDelete) return;

    try {
      setIsDeleting(true);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: '❌ Authentication Required',
          description: 'Please log in to delete integrations.',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/integrations?id=${integrationToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `HTTP ${response.status}`);
        
        handleApiError(error, {
          endpoint: `/functions/v1/integrations?id=${integrationToDelete.id}`,
          method: 'DELETE',
          status: response.status,
          errorData,
          context: {
            integrationId: integrationToDelete.id,
            integrationName: integrationToDelete.name,
            integrationType: integrationToDelete.type,
            organizationId: selectedOrganization,
          },
        });
        
        toast({
          title: '❌ Delete Failed',
          description: errorData.error || 'Failed to delete integration. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: '✅ Integration Deleted',
        description: `${integrationToDelete.name} has been deleted successfully.`,
      });

      // Close dialog and reset state
      setShowDeleteDialog(false);
      setIntegrationToDelete(null);

      // Reload integrations
      await loadIntegrations();
    } catch (error) {
      console.error('Error deleting integration:', error);
      
      handleApiError(error instanceof Error ? error : new Error('Unknown error'), {
        endpoint: `/functions/v1/integrations?id=${integrationToDelete?.id}`,
        method: 'DELETE',
        context: {
          integrationId: integrationToDelete?.id,
          integrationName: integrationToDelete?.name,
          organizationId: selectedOrganization,
        },
      });
      
      toast({
        title: '❌ Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete integration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedIntegration) return;

    try {
      setIsLoading(true);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/integrations?id=${selectedIntegration.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            settings: integrationConfig,
            status: 'active'
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      toast({
        title: 'Configuration Saved',
        description: `Successfully updated ${selectedIntegration.name} configuration.`,
      });
      
      setShowConfigModal(false);
      setIntegrationConfig({});

      // Reload integrations
      await loadIntegrations();
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save configuration.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddIntegration = async () => {
    if (!newIntegrationType || !newIntegrationName) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoading(true);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/integrations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organization_id: selectedOrganization,
            integration_type: newIntegrationType,
            name: newIntegrationName,
            settings: integrationConfig
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Integration created:', result);
      
      toast({
        title: 'Integration Added',
        description: `${newIntegrationName} has been added successfully.`,
      });

      // Reset form
      setNewIntegrationType('');
      setNewIntegrationName('');
      setIntegrationConfig({});
      setShowAddModal(false);

      // Reload integrations
      await loadIntegrations();
    } catch (error) {
      console.error('Error adding integration:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add integration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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
    const integType = INTEGRATION_TYPES.find(t => t.value === type);
    return integType?.icon || '🔌';
  };

  return (
    <div className="space-y-6">
      {/* Organization Selection */}
      <SettingsSection
        icon={<Plug className="w-5 h-5" />}
        title="Integrations"
        description="Connect with external services and platforms"
        actions={
          selectedOrganization && (
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Integration
            </Button>
          )
        }
      >
        <div className="space-y-4">
          {/* Only show organization selector if not hidden */}
          {!hideOrganizationSelector && (
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
          )}

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
                            router.push(`/dashboard/integrations/view?id=${integration.id}&organizationId=${selectedOrganization}&type=${integration.type}`);
                          }}
                          className="flex-1"
                        >
                          {integration.status === 'not-configured' ? 'Configure' : 'Edit'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteIntegration(integration)}
                        >
                          Delete
                        </Button>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-900">Configure {selectedIntegration?.name}</DialogTitle>
            <DialogDescription>
              Update the configuration for this integration
            </DialogDescription>
          </DialogHeader>

          {/* Show integration info */}
          {selectedIntegration && (
            <div className="p-3 bg-gray-50 border rounded-lg">
              {(() => {
                const integType = INTEGRATION_TYPES.find(t => t.value === selectedIntegration.type);
                if (!integType) return null;
                
                return (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{integType.icon}</span>
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-gray-900">{integType.purpose}</p>
                      <p className="text-gray-600 mt-1">{integType.description}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="space-y-4 py-4">
            {selectedIntegration?.type === 'golioth' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    defaultValue={String(selectedIntegration.config.apiKey || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, apiKey: e.target.value })}
                    placeholder="Enter Golioth API key"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project ID</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.projectId || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, projectId: e.target.value })}
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
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Port</label>
                  <Input
                    type="number"
                    defaultValue={String(selectedIntegration.config.smtpPort || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, smtpPort: e.target.value })}
                    placeholder="587"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input 
                    defaultValue={String(selectedIntegration.config.username || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, username: e.target.value })}
                    placeholder="your-email@gmail.com" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input 
                    type="password" 
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, password: e.target.value })}
                    placeholder="Enter password" 
                  />
                </div>
              </>
            )}

            {selectedIntegration?.type === 'slack' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook URL</label>
                  <Input 
                    defaultValue={String(selectedIntegration.config.webhookUrl || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, webhookUrl: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..." 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Channel</label>
                  <Input 
                    defaultValue={String(selectedIntegration.config.channel || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, channel: e.target.value })}
                    placeholder="#alerts" 
                  />
                </div>
              </>
            )}

            {selectedIntegration?.type === 'webhook' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Webhook URL</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.url || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, url: e.target.value })}
                    placeholder="https://api.example.com/webhook"
                  />
                  <p className="text-xs text-gray-500">HTTP endpoint that will receive POST requests with event data</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Secret Key (Optional)</label>
                  <Input 
                    type="password" 
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, secretKey: e.target.value })}
                    placeholder="Enter secret key" 
                  />
                  <p className="text-xs text-gray-500">Used to verify webhook authenticity via HMAC signature</p>
                </div>
              </>
            )}

            {selectedIntegration?.type === 'mqtt' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Broker URL</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.broker || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, broker: e.target.value })}
                    placeholder="mqtt://broker.example.com"
                  />
                  <p className="text-xs text-gray-500">MQTT broker address (mqtt:// or mqtts:// for TLS)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Port</label>
                  <Input
                    type="number"
                    defaultValue={String(selectedIntegration.config.port || '1883')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, port: e.target.value })}
                    placeholder="1883"
                  />
                  <p className="text-xs text-gray-500">Standard: 1883 (MQTT), 8883 (MQTTS), 80/443 (WebSockets)</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username (Optional)</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.username || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, username: e.target.value })}
                    placeholder="mqtt_user"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password (Optional)</label>
                  <Input
                    type="password"
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, password: e.target.value })}
                    placeholder="Enter password"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client ID (Optional)</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.clientId || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, clientId: e.target.value })}
                    placeholder="netneural-mqtt-client"
                  />
                  <p className="text-xs text-gray-500">Unique identifier for this MQTT client connection</p>
                </div>
              </>
            )}

            {selectedIntegration?.type === 'aws_iot' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">AWS Region</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.region || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, region: e.target.value })}
                    placeholder="us-east-1"
                  />
                  <p className="text-xs text-gray-500">AWS region where your IoT Core is deployed</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Access Key ID</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.accessKeyId || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, accessKeyId: e.target.value })}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Secret Access Key</label>
                  <Input
                    type="password"
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, secretAccessKey: e.target.value })}
                    placeholder="Enter AWS secret access key"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">IoT Endpoint (Optional)</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.endpoint || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, endpoint: e.target.value })}
                    placeholder="xxxxxx-ats.iot.us-east-1.amazonaws.com"
                  />
                  <p className="text-xs text-gray-500">Custom IoT endpoint if not using default</p>
                </div>
              </>
            )}

            {selectedIntegration?.type === 'azure_iot' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Connection String</label>
                  <Input
                    type="password"
                    defaultValue={String(selectedIntegration.config.connectionString || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, connectionString: e.target.value })}
                    placeholder="HostName=...;SharedAccessKeyName=...;SharedAccessKey=..."
                  />
                  <p className="text-xs text-gray-500">IoT Hub connection string from Azure Portal</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hub Name (Optional)</label>
                  <Input
                    defaultValue={String(selectedIntegration.config.hubName || '')}
                    onChange={(e) => setIntegrationConfig({ ...integrationConfig, hubName: e.target.value })}
                    placeholder="my-iot-hub"
                  />
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

      {/* Add Integration Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-white dark:bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-900">Add New Integration</DialogTitle>
            <DialogDescription>
              Select an integration type and configure it for your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Integration Type *</label>
              <Select value={newIntegrationType} onValueChange={setNewIntegrationType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select integration type..." />
                </SelectTrigger>
                <SelectContent>
                  {INTEGRATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show integration description when type is selected */}
            {newIntegrationType && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                {(() => {
                  const selectedType = INTEGRATION_TYPES.find(t => t.value === newIntegrationType);
                  if (!selectedType) return null;
                  
                  return (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="text-2xl">{selectedType.icon}</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900">{selectedType.label}</h4>
                          <p className="text-sm text-blue-800 mt-1">{selectedType.description}</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-blue-300">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="font-medium text-blue-900">Purpose:</span>
                            <p className="text-blue-700">{selectedType.purpose}</p>
                          </div>
                          <div>
                            <span className="font-medium text-blue-900">Required Fields:</span>
                            <p className="text-blue-700">{selectedType.requiredFields.join(', ')}</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="font-medium text-blue-900">Use Cases:</span>
                          <p className="text-blue-700">{selectedType.useCases}</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Integration Name (Optional)</label>
              <Input
                value={newIntegrationName}
                onChange={(e) => setNewIntegrationName(e.target.value)}
                placeholder={
                  newIntegrationType 
                    ? `e.g., Production ${INTEGRATION_TYPES.find(t => t.value === newIntegrationType)?.label || 'Integration'}`
                    : 'e.g., Production Golioth, Alert Webhook'
                }
              />
              <p className="text-xs text-muted-foreground">
                You&apos;ll configure the full details in the next step
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddModal(false);
                setNewIntegrationType('');
                setNewIntegrationName('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Close the add modal and open the appropriate config dialog
                setShowAddModal(false);
                
                // Route to appropriate config dialog based on type
                switch (newIntegrationType) {
                  case 'golioth':
                    setSelectedIntegration(null); // null means creating new
                    setShowGoliothConfig(true);
                    break;
                  case 'aws_iot':
                    setSelectedIntegration(null);
                    setShowAwsIotConfig(true);
                    break;
                  case 'azure_iot':
                    setSelectedIntegration(null);
                    setShowAzureIotConfig(true);
                    break;
                  case 'email':
                    setSelectedIntegration(null);
                    setShowEmailConfig(true);
                    break;
                  case 'slack':
                    setSelectedIntegration(null);
                    setShowSlackConfig(true);
                    break;
                  case 'webhook':
                    setSelectedIntegration(null);
                    setShowWebhookConfig(true);
                    break;
                  case 'mqtt':
                    setSelectedIntegration(null);
                    setShowMqttConfig(true);
                    break;
                  case 'netneural_hub':
                    setSelectedIntegration(null);
                    setShowNetNeuralHubConfig(true);
                    break;
                  default:
                    // Fallback to old method for unknown types
                    handleAddIntegration();
                }
              }}
              disabled={!newIntegrationType}
            >
              Continue to Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Golioth Configuration Dialog */}
      {selectedOrganization && (
        <>
          <GoliothConfigDialog
            open={showGoliothConfig}
            onOpenChange={setShowGoliothConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowGoliothConfig(false);
              loadIntegrations();
            }}
          />

          <ConflictResolutionDialog
            open={showConflictDialog}
            onOpenChange={setShowConflictDialog}
            organizationId={selectedOrganization}
            onResolved={() => {
              setShowConflictDialog(false);
              loadIntegrations();
            }}
          />

          <AwsIotConfigDialog
            open={showAwsIotConfig}
            onOpenChange={setShowAwsIotConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowAwsIotConfig(false);
              loadIntegrations();
            }}
          />

          <AzureIotConfigDialog
            open={showAzureIotConfig}
            onOpenChange={setShowAzureIotConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowAzureIotConfig(false);
              loadIntegrations();
            }}
          />

          <EmailConfigDialog
            open={showEmailConfig}
            onOpenChange={setShowEmailConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowEmailConfig(false);
              loadIntegrations();
            }}
          />

          <SlackConfigDialog
            open={showSlackConfig}
            onOpenChange={setShowSlackConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowSlackConfig(false);
              loadIntegrations();
            }}
          />

          <WebhookConfigDialog
            open={showWebhookConfig}
            onOpenChange={setShowWebhookConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowWebhookConfig(false);
              loadIntegrations();
            }}
          />

          <MqttConfigDialog
            open={showMqttConfig}
            onOpenChange={setShowMqttConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowMqttConfig(false);
              loadIntegrations();
            }}
          />

          <NetNeuralHubConfigDialog
            open={showNetNeuralHubConfig}
            onOpenChange={setShowNetNeuralHubConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowNetNeuralHubConfig(false);
              loadIntegrations();
            }}
          />

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Integration</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete <strong>{integrationToDelete?.name}</strong>? 
                  This will remove all device mappings and configuration. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setIntegrationToDelete(null);
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDeleteIntegration}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Integration'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
