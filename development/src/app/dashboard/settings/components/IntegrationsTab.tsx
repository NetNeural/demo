'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plug, Check, AlertCircle, Plus, Copy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { edgeFunctions } from '@/lib/edge-functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { handleApiError } from '@/lib/sentry-utils'
import { GoliothConfigDialog } from '@/components/integrations/GoliothConfigDialog'
import { ConflictResolutionDialog } from '@/components/integrations/ConflictResolutionDialog'
import { AwsIotConfigDialog } from '@/components/integrations/AwsIotConfigDialog'
import { AzureIotConfigDialog } from '@/components/integrations/AzureIotConfigDialog'
import { EmailConfigDialog } from '@/components/integrations/EmailConfigDialog'
import { SlackConfigDialog } from '@/components/integrations/SlackConfigDialog'
import { WebhookConfigDialog } from '@/components/integrations/WebhookConfigDialog'
import { MqttConfigDialog } from '@/components/integrations/MqttConfigDialog'
import { NetNeuralHubConfigDialog } from '@/components/integrations/NetNeuralHubConfigDialog'
import { CopyIntegrationDialog } from '@/components/integrations/CopyIntegrationDialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { SettingsSection } from './shared/SettingsSection'
import { FeatureGate } from '@/components/FeatureGate'

// Integration type definitions with descriptions
const INTEGRATION_TYPES = [
  {
    value: 'golioth',
    label: '🌐 Golioth',
    icon: '🌐',
    category: 'device',
    description:
      'Connect to Golioth IoT platform for device management, OTA updates, and cloud services',
    purpose: 'Device Management & Cloud Sync',
    requiredFields: ['API Key', 'Project ID'],
    useCases:
      'Device provisioning, firmware updates, remote configuration, device monitoring',
  },
  {
    value: 'aws_iot',
    label: '☁️ AWS IoT Core',
    icon: '☁️',
    category: 'device',
    description:
      'Integrate with Amazon Web Services IoT Core for scalable device connectivity',
    purpose: 'Enterprise Cloud IoT',
    requiredFields: ['Region', 'Access Key ID', 'Secret Access Key'],
    useCases:
      'Device shadows, fleet management, AWS service integration, scalable IoT deployments',
  },
  {
    value: 'azure_iot',
    label: '🔵 Azure IoT Hub',
    icon: '🔵',
    category: 'device',
    description:
      'Connect to Microsoft Azure IoT Hub for enterprise-grade IoT solutions',
    purpose: 'Microsoft Cloud Integration',
    requiredFields: ['Connection String', 'Hub Name'],
    useCases:
      'Device twins, direct methods, Azure service integration, enterprise IoT',
  },
  {
    value: 'email',
    label: '📧 Email (SMTP)',
    icon: '📧',
    category: 'notification',
    description: 'Send email notifications and alerts via SMTP server',
    purpose: 'Email Notifications',
    requiredFields: ['SMTP Host', 'Port', 'Username', 'Password'],
    useCases:
      'Alert notifications, daily reports, device status emails, user notifications',
  },
  {
    value: 'slack',
    label: '💬 Slack',
    icon: '💬',
    category: 'notification',
    description:
      'Send real-time notifications to Slack channels for team collaboration',
    purpose: 'Team Messaging',
    requiredFields: ['Webhook URL', 'Channel'],
    useCases:
      'Real-time alerts, team notifications, incident reports, device status updates',
  },
  {
    value: 'webhook',
    label: '🔗 Custom Webhook',
    icon: '🔗',
    category: 'custom',
    description:
      'Send HTTP POST requests to custom endpoints for event-driven integrations',
    purpose: 'Custom Integrations',
    requiredFields: ['Webhook URL'],
    useCases:
      'Custom automation, third-party integrations, event forwarding, data pipelines',
  },
  {
    value: 'mqtt',
    label: '📡 MQTT Broker',
    icon: '📡',
    category: 'device',
    description:
      'Connect to MQTT broker for pub/sub messaging with IoT devices',
    purpose: 'Device Messaging',
    requiredFields: ['Broker URL', 'Port'],
    useCases:
      'Real-time device communication, telemetry streaming, command & control',
  },
  {
    value: 'netneural_hub',
    label: '🚀 NetNeural Hub',
    icon: '🚀',
    category: 'device',
    description:
      'Multi-protocol hub for NetNeural custom devices (nRF9161, nRF52840, VMark, Universal Sensor)',
    purpose: 'Custom Device Management',
    requiredFields: ['Protocol Endpoints'],
    useCases:
      'Direct device communication, protocol optimization, custom firmware support, edge processing',
  },
] as const

// Integration Guides Data
const INTEGRATION_GUIDES = [
  {
    id: 'golioth',
    name: 'Golioth IoT Platform',
    icon: '🌐',
    description: 'Device management, OTA updates, and cloud services',
    pros: [
      'Purpose-built for IoT devices',
      'Automatic device provisioning',
      'Built-in OTA firmware updates',
      'Real-time device state management',
      'Easy integration with embedded devices',
    ],
    cons: [
      'Requires Golioth account',
      'Platform-specific protocols',
      'Additional subscription cost',
      'Learning curve for Golioth SDK',
    ],
    quickStart: [
      'Create account at golioth.io',
      'Generate API key from Golioth Console',
      'Copy your Project ID',
      'Click "Add Integration" → Select Golioth',
      'Paste API key and Project ID',
      'Test connection and save',
    ],
    bestFor: 'IoT embedded devices',
    complexity: 'Medium',
    cost: '$$',
    setupTime: '30 min',
  },
  {
    id: 'aws',
    name: 'AWS IoT Core',
    icon: '☁️',
    description: 'Enterprise-grade cloud IoT with AWS service integration',
    pros: [
      'Massive scalability (billions of devices)',
      'Integrates with all AWS services',
      'Thing Shadows for device state',
      'IoT Jobs for firmware updates',
      'Enterprise security and compliance',
      'Pay-as-you-go pricing',
    ],
    cons: [
      'Complex setup and configuration',
      'Requires AWS expertise',
      'Can be expensive at scale',
      'Steep learning curve',
      'No built-in telemetry storage (requires IoT Analytics)',
    ],
    quickStart: [
      'Create AWS account and log into IAM console',
      'Create IAM user with IoT permissions',
      'Generate Access Key ID and Secret Key',
      'Click "Add Integration" → Select AWS IoT',
      'Enter credentials and region',
      'Test connection and save',
    ],
    docs: 'docs/AWS_IOT_ARCHITECTURE.md',
    bestFor: 'Enterprise scale, AWS users',
    complexity: 'High',
    cost: '$$$',
    setupTime: '2 hours',
  },
  {
    id: 'azure',
    name: 'Azure IoT Hub',
    icon: '🔵',
    description: 'Microsoft Azure cloud IoT platform with device twins',
    pros: [
      'Seamless Azure ecosystem integration',
      'Device Twins for state management',
      'Strong security with Azure AD',
      'Azure IoT Central for rapid development',
      'Excellent documentation and support',
    ],
    cons: [
      'Complex pricing model',
      'Requires Azure subscription',
      'Learning curve for Azure services',
      'Can be expensive for small deployments',
    ],
    quickStart: [
      'Create Azure account and IoT Hub',
      'Generate connection string from Azure Portal',
      'Copy IoT Hub name and resource group',
      'Click "Add Integration" → Select Azure IoT',
      'Paste connection string',
      'Test connection and save',
    ],
    docs: 'docs/AZURE_IOT_ARCHITECTURE.md',
    bestFor: 'Microsoft ecosystem',
    complexity: 'High',
    cost: '$$$',
    setupTime: '2 hours',
  },
  {
    id: 'mqtt',
    name: 'MQTT Broker',
    icon: '📡',
    description: 'Standard MQTT protocol for flexible device communication',
    pros: [
      'Industry standard protocol',
      'Flexible topic structure',
      'Low bandwidth overhead',
      'Wide device support',
      'Open source brokers available',
    ],
    cons: [
      'Requires broker setup (or use hosted)',
      'No built-in device registry',
      'Manual topic management',
      'Security depends on broker configuration',
    ],
    quickStart: [
      {
        title: 'Option 1: Hosted (Easiest)',
        steps: [
          'Click "Add Integration" → Select MQTT',
          'Choose "Hosted" broker type',
          'Configure topic patterns',
          'Devices connect automatically',
        ],
      },
      {
        title: 'Option 2: External Broker',
        steps: [
          'Set up MQTT broker (Mosquitto, HiveMQ, etc.)',
          'Get broker URL, port, credentials',
          'Click "Add Integration" → Select MQTT',
          'Choose "External" and enter broker details',
        ],
      },
    ],
    docs: 'docs/MQTT_ARCHITECTURE.md',
    bestFor: 'Standard devices, flexibility',
    complexity: 'Low-Medium',
    cost: '$',
    setupTime: '15 min',
  },
  {
    id: 'email',
    name: 'Email/SMTP',
    icon: '📧',
    description: 'Send email notifications for alerts and reports',
    pros: [
      'Universal - everyone has email',
      'Simple to set up',
      'Works with any SMTP provider',
      'Good for reports and summaries',
    ],
    cons: [
      'Not real-time',
      'Can end up in spam',
      'Limited formatting options',
      'Not suitable for high-frequency alerts',
    ],
    quickStart: [
      'Get SMTP credentials (Gmail, SendGrid, etc.)',
      'Click "Add Integration" → Select Email',
      'Enter SMTP host, port, username, password',
      'Configure "From" address',
      'Test with sample email',
      'Set up alert rules to trigger emails',
    ],
    bestFor: 'Notifications, reports',
    complexity: 'Low',
    cost: '$',
    setupTime: '10 min',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Real-time team notifications via Slack channels',
    pros: [
      'Real-time notifications',
      'Team collaboration features',
      'Rich message formatting',
      'Mobile app support',
      'Easy webhook setup',
    ],
    cons: [
      'Requires Slack workspace',
      'Can be noisy with too many alerts',
      'Limited to Slack users',
      'Webhook URLs must be kept secret',
    ],
    quickStart: [
      'Go to Slack workspace Settings & permissions',
      'Create "Incoming Webhook" app',
      'Select channel for notifications',
      'Copy webhook URL',
      'Click "Add Integration" → Select Slack',
      'Paste webhook URL and test',
    ],
    bestFor: 'Team collaboration',
    complexity: 'Low',
    cost: 'Free-$',
    setupTime: '5 min',
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    icon: '🔗',
    description: 'HTTP POST to your custom endpoint for any integration',
    pros: [
      'Complete flexibility',
      'Integrate with any service',
      'Custom data transformation',
      'No platform lock-in',
      'Free (just hosting costs)',
    ],
    cons: [
      'Requires development work',
      'You handle security and scaling',
      'No built-in retry logic',
      'Debugging can be challenging',
      'Need to maintain endpoint',
    ],
    quickStart: [
      'Set up HTTP endpoint to receive POST requests',
      'Get the full URL (e.g., https://api.example.com/iot/webhook)',
      'Click "Add Integration" → Select Webhook',
      'Enter URL and configure payload format',
      'Set up authentication if required',
      'Test with sample device event',
    ],
    bestFor: 'Custom integrations',
    complexity: 'Medium-High',
    cost: 'Free',
    setupTime: '1 hour',
  },
  {
    id: 'netneural',
    name: 'NetNeural Hub',
    icon: '🌟',
    description: 'Multi-protocol hub for custom NetNeural devices',
    pros: [
      'Supports CoAP, MQTT, and HTTPS',
      'Auto-discovery of devices',
      'Protocol routing and fallback',
      'Optimized for NetNeural hardware',
      'Built-in device capability detection',
    ],
    cons: [
      'Specific to NetNeural devices',
      'Requires hub instance',
      'More complex initial setup',
      'Additional infrastructure cost',
    ],
    quickStart: [
      'Set up NetNeural Hub instance (optional)',
      'Get Hub URL and authentication credentials',
      'Click "Add Integration" → Select NetNeural Hub',
      'Configure protocols (CoAP, MQTT, HTTPS)',
      'Set device routing rules',
      'Enable auto-discovery and test',
    ],
    bestFor: 'Multi-instance sync',
    complexity: 'Low',
    cost: '$$',
    setupTime: '15 min',
  },
]

interface Integration {
  id: string
  type: string
  name: string
  status: 'active' | 'pending' | 'inactive' | 'not-configured'
  config: Record<string, unknown>
  organization_id?: string
}

interface Organization {
  id: string
  name: string
  slug: string
}

interface IntegrationsTabProps {
  organizations?: Organization[]
  initialOrganization?: string
  hideOrganizationSelector?: boolean
}

export default function IntegrationsTab({
  organizations = [],
  initialOrganization = '',
  hideOrganizationSelector = false,
}: IntegrationsTabProps) {
  const router = useRouter()
  const [selectedOrganization, setSelectedOrganization] =
    useState(initialOrganization)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showGoliothConfig, setShowGoliothConfig] = useState(false)
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [showAwsIotConfig, setShowAwsIotConfig] = useState(false)
  const [showAzureIotConfig, setShowAzureIotConfig] = useState(false)
  const [showEmailConfig, setShowEmailConfig] = useState(false)
  const [showSlackConfig, setShowSlackConfig] = useState(false)
  const [showWebhookConfig, setShowWebhookConfig] = useState(false)
  const [showMqttConfig, setShowMqttConfig] = useState(false)
  const [showNetNeuralHubConfig, setShowNetNeuralHubConfig] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [integrationToDelete, setIntegrationToDelete] =
    useState<Integration | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [integrationToCopy, setIntegrationToCopy] =
    useState<Integration | null>(null)
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null)
  const { toast } = useToast()

  // State for new integration
  const [newIntegrationType, setNewIntegrationType] = useState('')
  const [newIntegrationName, setNewIntegrationName] = useState('')
  const [integrationConfig, setIntegrationConfig] = useState<
    Record<string, string>
  >({})
  const [mqttBrokerType, setMqttBrokerType] = useState<'hosted' | 'external'>(
    'hosted'
  )

  const loadIntegrations = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/integrations?organization_id=${selectedOrganization}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Define API response type
      interface IntegrationApiResponse {
        id: string
        type: string
        name: string
        status: 'active' | 'inactive' | 'not-configured'
        settings?: Record<string, unknown>
        organization_id?: string
      }

      // Transform API response to match Integration interface
      // API returns { success, data: { integrations: [...] } }
      const integrationsData =
        data.data?.integrations || data.integrations || []
      const transformedIntegrations: Integration[] = integrationsData.map(
        (integration: IntegrationApiResponse) => ({
          id: integration.id,
          type: integration.type,
          name: integration.name,
          status: integration.status,
          config: integration.settings || {},
          organization_id: integration.organization_id || selectedOrganization,
        })
      )

      setIntegrations(transformedIntegrations)
    } catch (error) {
      console.error('Error loading integrations:', error)

      // Try fallback using edgeFunctions client
      try {
        const response =
          await edgeFunctions.integrations.list(selectedOrganization)

        if (!response.success)
          throw new Error(
            typeof response.error === 'string'
              ? response.error
              : 'Failed to load integrations'
          )

        console.log('Loaded integrations via fallback edgeFunctions client')

        const integrationsList = (response.data as any)?.integrations || []
        const fallbackIntegrations: Integration[] = integrationsList.map(
          (integration: any) => ({
            id: integration.id,
            type: integration.type || integration.integrationType,
            name: integration.name,
            status: integration.status || 'not-configured',
            config: integration.config || integration.settings || {},
            organization_id:
              integration.organizationId ||
              integration.organization_id ||
              selectedOrganization,
          })
        )

        setIntegrations(fallbackIntegrations)
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError)
        toast({
          title: 'Failed to load integrations',
          description:
            (fallbackError as Error)?.message || 'Unknown error occurred',
          variant: 'destructive',
        })
        // Show empty state on error
        setIntegrations([])
      }
    } finally {
      setIsLoading(false)
    }
  }, [selectedOrganization, toast])

  // Load integrations when organization changes
  React.useEffect(() => {
    if (selectedOrganization) {
      loadIntegrations()
    }
  }, [selectedOrganization, loadIntegrations])

  const handleDeleteIntegration = async (integration: Integration) => {
    setIntegrationToDelete(integration)
    setShowDeleteDialog(true)
  }

  const confirmDeleteIntegration = async () => {
    if (!integrationToDelete) return

    try {
      setIsDeleting(true)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        toast({
          title: '❌ Authentication Required',
          description: 'Please log in to delete integrations.',
          variant: 'destructive',
        })
        return
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/integrations?id=${integrationToDelete.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error = new Error(errorData.error || `HTTP ${response.status}`)

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
        })

        toast({
          title: '❌ Delete Failed',
          description:
            errorData.error ||
            'Failed to delete integration. Please try again.',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: '✅ Integration Deleted',
        description: `${integrationToDelete.name} has been deleted successfully.`,
      })

      // Close dialog and reset state
      setShowDeleteDialog(false)
      setIntegrationToDelete(null)

      // Reload integrations
      await loadIntegrations()
    } catch (error) {
      console.error('Error deleting integration:', error)

      handleApiError(
        error instanceof Error ? error : new Error('Unknown error'),
        {
          endpoint: `/functions/v1/integrations?id=${integrationToDelete?.id}`,
          method: 'DELETE',
          context: {
            integrationId: integrationToDelete?.id,
            integrationName: integrationToDelete?.name,
            organizationId: selectedOrganization,
          },
        }
      )

      toast({
        title: '❌ Delete Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to delete integration. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!selectedIntegration) return

    try {
      setIsLoading(true)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/integrations?id=${selectedIntegration.id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            settings: integrationConfig,
            status: 'active',
          }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        )
      }

      toast({
        title: 'Configuration Saved',
        description: `Successfully updated ${selectedIntegration.name} configuration.`,
      })

      setShowConfigModal(false)
      setIntegrationConfig({})

      // Reload integrations
      await loadIntegrations()
    } catch (error) {
      console.error('Error saving config:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save configuration.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddIntegration = async () => {
    if (!newIntegrationType || !newIntegrationName) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsLoading(true)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('No active session')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/integrations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organization_id: selectedOrganization,
          integration_type: newIntegrationType,
          name: newIntegrationName,
          settings: integrationConfig,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        )
      }

      const result = await response.json()
      console.log('Integration created:', result)

      toast({
        title: 'Integration Added',
        description: `${newIntegrationName} has been added successfully.`,
      })

      // Reset form
      setNewIntegrationType('')
      setNewIntegrationName('')
      setIntegrationConfig({})
      setShowAddModal(false)

      // Reload integrations
      await loadIntegrations()
    } catch (error) {
      console.error('Error adding integration:', error)
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to add integration. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: Integration['status']) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-green-500">
            <Check className="mr-1 h-3 w-3" />
            Active
          </Badge>
        )
      case 'pending':
        return (
          <Badge className="bg-yellow-500">
            <AlertCircle className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
      case 'inactive':
        return <Badge variant="secondary">Inactive</Badge>
      case 'not-configured':
        return <Badge variant="outline">Not Configured</Badge>
    }
  }

  const getIntegrationIcon = (type: string) => {
    const integType = INTEGRATION_TYPES.find((t) => t.value === type)
    return integType?.icon || '🔌'
  }

  return (
    <div className="space-y-6">
      {/* Organization Selection */}
      <SettingsSection
        icon={<Plug className="h-5 w-5" />}
        title="Integrations"
        description="Connect with external services and platforms"
        actions={
          selectedOrganization && (
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Integration
            </Button>
          )
        }
      >
        <div className="space-y-4">
          {/* Only show organization selector if not hidden */}
          {!hideOrganizationSelector && (
            <div className="max-w-md">
              <label className="mb-2 block text-sm font-medium">
                Select Organization
              </label>
              <Select
                value={selectedOrganization}
                onValueChange={setSelectedOrganization}
              >
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
                <div className="py-8 text-center text-muted-foreground">
                  Loading integrations...
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {integrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="space-y-4 rounded-lg border p-4 transition-colors hover:border-primary/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">
                            {getIntegrationIcon(integration.type)}
                          </span>
                          <div>
                            <h4 className="font-semibold">
                              {integration.name}
                            </h4>
                            <p className="text-sm capitalize text-muted-foreground">
                              {integration.type}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(integration.status)}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={
                            integration.status === 'not-configured'
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => {
                            // All integrations use view page for consistency
                            router.push(
                              `/dashboard/integrations/view?id=${integration.id}&organizationId=${selectedOrganization}&type=${integration.type}`
                            )
                          }}
                          className="flex-1"
                        >
                          {integration.status === 'not-configured'
                            ? 'Configure'
                            : 'Edit'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIntegrationToCopy(integration)
                            setShowCopyDialog(true)
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

      {/* Quick Start Guides - Interactive Grid */}
      {selectedOrganization && (
        <SettingsSection
          icon={<Plug className="h-5 w-5" />}
          title="Integration Guides"
          description="Click any integration to view detailed setup guide and comparison"
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {INTEGRATION_GUIDES.map((guide) => (
              <button
                key={guide.id}
                onClick={() => setSelectedGuide(guide.id)}
                className="group relative flex flex-col items-center gap-3 rounded-lg border-2 border-border bg-card p-6 transition-all duration-200 hover:border-primary hover:bg-accent hover:shadow-lg"
              >
                <span className="text-5xl transition-transform duration-200 group-hover:scale-110">
                  {guide.icon}
                </span>
                <div className="text-center">
                  <h3 className="text-sm font-semibold">{guide.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {guide.description}
                  </p>
                </div>
                <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Badge variant="secondary" className="text-xs">
                    Click for details
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          {/* Quick Reference Table */}
          <div className="mt-8">
            <h3 className="mb-4 text-lg font-semibold">Quick Comparison</h3>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-border">
                    <th className="px-3 py-2 text-left font-semibold">
                      Integration
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Best For
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Complexity
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">Cost</th>
                    <th className="px-3 py-2 text-left font-semibold">
                      Setup Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {INTEGRATION_GUIDES.map((guide) => (
                    <tr
                      key={guide.id}
                      className="cursor-pointer border-b border-border hover:bg-accent"
                      onClick={() => setSelectedGuide(guide.id)}
                    >
                      <td className="px-3 py-2">
                        <span className="mr-2">{guide.icon}</span>
                        {guide.name}
                      </td>
                      <td className="px-3 py-2">{guide.bestFor}</td>
                      <td
                        className={`px-3 py-2 ${
                          guide.complexity.includes('High')
                            ? 'text-red-600'
                            : guide.complexity.includes('Medium')
                              ? 'text-amber-600'
                              : 'text-green-600'
                        }`}
                      >
                        {guide.complexity}
                      </td>
                      <td
                        className={`px-3 py-2 ${
                          guide.cost === '$$$'
                            ? 'text-red-600'
                            : guide.cost === '$$'
                              ? 'text-amber-600'
                              : 'text-green-600'
                        }`}
                      >
                        {guide.cost}
                      </td>
                      <td className="px-3 py-2">{guide.setupTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              * Complexity and cost ratings are approximate. Actual values
              depend on scale and requirements.
            </p>
          </div>
        </SettingsSection>
      )}

      {/* Integration Guide Detail Dialog */}
      {selectedGuide && (
        <Dialog
          open={!!selectedGuide}
          onOpenChange={() => setSelectedGuide(null)}
        >
          <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
            {(() => {
              const guide = INTEGRATION_GUIDES.find(
                (g) => g.id === selectedGuide
              )
              if (!guide) return null

              return (
                <>
                  <DialogHeader>
                    <div className="mb-2 flex items-center gap-3">
                      <span className="text-5xl">{guide.icon}</span>
                      <div>
                        <DialogTitle className="text-2xl">
                          {guide.name}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-base">
                          {guide.description}
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="mt-4 space-y-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <div className="text-xs text-muted-foreground">
                          Complexity
                        </div>
                        <div
                          className={`mt-1 font-semibold ${
                            guide.complexity.includes('High')
                              ? 'text-red-600'
                              : guide.complexity.includes('Medium')
                                ? 'text-amber-600'
                                : 'text-green-600'
                          }`}
                        >
                          {guide.complexity}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <div className="text-xs text-muted-foreground">
                          Cost
                        </div>
                        <div
                          className={`mt-1 font-semibold ${
                            guide.cost === '$$$'
                              ? 'text-red-600'
                              : guide.cost === '$$'
                                ? 'text-amber-600'
                                : 'text-green-600'
                          }`}
                        >
                          {guide.cost}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <div className="text-xs text-muted-foreground">
                          Setup Time
                        </div>
                        <div className="mt-1 font-semibold">
                          {guide.setupTime}
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-center">
                        <div className="text-xs text-muted-foreground">
                          Best For
                        </div>
                        <div className="mt-1 text-xs font-semibold">
                          {guide.bestFor}
                        </div>
                      </div>
                    </div>

                    {/* Pros and Cons */}
                    <div className="grid gap-6 md:grid-cols-2">
                      <div>
                        <h4 className="mb-3 flex items-center gap-2 font-semibold">
                          <Check className="h-4 w-4 text-green-600" />
                          Pros
                        </h4>
                        <ul className="space-y-2">
                          {guide.pros.map((pro, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span className="mt-0.5 text-green-600">✓</span>
                              <span>{pro}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-3 flex items-center gap-2 font-semibold">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          Cons
                        </h4>
                        <ul className="space-y-2">
                          {guide.cons.map((con, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span className="mt-0.5 text-amber-600">⚠</span>
                              <span>{con}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Quick Start Guide */}
                    <div className="rounded-lg bg-muted/50 p-4">
                      <h4 className="mb-3 flex items-center gap-2 font-semibold">
                        <span className="text-xl">🚀</span>
                        Quick Start Guide
                      </h4>
                      {typeof guide.quickStart[0] === 'string' ? (
                        <ol className="list-inside list-decimal space-y-2">
                          {(guide.quickStart as string[]).map((step, idx) => (
                            <li
                              key={idx}
                              className="text-sm text-muted-foreground"
                            >
                              {step}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div className="space-y-4">
                          {(
                            guide.quickStart as Array<{
                              title: string
                              steps: string[]
                            }>
                          ).map((option, idx) => (
                            <div key={idx}>
                              <p className="mb-2 text-sm font-medium">
                                {option.title}
                              </p>
                              <ol className="ml-4 list-inside list-decimal space-y-1">
                                {option.steps.map((step, stepIdx) => (
                                  <li
                                    key={stepIdx}
                                    className="text-sm text-muted-foreground"
                                  >
                                    {step}
                                  </li>
                                ))}
                              </ol>
                            </div>
                          ))}
                        </div>
                      )}
                      {guide.docs && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          📚 Detailed documentation:{' '}
                          <code className="rounded bg-background px-1 py-0.5">
                            {guide.docs}
                          </code>
                        </p>
                      )}
                    </div>
                  </div>

                  <DialogFooter className="mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedGuide(null)}
                    >
                      Close
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedGuide(null)
                        // Scroll to integrations list to add new integration
                        document
                          .querySelector('[data-integrations-list]')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      Add This Integration
                    </Button>
                  </DialogFooter>
                </>
              )
            })()}
          </DialogContent>
        </Dialog>
      )}
      {/* Golioth */}

      {/* Configuration Modal */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-white dark:bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-900">
              Configure {selectedIntegration?.name}
            </DialogTitle>
            <DialogDescription>
              Update the configuration for this integration
            </DialogDescription>
          </DialogHeader>

          {/* Show integration info */}
          {selectedIntegration && (
            <div className="rounded-lg border bg-gray-50 p-3">
              {(() => {
                const integType = INTEGRATION_TYPES.find(
                  (t) => t.value === selectedIntegration.type
                )
                if (!integType) return null

                return (
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{integType.icon}</span>
                    <div className="flex-1 text-sm">
                      <p className="font-medium text-gray-900">
                        {integType.purpose}
                      </p>
                      <p className="mt-1 text-gray-600">
                        {integType.description}
                      </p>
                    </div>
                  </div>
                )
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
                    defaultValue={String(
                      selectedIntegration.config.apiKey || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        apiKey: e.target.value,
                      })
                    }
                    placeholder="Enter Golioth API key"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project ID</label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.projectId || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        projectId: e.target.value,
                      })
                    }
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
                    defaultValue={String(
                      selectedIntegration.config.smtpHost || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        smtpHost: e.target.value,
                      })
                    }
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">SMTP Port</label>
                  <Input
                    type="number"
                    defaultValue={String(
                      selectedIntegration.config.smtpPort || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        smtpPort: e.target.value,
                      })
                    }
                    placeholder="587"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.username || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        username: e.target.value,
                      })
                    }
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        password: e.target.value,
                      })
                    }
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
                    defaultValue={String(
                      selectedIntegration.config.webhookUrl || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        webhookUrl: e.target.value,
                      })
                    }
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Channel</label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.channel || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        channel: e.target.value,
                      })
                    }
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
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        url: e.target.value,
                      })
                    }
                    placeholder="https://api.example.com/webhook"
                  />
                  <p className="text-xs text-gray-500">
                    HTTP endpoint that will receive POST requests with event
                    data
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Secret Key (Optional)
                  </label>
                  <Input
                    type="password"
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        secretKey: e.target.value,
                      })
                    }
                    placeholder="Enter secret key"
                  />
                  <p className="text-xs text-gray-500">
                    Used to verify webhook authenticity via HMAC signature
                  </p>
                </div>
              </>
            )}

            {selectedIntegration?.type === 'mqtt' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Broker URL</label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.broker || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        broker: e.target.value,
                      })
                    }
                    placeholder="mqtt://broker.example.com"
                  />
                  <p className="text-xs text-gray-500">
                    MQTT broker address (mqtt:// or mqtts:// for TLS)
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Port</label>
                  <Input
                    type="number"
                    defaultValue={String(
                      selectedIntegration.config.port || '1883'
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        port: e.target.value,
                      })
                    }
                    placeholder="1883"
                  />
                  <p className="text-xs text-gray-500">
                    Standard: 1883 (MQTT), 8883 (MQTTS), 80/443 (WebSockets)
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Username (Optional)
                  </label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.username || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        username: e.target.value,
                      })
                    }
                    placeholder="mqtt_user"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Password (Optional)
                  </label>
                  <Input
                    type="password"
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        password: e.target.value,
                      })
                    }
                    placeholder="Enter password"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Client ID (Optional)
                  </label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.clientId || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        clientId: e.target.value,
                      })
                    }
                    placeholder="netneural-mqtt-client"
                  />
                  <p className="text-xs text-gray-500">
                    Unique identifier for this MQTT client connection
                  </p>
                </div>
              </>
            )}

            {selectedIntegration?.type === 'aws_iot' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">AWS Region</label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.region || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        region: e.target.value,
                      })
                    }
                    placeholder="us-east-1"
                  />
                  <p className="text-xs text-gray-500">
                    AWS region where your IoT Core is deployed
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Access Key ID</label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.accessKeyId || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        accessKeyId: e.target.value,
                      })
                    }
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Secret Access Key
                  </label>
                  <Input
                    type="password"
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        secretAccessKey: e.target.value,
                      })
                    }
                    placeholder="Enter AWS secret access key"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    IoT Endpoint (Optional)
                  </label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.endpoint || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        endpoint: e.target.value,
                      })
                    }
                    placeholder="xxxxxx-ats.iot.us-east-1.amazonaws.com"
                  />
                  <p className="text-xs text-gray-500">
                    Custom IoT endpoint if not using default
                  </p>
                </div>
              </>
            )}

            {selectedIntegration?.type === 'azure_iot' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Connection String
                  </label>
                  <Input
                    type="password"
                    defaultValue={String(
                      selectedIntegration.config.connectionString || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        connectionString: e.target.value,
                      })
                    }
                    placeholder="HostName=...;SharedAccessKeyName=...;SharedAccessKey=..."
                  />
                  <p className="text-xs text-gray-500">
                    IoT Hub connection string from Azure Portal
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Hub Name (Optional)
                  </label>
                  <Input
                    defaultValue={String(
                      selectedIntegration.config.hubName || ''
                    )}
                    onChange={(e) =>
                      setIntegrationConfig({
                        ...integrationConfig,
                        hubName: e.target.value,
                      })
                    }
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
              <Select
                value={newIntegrationType}
                onValueChange={setNewIntegrationType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select integration type..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Device Integrations */}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    📱 Device Integrations
                  </div>
                  {INTEGRATION_TYPES.filter((t) => t.category === 'device').map(
                    (type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    )
                  )}

                  {/* Notification Integrations */}
                  <div className="mt-1 border-t px-2 py-1.5 pt-2 text-xs font-semibold text-muted-foreground">
                    🔔 Notifications
                  </div>
                  {INTEGRATION_TYPES.filter(
                    (t) => t.category === 'notification'
                  ).map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}

                  {/* Custom Integrations */}
                  <div className="mt-1 border-t px-2 py-1.5 pt-2 text-xs font-semibold text-muted-foreground">
                    ⚙️ Custom
                  </div>
                  {INTEGRATION_TYPES.filter((t) => t.category === 'custom').map(
                    (type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Show integration description when type is selected */}
            {newIntegrationType && (
              <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                {(() => {
                  const selectedType = INTEGRATION_TYPES.find(
                    (t) => t.value === newIntegrationType
                  )
                  if (!selectedType) return null

                  return (
                    <>
                      <div className="flex items-start gap-2">
                        <span className="text-2xl">{selectedType.icon}</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                            {selectedType.label}
                          </h4>
                          <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
                            {selectedType.description}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 border-t border-blue-300 pt-3 dark:border-blue-700">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="font-medium text-blue-900 dark:text-blue-100">
                              Purpose:
                            </span>
                            <p className="text-blue-700 dark:text-blue-300">
                              {selectedType.purpose}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium text-blue-900 dark:text-blue-100">
                              Required Fields:
                            </span>
                            <p className="text-blue-700 dark:text-blue-300">
                              {selectedType.requiredFields.join(', ')}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="font-medium text-blue-900 dark:text-blue-100">
                            Use Cases:
                          </span>
                          <p className="text-blue-700 dark:text-blue-300">
                            {selectedType.useCases}
                          </p>
                        </div>
                      </div>
                    </>
                  )
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
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      mqttBrokerType === 'hosted'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => setMqttBrokerType('hosted')}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">🚀 Hosted</span>
                      <Badge
                        variant="default"
                        className="px-1.5 py-0 text-[10px]"
                      >
                        Recommended
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      NetNeural managed broker with auto-generated credentials
                    </p>
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      mqttBrokerType === 'external'
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-muted hover:border-primary/50'
                    }`}
                    onClick={() => setMqttBrokerType('external')}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">🔧 External</span>
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0 text-[10px]"
                      >
                        Advanced
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Connect to your own MQTT broker infrastructure
                    </p>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Integration Name (Optional)
              </label>
              <Input
                value={newIntegrationName}
                onChange={(e) => setNewIntegrationName(e.target.value)}
                placeholder={
                  newIntegrationType
                    ? `e.g., Production ${INTEGRATION_TYPES.find((t) => t.value === newIntegrationType)?.label || 'Integration'}`
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
                setShowAddModal(false)
                setNewIntegrationType('')
                setNewIntegrationName('')
                setMqttBrokerType('hosted')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Close the add modal and navigate directly to configuration page
                setShowAddModal(false)

                // For MQTT, pass the specific broker subtype
                const finalType =
                  newIntegrationType === 'mqtt'
                    ? `mqtt_${mqttBrokerType}`
                    : newIntegrationType

                // All integrations use view page for consistency
                router.push(
                  `/dashboard/integrations/view?id=new&organizationId=${selectedOrganization}&type=${finalType}`
                )
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
              setShowGoliothConfig(false)
              loadIntegrations()
            }}
          />

          <ConflictResolutionDialog
            open={showConflictDialog}
            onOpenChange={setShowConflictDialog}
            organizationId={selectedOrganization}
            onResolved={() => {
              setShowConflictDialog(false)
              loadIntegrations()
            }}
          />

          <AwsIotConfigDialog
            open={showAwsIotConfig}
            onOpenChange={setShowAwsIotConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowAwsIotConfig(false)
              loadIntegrations()
            }}
          />

          <AzureIotConfigDialog
            open={showAzureIotConfig}
            onOpenChange={setShowAzureIotConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowAzureIotConfig(false)
              loadIntegrations()
            }}
          />

          <EmailConfigDialog
            open={showEmailConfig}
            onOpenChange={setShowEmailConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowEmailConfig(false)
              loadIntegrations()
            }}
          />

          <SlackConfigDialog
            open={showSlackConfig}
            onOpenChange={setShowSlackConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowSlackConfig(false)
              loadIntegrations()
            }}
          />

          <WebhookConfigDialog
            open={showWebhookConfig}
            onOpenChange={setShowWebhookConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowWebhookConfig(false)
              loadIntegrations()
            }}
          />

          <MqttConfigDialog
            open={showMqttConfig}
            onOpenChange={setShowMqttConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={(integrationId) => {
              setShowMqttConfig(false)
              if (integrationId) {
                // Navigate to dedicated MQTT page
                router.push(
                  `/dashboard/integrations/mqtt/${integrationId}?organizationId=${selectedOrganization}`
                )
              } else {
                loadIntegrations()
              }
            }}
          />

          <NetNeuralHubConfigDialog
            open={showNetNeuralHubConfig}
            onOpenChange={setShowNetNeuralHubConfig}
            integrationId={selectedIntegration?.id}
            organizationId={selectedOrganization}
            onSaved={() => {
              setShowNetNeuralHubConfig(false)
              loadIntegrations()
            }}
          />

          {/* Delete Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Integration</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete{' '}
                  <strong>{integrationToDelete?.name}</strong>? This will remove
                  all device mappings and configuration. This action cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setIntegrationToDelete(null)
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
              setShowCopyDialog(false)
              setIntegrationToCopy(null)
              loadIntegrations()
            }}
            currentOrgId={selectedOrganization}
          />
        </>
      )}
    </div>
  )
}
