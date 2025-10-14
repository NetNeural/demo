'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { DeviceIntegrationManager } from "@/components/devices/DeviceIntegrationManager";
import { Settings, Wifi, Bell, Shield, Key, TestTube, Building2 } from "lucide-react";
import { organizationIntegrationService } from "@/lib/integrations/organization-integrations";
import { useCurrentOrganization, useCanManageSettings } from "@/lib/auth/user-context";
import { OrganizationSelector } from "@/components/organization/OrganizationSelector";

interface GoliothConfig {
  apiKey: string;
  projectId: string;
  baseUrl: string;
  enabled: boolean;
}

interface GoliothProject {
  id: string;
  name: string;
  device_count?: number;
  created_at: string;
}

interface SystemSettings {
  organizationName: string;
  timezone: string;
  alertRetention: number;
  dataRetention: number;
  autoRefreshInterval: number;
}

interface NotificationSettings {
  emailAlerts: boolean;
  smsAlerts: boolean;
  webhookUrl: string;
  alertThresholds: {
    critical: number;
    warning: number;
  };
}

export default function SettingsPage() {
  const currentOrganization = useCurrentOrganization();
  const canManageSettings = useCanManageSettings();

  const [goliothConfig, setGoliothConfig] = useState<GoliothConfig>({
    apiKey: '',
    projectId: '',
    baseUrl: 'https://api.golioth.io',
    enabled: false
  });

  const [availableProjects, setAvailableProjects] = useState<GoliothProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    organizationName: 'NetNeural IoT Platform',
    timezone: 'UTC',
    alertRetention: 30,
    dataRetention: 365,
    autoRefreshInterval: 30
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailAlerts: true,
    smsAlerts: false,
    webhookUrl: '',
    alertThresholds: {
      critical: 5,
      warning: 10
    }
  });

  const [testResult, setTestResult] = useState<{
    status: 'success' | 'error' | 'testing' | null;
    message: string;
  }>({ status: null, message: '' });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load current settings from localStorage or API
    const loadSettings = async () => {
      if (!currentOrganization) return;
      
      const organizationId = currentOrganization.organization_id;
      
      try {
        // First try to load from organization integrations
        const integrations = await organizationIntegrationService.getIntegrations(organizationId);
        const goliothIntegration = integrations.find(i => i.integration_type === 'golioth');
        
        if (goliothIntegration) {
          const settings = goliothIntegration.settings as { enabled?: boolean } | null;
          setGoliothConfig({
            apiKey: '••••••••••••', // Don't show the actual key for security
            projectId: goliothIntegration.project_id || '',
            baseUrl: goliothIntegration.base_url || 'https://api.golioth.io',
            enabled: settings?.enabled || false
          });
        } else {
          // Fallback to localStorage
          const savedGoliothConfig = localStorage.getItem('goliothConfig');
          if (savedGoliothConfig) {
            setGoliothConfig(JSON.parse(savedGoliothConfig));
          }
        }
      } catch (error) {
        console.error('Error loading integrations, falling back to localStorage:', error);
        
        // Fallback to localStorage if organization integration fails
        const savedGoliothConfig = localStorage.getItem('goliothConfig');
        if (savedGoliothConfig) {
          setGoliothConfig(JSON.parse(savedGoliothConfig));
        }
      }
      
      // Load other settings from localStorage
      const savedSystemSettings = localStorage.getItem('systemSettings');
      if (savedSystemSettings) {
        setSystemSettings(JSON.parse(savedSystemSettings));
      }

      const savedNotificationSettings = localStorage.getItem('notificationSettings');
      if (savedNotificationSettings) {
        setNotificationSettings(JSON.parse(savedNotificationSettings));
      }
    };
    
    loadSettings();
  }, [currentOrganization]);

  const testGoliothConnection = async () => {
    if (!goliothConfig.apiKey) {
      setTestResult({
        status: 'error',
        message: 'Please enter API Key first'
      });
      return;
    }

    setTestResult({ status: 'testing', message: 'Testing connection...' });

    try {
      // Test connection by fetching projects
      const response = await fetch(`${goliothConfig.baseUrl}/v1/projects`, {
        headers: {
          'Authorization': `Bearer ${goliothConfig.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        const projects = result.data || [];
        
        setAvailableProjects(projects);
        
        setTestResult({
          status: 'success',
          message: `Successfully connected! Found ${projects.length} project(s). Please select a project below.`
        });
      } else {
        setTestResult({
          status: 'error',
          message: `Connection failed: ${response.status} ${response.statusText}`
        });
      }
    } catch (error) {
      setTestResult({
        status: 'error',
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const fetchProjectsFromApiKey = async (apiKey: string) => {
    if (!apiKey || apiKey.length < 10) {
      setAvailableProjects([]);
      return;
    }

    setLoadingProjects(true);
    try {
      const response = await fetch(`${goliothConfig.baseUrl}/v1/projects`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        const projects = result.data || [];
        setAvailableProjects(projects);
        
        if (projects.length === 1) {
          // Auto-select if only one project
          setGoliothConfig(prev => ({ ...prev, projectId: projects[0].id }));
        }
      } else {
        setAvailableProjects([]);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setAvailableProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const saveGoliothConfig = async () => {
    setLoading(true);
    try {
      // Save to localStorage for backward compatibility
      localStorage.setItem('goliothConfig', JSON.stringify(goliothConfig));
      
      // Also save as organization integration for proper multi-organization support
      if (goliothConfig.apiKey && goliothConfig.projectId && currentOrganization) {
        const organizationId = currentOrganization.organization_id;
        
        await organizationIntegrationService.createIntegration({
          organization_id: organizationId,
          name: 'Golioth Integration',
          integration_type: 'golioth',
          api_key_encrypted: goliothConfig.apiKey, // Will be encrypted by the service
          project_id: goliothConfig.projectId,
          base_url: goliothConfig.baseUrl,
          settings: {
            enabled: goliothConfig.enabled
          },
          status: 'active'
        });
        
        setTestResult({
          status: 'success',
          message: 'Golioth integration saved successfully as organization integration'
        });
      } else {
        setTestResult({
          status: 'success',  
          message: 'Golioth configuration saved to local settings'
        });
      }
    } catch (error) {
      console.error('Error saving Golioth config:', error);
      setTestResult({
        status: 'error',
        message: 'Failed to save configuration: ' + (error instanceof Error ? error.message : 'Unknown error')
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSystemSettings = () => {
    setLoading(true);
    try {
      localStorage.setItem('systemSettings', JSON.stringify(systemSettings));
      setTestResult({
        status: 'success',
        message: 'System settings saved successfully'
      });
    } catch {
      setTestResult({
        status: 'error',
        message: 'Failed to save system settings'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationSettings = () => {
    setLoading(true);
    try {
      localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
      setTestResult({
        status: 'success',
        message: 'Notification settings saved successfully'
      });
    } catch {
      setTestResult({
        status: 'error',
        message: 'Failed to save notification settings'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Configure your IoT platform settings and integrations</p>
        </div>
      </div>

      {testResult.status && (
        <Alert className={testResult.status === 'error' ? 'border-red-500' : testResult.status === 'success' ? 'border-green-500' : 'border-blue-500'}>
          <AlertDescription>
            {testResult.message}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="organization" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="golioth">Golioth Integration</TabsTrigger>
          <TabsTrigger value="devices">Device Management</TabsTrigger>
          <TabsTrigger value="system">System Settings</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organization Settings
              </CardTitle>
              <CardDescription>
                Manage your organization profile, members, and organizational hierarchy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Current Organization</h3>
                <OrganizationSelector />
                
                {currentOrganization && (
                  <div className="space-y-4">
                    <div>
                      <Label>Organization Name</Label>
                      <p className="text-sm text-muted-foreground mt-1">{currentOrganization.organization.name}</p>
                    </div>
                    
                    <div>
                      <Label>Your Role</Label>
                      <p className="text-sm text-muted-foreground mt-1 capitalize">{currentOrganization.role}</p>
                    </div>
                    
                    {canManageSettings && (
                      <div className="space-y-2">
                        <Label htmlFor="orgName">Update Organization Name</Label>
                        <Input
                          id="orgName"
                          placeholder="Organization name"
                          defaultValue={currentOrganization.organization.name}
                        />
                        <Button variant="outline" size="sm">
                          Update Name
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {canManageSettings && (
            <Card>
              <CardHeader>
                <CardTitle>Organization Hierarchy</CardTitle>
                <CardDescription>
                  Manage subsidiaries, locations, and departments within your organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Organization hierarchy management will be available in a future update.
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="golioth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Golioth IoT Platform Configuration
              </CardTitle>
              <CardDescription>
                Configure your Golioth IoT platform integration for device management and data streaming.
                This will create an organization-level integration that can be shared across all devices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder="gol_xxxxxxxxxxxx"
                    value={goliothConfig.apiKey}
                    onChange={(e) => setGoliothConfig({ ...goliothConfig, apiKey: e.target.value })}
                    onBlur={(e) => {
                      if (e.target.value && e.target.value.startsWith('gol_')) {
                        fetchProjectsFromApiKey(e.target.value);
                      }
                    }}
                  />
                  {loadingProjects && (
                    <p className="text-sm text-blue-600">Loading available projects...</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Get your API key from Golioth Console → Access Management
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="projectId">Project ID</Label>
                  <Input
                    id="projectId"
                    placeholder="your-project-id"
                    value={goliothConfig.projectId}
                    onChange={(e) => setGoliothConfig({ ...goliothConfig, projectId: e.target.value })}
                  />
                  {availableProjects.length > 0 && (
                    <div className="mt-2">
                      <Label htmlFor="projectSelect">Or select from available projects:</Label>
                      <Select 
                        onValueChange={(value) => {
                          const selectedProject = availableProjects.find(p => p.id === value);
                          if (selectedProject) {
                            setGoliothConfig({ 
                              ...goliothConfig, 
                              projectId: selectedProject.id 
                            });
                          }
                        }}
                        value={goliothConfig.projectId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a project" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name} ({project.id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Your Golioth project identifier. {availableProjects.length === 0 ? 'Run ' : 'Enter API key above to see available projects, or run '}<code>node fetch-project-id.js &lt;api-key&gt;</code> to find it.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  value={goliothConfig.baseUrl}
                  onChange={(e) => setGoliothConfig({ ...goliothConfig, baseUrl: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={goliothConfig.enabled}
                  onCheckedChange={(checked: boolean) => setGoliothConfig({ ...goliothConfig, enabled: checked })}
                />
                <Label htmlFor="enabled">Enable Golioth Integration</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={testGoliothConnection} disabled={testResult.status === 'testing'}>
                  <TestTube className="h-4 w-4 mr-2" />
                  {testResult.status === 'testing' ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button onClick={saveGoliothConfig} disabled={loading}>
                  Save as Organization Integration
                </Button>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Integration Status</h4>
                <div className="flex items-center gap-2">
                  <Badge variant={goliothConfig.enabled && goliothConfig.apiKey ? 'default' : 'secondary'}>
                    {goliothConfig.enabled && goliothConfig.apiKey ? 'Configured' : 'Not Configured'}
                  </Badge>
                  {testResult.status === 'success' && (
                    <Badge variant="default" className="bg-green-500">
                      Connected
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Once saved, this integration will be available for device mapping and synchronization.
                  Visit the Device Management tab to map devices or use the full Organization Integration Manager for advanced features.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <DeviceIntegrationManager />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                System Configuration
              </CardTitle>
              <CardDescription>
                Configure system-wide settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name</Label>
                  <Input
                    id="orgName"
                    value={systemSettings.organizationName}
                    onChange={(e) => setSystemSettings({ ...systemSettings, organizationName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={systemSettings.timezone}
                    onChange={(e) => setSystemSettings({ ...systemSettings, timezone: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="alertRetention">Alert Retention (days)</Label>
                  <Input
                    id="alertRetention"
                    type="number"
                    value={systemSettings.alertRetention}
                    onChange={(e) => setSystemSettings({ ...systemSettings, alertRetention: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataRetention">Data Retention (days)</Label>
                  <Input
                    id="dataRetention"
                    type="number"
                    value={systemSettings.dataRetention}
                    onChange={(e) => setSystemSettings({ ...systemSettings, dataRetention: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="refreshInterval">Auto Refresh (seconds)</Label>
                  <Input
                    id="refreshInterval"
                    type="number"
                    value={systemSettings.autoRefreshInterval}
                    onChange={(e) => setSystemSettings({ ...systemSettings, autoRefreshInterval: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <Button onClick={saveSystemSettings} disabled={loading}>
                Save System Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure alert notifications and thresholds
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="emailAlerts"
                    checked={notificationSettings.emailAlerts}
                    onCheckedChange={(checked: boolean) => setNotificationSettings({ ...notificationSettings, emailAlerts: checked })}
                  />
                  <Label htmlFor="emailAlerts">Email Alerts</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="smsAlerts"
                    checked={notificationSettings.smsAlerts}
                    onCheckedChange={(checked: boolean) => setNotificationSettings({ ...notificationSettings, smsAlerts: checked })}
                  />
                  <Label htmlFor="smsAlerts">SMS Alerts</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  placeholder="https://your-webhook-url.com/alerts"
                  value={notificationSettings.webhookUrl}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, webhookUrl: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="criticalThreshold">Critical Alert Threshold</Label>
                  <Input
                    id="criticalThreshold"
                    type="number"
                    value={notificationSettings.alertThresholds.critical}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      alertThresholds: {
                        ...notificationSettings.alertThresholds,
                        critical: parseInt(e.target.value)
                      }
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="warningThreshold">Warning Alert Threshold</Label>
                  <Input
                    id="warningThreshold"
                    type="number"
                    value={notificationSettings.alertThresholds.warning}
                    onChange={(e) => setNotificationSettings({
                      ...notificationSettings,
                      alertThresholds: {
                        ...notificationSettings.alertThresholds,
                        warning: parseInt(e.target.value)
                      }
                    })}
                  />
                </div>
              </div>

              <Button onClick={saveNotificationSettings} disabled={loading}>
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Manage access controls and security policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">API Access</h4>
                  <div className="space-y-2">
                    <Label>API Key Management</Label>
                    <div className="flex gap-2">
                      <Input readOnly value="sk_live_xxxxxxxxxxxxxxxxxxxx" />
                      <Button variant="outline">
                        <Key className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button variant="outline">Generate New API Key</Button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Access Control</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Two-Factor Authentication</Label>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>IP Whitelist</Label>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Session Timeout</Label>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Security Audit</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Last security audit: 2 days ago - No issues found
                </p>
                <Button variant="outline">Run Security Audit</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}