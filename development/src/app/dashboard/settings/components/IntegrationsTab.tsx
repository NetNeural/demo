'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plug, Check, AlertCircle, Plus, Copy } from 'lucide-react';
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
import { CopyIntegrationDialog } from '@/components/integrations/CopyIntegrationDialog';
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
    category: 'device',
    description: 'Connect to Golioth IoT platform for device management, OTA updates, and cloud services',
    purpose: 'Device Management & Cloud Sync',
    requiredFields: ['API Key', 'Project ID'],
    useCases: 'Device provisioning, firmware updates, remote configuration, device monitoring'
  },
  {
    value: 'aws_iot',
    label: '☁️ AWS IoT Core',
    icon: '☁️',
    category: 'device',
    description: 'Integrate with Amazon Web Services IoT Core for scalable device connectivity',
    purpose: 'Enterprise Cloud IoT',
    requiredFields: ['Region', 'Access Key ID', 'Secret Access Key'],
    useCases: 'Device shadows, fleet management, AWS service integration, scalable IoT deployments'
  },
  {
    value: 'azure_iot',
    label: '🔵 Azure IoT Hub',
    icon: '🔵',
    category: 'device',
    description: 'Connect to Microsoft Azure IoT Hub for enterprise-grade IoT solutions',
    purpose: 'Microsoft Cloud Integration',
    requiredFields: ['Connection String', 'Hub Name'],
    useCases: 'Device twins, direct methods, Azure service integration, enterprise IoT'
  },
  {
    value: 'email',
    label: '📧 Email (SMTP)',
    icon: '📧',
    category: 'notification',
    description: 'Send email notifications and alerts via SMTP server',
    purpose: 'Email Notifications',
    requiredFields: ['SMTP Host', 'Port', 'Username', 'Password'],
    useCases: 'Alert notifications, daily reports, device status emails, user notifications'
  },
  {
    value: 'slack',
    label: '💬 Slack',
    icon: '💬',
    category: 'notification',
    description: 'Send real-time notifications to Slack channels for team collaboration',
    purpose: 'Team Messaging',
    requiredFields: ['Webhook URL', 'Channel'],
    useCases: 'Real-time alerts, team notifications, incident reports, device status updates'
  },
  {
    value: 'webhook',
    label: '🔗 Custom Webhook',
    icon: '🔗',
    category: 'custom',
    description: 'Send HTTP POST requests to custom endpoints for event-driven integrations',
    purpose: 'Custom Integrations',
    requiredFields: ['Webhook URL'],
    useCases: 'Custom automation, third-party integrations, event forwarding, data pipelines'
  },
  {
    value: 'mqtt',
    label: '📡 MQTT Broker',
    icon: '📡',
    category: 'device',
    description: 'Connect to MQTT broker for pub/sub messaging with IoT devices',
    purpose: 'Device Messaging',
    requiredFields: ['Broker URL', 'Port'],
    useCases: 'Real-time device communication, telemetry streaming, command & control'
  },
  {
    value: 'netneural_hub',
    label: '🚀 NetNeural Hub',
    icon: '🚀',
    category: 'device',
    description: 'Multi-protocol hub for NetNeural custom devices (nRF9161, nRF52840, VMark, Universal Sensor)',
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
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [integrationToCopy, setIntegrationToCopy] = useState<Integration | null>(null);
  const { toast } = useToast();

  // State for new integration
  const [newIntegrationType, setNewIntegrationType] = useState('');
  const [newIntegrationName, setNewIntegrationName] = useState('');
  const [integrationConfig, setIntegrationConfig] = useState<Record<string, string>>({});
  const [mqttBrokerType, setMqttBrokerType] = useState<'hosted' | 'external'>('hosted');

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
                            // All integrations use view page for consistency
                            router.push(`/dashboard/integrations/view?id=${integration.id}&organizationId=${selectedOrganization}&type=${integration.type}`);
                          }}
                          className="flex-1"
                        >
                          {integration.status === 'not-configured' ? 'Configure' : 'Edit'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIntegrationToCopy(integration);
                            setShowCopyDialog(true);
                          }}
                        >
                          <Copy className="h-4 w-4" />
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

      {/* Quick Start Guides & Comparison */}
      {selectedOrganization && (
        <SettingsSection
          icon={<Plug className="w-5 h-5" />}
          title="Integration Guides"
          description="Quick start guides and comparison for each integration type"
        >
          <div className="space-y-8">
            {/* Golioth */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🌐</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Golioth IoT Platform</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Device management, OTA updates, and cloud services
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">✅ Pros</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Purpose-built for IoT devices</li>
                    <li>Automatic device provisioning</li>
                    <li>Built-in OTA firmware updates</li>
                    <li>Real-time device state management</li>
                    <li>Easy integration with embedded devices</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">⚠️ Cons</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Requires Golioth account</li>
                    <li>Platform-specific protocols</li>
                    <li>Additional subscription cost</li>
                    <li>Learning curve for Golioth SDK</li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/50 rounded p-3">
                <h4 className="font-medium text-sm mb-2">🚀 Quick Start</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create account at golioth.io</li>
                  <li>Generate API key from Golioth Console</li>
                  <li>Copy your Project ID</li>
                  <li>Click &quot;Add Integration&quot; → Select Golioth</li>
                  <li>Paste API key and Project ID</li>
                  <li>Test connection and save</li>
                </ol>
              </div>
            </div>

            {/* AWS IoT Core */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">☁️</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">AWS IoT Core</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enterprise-grade cloud IoT with AWS service integration
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">✅ Pros</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Massive scalability (billions of devices)</li>
                    <li>Integrates with all AWS services</li>
                    <li>Thing Shadows for device state</li>
                    <li>IoT Jobs for firmware updates</li>
                    <li>Enterprise security and compliance</li>
                    <li>Pay-as-you-go pricing</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">⚠️ Cons</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Requires AWS account and IAM setup</li>
                    <li>Complex pricing model</li>
                    <li>Steeper learning curve</li>
                    <li>No built-in telemetry storage</li>
                    <li>Requires IoT Analytics for history</li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/50 rounded p-3">
                <h4 className="font-medium text-sm mb-2">🚀 Quick Start</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create AWS account and enable IoT Core</li>
                  <li>Create IAM user with IoT permissions</li>
                  <li>Generate Access Key ID and Secret</li>
                  <li>Note your AWS region and IoT endpoint</li>
                  <li>Click &quot;Add Integration&quot; → Select AWS IoT</li>
                  <li>Enter credentials and test connection</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  📚 See <code>docs/AWS_IOT_ARCHITECTURE.md</code> for detailed setup
                </p>
              </div>
            </div>

            {/* Azure IoT Hub */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🔵</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Azure IoT Hub</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Microsoft cloud IoT with enterprise integration
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">✅ Pros</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Excellent Microsoft ecosystem integration</li>
                    <li>Device Twins for state management</li>
                    <li>Direct Methods for commands</li>
                    <li>Azure IoT Central for easy setup</li>
                    <li>Strong security features</li>
                    <li>Good documentation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">⚠️ Cons</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Requires Azure subscription</li>
                    <li>No built-in telemetry storage</li>
                    <li>Needs Time Series Insights for history</li>
                    <li>Complex pricing tiers</li>
                    <li>Less flexible than AWS IoT</li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/50 rounded p-3">
                <h4 className="font-medium text-sm mb-2">🚀 Quick Start</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create Azure account and IoT Hub</li>
                  <li>Get IoT Hub connection string</li>
                  <li>Note your Hub Name</li>
                  <li>Click &quot;Add Integration&quot; → Select Azure IoT</li>
                  <li>Paste connection string</li>
                  <li>Test connection and save</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  📚 See <code>docs/AZURE_IOT_ARCHITECTURE.md</code> for detailed setup
                </p>
              </div>
            </div>

            {/* MQTT */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">📡</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">MQTT Broker</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Standard IoT messaging protocol (hosted or external)
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">✅ Pros</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Industry standard protocol</li>
                    <li>Works with any MQTT-compatible device</li>
                    <li>Both hosted and external options</li>
                    <li>Low bandwidth, efficient</li>
                    <li>Flexible topic structure</li>
                    <li>No vendor lock-in</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">⚠️ Cons</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Requires MQTT broker setup/management</li>
                    <li>No built-in device management</li>
                    <li>Manual topic configuration needed</li>
                    <li>Security must be configured separately</li>
                    <li>No automatic firmware updates</li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/50 rounded p-3">
                <h4 className="font-medium text-sm mb-2">🚀 Quick Start</h4>
                <p className="text-sm font-medium mb-1">Option 1: Hosted (Easiest)</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside mb-3">
                  <li>Click &quot;Add Integration&quot; → Select MQTT</li>
                  <li>Choose &quot;Hosted&quot; broker type</li>
                  <li>Configure topic patterns</li>
                  <li>Devices connect automatically</li>
                </ol>
                <p className="text-sm font-medium mb-1">Option 2: External Broker</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Set up MQTT broker (Mosquitto, HiveMQ, etc.)</li>
                  <li>Get broker URL, port, credentials</li>
                  <li>Click &quot;Add Integration&quot; → Select MQTT</li>
                  <li>Choose &quot;External&quot; and enter broker details</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  📚 See <code>docs/MQTT_ARCHITECTURE.md</code> for detailed setup
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">📧</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Email (SMTP)</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Send alert notifications and reports via email
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">✅ Pros</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Universal - everyone has email</li>
                    <li>No additional accounts needed</li>
                    <li>Works with any SMTP server</li>
                    <li>Supports rich HTML formatting</li>
                    <li>Good for reports and summaries</li>
                    <li>Easy to set up</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">⚠️ Cons</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Not real-time (delivery delays)</li>
                    <li>Can be filtered to spam</li>
                    <li>Rate limits on sending</li>
                    <li>No interactive actions</li>
                    <li>SMTP credentials required</li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/50 rounded p-3">
                <h4 className="font-medium text-sm mb-2">🚀 Quick Start</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Get SMTP credentials (Gmail, SendGrid, etc.)</li>
                  <li>Click &quot;Add Integration&quot; → Select Email</li>
                  <li>Enter SMTP host, port, username, password</li>
                  <li>Configure &quot;From&quot; address</li>
                  <li>Test with sample email</li>
                  <li>Set up alert rules to trigger emails</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Tip: Use app-specific passwords for Gmail
                </p>
              </div>
            </div>

            {/* Slack */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">💬</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Slack</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Real-time team notifications in Slack channels
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">✅ Pros</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Real-time notifications</li>
                    <li>Rich formatting and attachments</li>
                    <li>Team collaboration built-in</li>
                    <li>Thread discussions</li>
                    <li>Mobile notifications</li>
                    <li>Easy webhook setup</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">⚠️ Cons</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Requires Slack workspace</li>
                    <li>Can be noisy with many alerts</li>
                    <li>Rate limits apply</li>
                    <li>Team must use Slack</li>
                    <li>No guaranteed delivery</li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/50 rounded p-3">
                <h4 className="font-medium text-sm mb-2">🚀 Quick Start</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to Slack App Directory</li>
                  <li>Create &quot;Incoming Webhook&quot; app</li>
                  <li>Choose channel for notifications</li>
                  <li>Copy webhook URL</li>
                  <li>Click &quot;Add Integration&quot; → Select Slack</li>
                  <li>Paste webhook URL and test</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Tip: Use different channels for different alert severities
                </p>
              </div>
            </div>

            {/* Webhook */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🔗</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">Custom Webhook</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    HTTP POST to any endpoint for custom integrations
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">✅ Pros</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Unlimited flexibility</li>
                    <li>Works with any HTTP endpoint</li>
                    <li>Custom data transformation</li>
                    <li>Integrate with any platform</li>
                    <li>Full control over payload</li>
                    <li>Event-driven automation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">⚠️ Cons</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Requires development work</li>
                    <li>Must host your own endpoint</li>
                    <li>No built-in error handling UI</li>
                    <li>Need to handle authentication</li>
                    <li>Must monitor webhook health</li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/50 rounded p-3">
                <h4 className="font-medium text-sm mb-2">🚀 Quick Start</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Create HTTP endpoint to receive POSTs</li>
                  <li>Implement webhook signature verification</li>
                  <li>Click &quot;Add Integration&quot; → Select Webhook</li>
                  <li>Enter your webhook URL</li>
                  <li>Configure events to forward</li>
                  <li>Test with sample payload</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  📚 Full OpenAPI spec available in configuration dialog
                </p>
              </div>
            </div>

            {/* NetNeural Hub */}
            <div className="border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <span className="text-3xl">🌟</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">NetNeural Hub</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Connect multiple NetNeural instances together
                  </p>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">✅ Pros</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Native NetNeural integration</li>
                    <li>Share devices across instances</li>
                    <li>Centralized monitoring</li>
                    <li>Multi-site deployments</li>
                    <li>Automatic sync</li>
                    <li>Built-in authentication</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm mb-2">⚠️ Cons</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Requires multiple NetNeural instances</li>
                    <li>Enterprise feature</li>
                    <li>Network connectivity required</li>
                    <li>Sync conflicts possible</li>
                  </ul>
                </div>
              </div>

              <div className="bg-muted/50 rounded p-3">
                <h4 className="font-medium text-sm mb-2">🚀 Quick Start</h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Ensure both NetNeural instances are accessible</li>
                  <li>Get API key from remote instance</li>
                  <li>Click &quot;Add Integration&quot; → Select NetNeural Hub</li>
                  <li>Enter remote instance URL and API key</li>
                  <li>Test connection</li>
                  <li>Configure sync settings</li>
                </ol>
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Use for disaster recovery and multi-region deployments
                </p>
              </div>
            </div>

            {/* Comparison Table */}
            <div className="border rounded-lg p-6 space-y-4">
              <h3 className="text-lg font-semibold">Integration Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Integration</th>
                      <th className="text-left py-2 px-3">Best For</th>
                      <th className="text-left py-2 px-3">Complexity</th>
                      <th className="text-left py-2 px-3">Cost</th>
                      <th className="text-left py-2 px-3">Setup Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 px-3">🌐 Golioth</td>
                      <td className="py-2 px-3">IoT devices, OTA updates</td>
                      <td className="py-2 px-3 text-green-600">Medium</td>
                      <td className="py-2 px-3 text-amber-600">$$</td>
                      <td className="py-2 px-3">30 min</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">☁️ AWS IoT</td>
                      <td className="py-2 px-3">Enterprise scale, AWS users</td>
                      <td className="py-2 px-3 text-red-600">High</td>
                      <td className="py-2 px-3 text-red-600">$$$</td>
                      <td className="py-2 px-3">2 hours</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">🔵 Azure IoT</td>
                      <td className="py-2 px-3">Microsoft ecosystem</td>
                      <td className="py-2 px-3 text-red-600">High</td>
                      <td className="py-2 px-3 text-red-600">$$$</td>
                      <td className="py-2 px-3">2 hours</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">📡 MQTT</td>
                      <td className="py-2 px-3">Standard devices, flexibility</td>
                      <td className="py-2 px-3 text-green-600">Low-Medium</td>
                      <td className="py-2 px-3 text-green-600">$</td>
                      <td className="py-2 px-3">15 min</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">📧 Email</td>
                      <td className="py-2 px-3">Notifications, reports</td>
                      <td className="py-2 px-3 text-green-600">Low</td>
                      <td className="py-2 px-3 text-green-600">$</td>
                      <td className="py-2 px-3">10 min</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">💬 Slack</td>
                      <td className="py-2 px-3">Team collaboration</td>
                      <td className="py-2 px-3 text-green-600">Low</td>
                      <td className="py-2 px-3 text-green-600">Free-$</td>
                      <td className="py-2 px-3">5 min</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-3">🔗 Webhook</td>
                      <td className="py-2 px-3">Custom integrations</td>
                      <td className="py-2 px-3 text-amber-600">Medium-High</td>
                      <td className="py-2 px-3 text-green-600">Free</td>
                      <td className="py-2 px-3">1 hour</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3">🌟 NetNeural Hub</td>
                      <td className="py-2 px-3">Multi-instance sync</td>
                      <td className="py-2 px-3 text-green-600">Low</td>
                      <td className="py-2 px-3 text-amber-600">$$</td>
                      <td className="py-2 px-3">15 min</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                * Complexity and cost ratings are approximate. Actual values depend on scale and requirements.
              </p>
            </div>
          </div>
        </SettingsSection>
      )}

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Integration</DialogTitle>
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
                  {/* Device Integrations */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    📱 Device Integrations
                  </div>
                  {INTEGRATION_TYPES.filter(t => t.category === 'device').map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                  
                  {/* Notification Integrations */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                    🔔 Notifications
                  </div>
                  {INTEGRATION_TYPES.filter(t => t.category === 'notification').map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                  
                  {/* Custom Integrations */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                    ⚙️ Custom
                  </div>
                  {INTEGRATION_TYPES.filter(t => t.category === 'custom').map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Show integration description when type is selected */}
            {newIntegrationType && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                {(() => {
                  const selectedType = INTEGRATION_TYPES.find(t => t.value === newIntegrationType);
                  if (!selectedType) return null;
                  
                  return (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="text-2xl">{selectedType.icon}</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100">{selectedType.label}</h4>
                          <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">{selectedType.description}</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-blue-300 dark:border-blue-700">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="font-medium text-blue-900 dark:text-blue-100">Purpose:</span>
                            <p className="text-blue-700 dark:text-blue-300">{selectedType.purpose}</p>
                          </div>
                          <div>
                            <span className="font-medium text-blue-900 dark:text-blue-100">Required Fields:</span>
                            <p className="text-blue-700 dark:text-blue-300">{selectedType.requiredFields.join(', ')}</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="font-medium text-blue-900 dark:text-blue-100">Use Cases:</span>
                          <p className="text-blue-700 dark:text-blue-300">{selectedType.useCases}</p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* MQTT Broker Type Selection */}
            {newIntegrationType === 'mqtt' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Broker Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      mqttBrokerType === 'hosted'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => setMqttBrokerType('hosted')}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">🚀 Hosted</span>
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">Recommended</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">NetNeural managed broker with auto-generated credentials</p>
                  </button>
                  <button
                    type="button"
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      mqttBrokerType === 'external'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => setMqttBrokerType('external')}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">🔧 External</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Advanced</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Connect to your own MQTT broker infrastructure</p>
                  </button>
                </div>
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
                setMqttBrokerType('hosted');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Close the add modal and navigate directly to configuration page
                setShowAddModal(false);
                
                // For MQTT, pass the specific broker subtype
                const finalType = newIntegrationType === 'mqtt' 
                  ? `mqtt_${mqttBrokerType}` 
                  : newIntegrationType;
                
                // All integrations use view page for consistency
                router.push(`/dashboard/integrations/view?id=new&organizationId=${selectedOrganization}&type=${finalType}`);
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
            onSaved={(integrationId) => {
              setShowMqttConfig(false);
              if (integrationId) {
                // Navigate to dedicated MQTT page
                router.push(`/dashboard/integrations/mqtt/${integrationId}?organizationId=${selectedOrganization}`);
              } else {
                loadIntegrations();
              }
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

          {/* Copy Integration Dialog */}
          <CopyIntegrationDialog
            integration={integrationToCopy}
            open={showCopyDialog}
            onOpenChange={setShowCopyDialog}
            onSuccess={() => {
              setShowCopyDialog(false);
              setIntegrationToCopy(null);
              loadIntegrations();
            }}
            currentOrgId={selectedOrganization}
          />
        </>
      )}
    </div>
  );
}
