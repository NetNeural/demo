'use client';

import { useState, useEffect } from 'react';
import { User, Settings, Building2, Users, Smartphone, Bell, Plug, Server } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { ProfileTab } from './components/ProfileTab';
import GeneralTab from './components/GeneralTab';
import SystemTab from './components/SystemTab';
import OrganizationsTab from './components/OrganizationsTab';
import UsersTab from './components/UsersTab';
import DevicesTab from './components/DevicesTab';
import AlertsTab from './components/AlertsTab';
import IntegrationsTab from './components/IntegrationsTab';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
  deviceCount?: number;
  userCount?: number;
}

interface Integration {
  id: string;
  type: string;
  name: string;
  status: 'active' | 'pending' | 'inactive' | 'not-configured';
  config: Record<string, unknown>;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgIntegrations, setOrgIntegrations] = useState<Integration[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Profile settings
  const [profileName, setProfileName] = useState('NetNeural Admin');
  const [email, setEmail] = useState('admin@netneural.ai');
  const [notifications, setNotifications] = useState(true);

  // Alert settings state
  const [alertRules, setAlertRules] = useState([
    {
      id: '1',
      name: 'High Temperature Threshold',
      condition: 'temperature > 85',
      severity: 'critical',
      enabled: true,
      description: 'Trigger when temperature exceeds 85°C'
    },
    {
      id: '2',
      name: 'Low Battery Warning',
      condition: 'battery < 25',
      severity: 'medium',
      enabled: true,
      description: 'Alert when device battery drops below 25%'
    },
    {
      id: '3',
      name: 'Device Offline Detection',
      condition: 'last_seen > 120 minutes',
      severity: 'high',
      enabled: true,
      description: 'Trigger when device hasn\'t reported in 2+ hours'
    }
  ]);
  const [notificationSettings, setNotificationSettings] = useState({
    email: {
      enabled: true,
      recipients: ['admin@netneural.ai', 'alerts@netneural.ai'],
      severityFilter: ['critical', 'high']
    },
    sms: {
      enabled: false,
      numbers: ['+1234567890'],
      severityFilter: ['critical']
    },
    webhook: {
      enabled: true,
      url: 'https://api.example.com/alerts',
      severityFilter: ['critical', 'high', 'medium']
    },
    inApp: {
      enabled: true,
      severityFilter: ['critical', 'high', 'medium', 'low']
    }
  });

  // Load organizations on component mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  // Load integrations when organization changes
  useEffect(() => {
    if (selectedOrganization) {
      loadOrganizationIntegrations(selectedOrganization);
    }
  }, [selectedOrganization]);

  const loadOrganizations = async () => {
    try {
      // Call organizations edge function directly
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        const response = await fetch(`${supabaseUrl}/functions/v1/organizations`, {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);
          if (data.organizations?.length > 0) {
            setSelectedOrganization(data.organizations[0].id);
          }
          return;
        }
      }
      
      // Fallback to database seed data
      const mockOrgs: Organization[] = [
        {
          id: 'org-1',
          name: 'NetNeural Industries',
          slug: 'netneural-industries',
          role: 'admin',
          deviceCount: 245,
          userCount: 12
        },
        {
          id: 'org-2',
          name: 'Acme Manufacturing',
          slug: 'acme-manufacturing',
          role: 'member',
          deviceCount: 89,
          userCount: 8
        }
      ];
      setOrganizations(mockOrgs);
      if (mockOrgs.length > 0 && mockOrgs[0]) {
        setSelectedOrganization(mockOrgs[0].id);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const loadOrganizationIntegrations = async (orgId: string) => {
    try {
      setIsLoading(true);
      // Call integrations edge function directly
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        const response = await fetch(`${supabaseUrl}/functions/v1/integrations?organization_id=${orgId}`, {
          headers: {
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          setOrgIntegrations(data.integrations || []);
          return;
        }
      }
      
      // Fallback to demo data
      const mockIntegrations: Integration[] = [
        {
          id: 'golioth-1',
          type: 'golioth',
          name: 'Golioth Cloud',
          status: 'active',
          config: {
            apiKey: 'gl_api_1234567890abcdef',
            projectId: 'my-iot-project',
            baseUrl: 'api.golioth.io'
          }
        },
        {
          id: 'email-1',
          type: 'email',
          name: 'Email Notifications',
          status: 'active',
          config: {
            smtpHost: 'smtp.example.com',
            smtpPort: 587,
            username: 'notifications@netneural.ai'
          }
        },
        {
          id: 'slack-1',
          type: 'slack',
          name: 'Slack Alerts',
          status: 'not-configured',
          config: {}
        }
      ];
      setOrgIntegrations(mockIntegrations);
    } catch (error) {
      console.error('Error loading integrations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Users"
        description="Configure your profile, manage devices and users, set up integrations, and customize your IoT platform"
      />

      <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Organizations</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Users</span>
          </TabsTrigger>
          <TabsTrigger value="devices" className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">Devices</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Plug className="w-4 h-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <ProfileTab
            initialName={profileName}
            initialEmail={email}
            initialNotifications={notifications}
          />
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations">
          <OrganizationsTab initialOrganizations={organizations} />
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>

        {/* Devices Tab */}
        <TabsContent value="devices">
          <DevicesTab />
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts">
          <AlertsTab />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <IntegrationsTab organizations={organizations} />
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system">
          <SystemTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
