'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { Plus, Trash2, CheckCircle, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { organizationIntegrationService, OrganizationIntegration } from "@/lib/integrations/organization-integrations";
import { organizationGoliothSyncService, SyncResult } from "@/lib/sync/organization-golioth-sync";
import { createClient } from "@/lib/supabase/client";

interface LocalDevice {
  id: string;
  name: string;
  device_type: string;
  status: string;
  isExternallyManaged: boolean;
  externalDeviceId?: string | null;
  integrationName?: string | null;
  integration_id?: string | null;
}

interface OrganizationIntegrationManagerProps {
  organizationId: string;
}

export function OrganizationIntegrationManager({ organizationId }: OrganizationIntegrationManagerProps) {
  const [integrations, setIntegrations] = useState<OrganizationIntegration[]>([]);
  const [devices, setDevices] = useState<LocalDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [externalDeviceId, setExternalDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncResults, setSyncResults] = useState<{ [integrationId: string]: SyncResult }>({});
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ open: boolean; integrationId: string | null }>({ 
    open: false, 
    integrationId: null 
  });
  
  // New integration form
  const [showNewIntegrationForm, setShowNewIntegrationForm] = useState(false);
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    integration_type: 'golioth',
    api_key: '',
    project_id: '',
    base_url: 'https://api.golioth.io'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load integrations for the organization
      const orgIntegrations = await organizationIntegrationService.getIntegrations(organizationId);
      setIntegrations(orgIntegrations);
      
      // Load devices
      const response = await fetch('/api/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const createIntegration = async () => {
    try {
      setLoading(true);
      
      const integration = await organizationIntegrationService.createIntegration({
        organization_id: organizationId,
        integration_type: newIntegration.integration_type,
        name: newIntegration.name,
        api_key_encrypted: btoa(newIntegration.api_key), // Basic encoding - use proper encryption in production
        project_id: newIntegration.project_id,
        base_url: newIntegration.base_url,
        settings: {},
        status: 'active'
      });

      setIntegrations([...integrations, integration]);
      setNewIntegration({
        name: '',
        integration_type: 'golioth',
        api_key: '',
        project_id: '',
        base_url: 'https://api.golioth.io'
      });
      setShowNewIntegrationForm(false);
      setMessage({ type: 'success', text: 'Integration created successfully' });
    } catch (error) {
      console.error('Error creating integration:', error);
      setMessage({ type: 'error', text: 'Failed to create integration' });
    } finally {
      setLoading(false);
    }
  };

  const testIntegration = async (integrationId: string) => {
    try {
      setLoading(true);
      
      // Call device-sync with operation='test' to create proper activity log entries
      // This matches the behavior of the test button in the integration modal
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('device-sync', {
        body: {
          integrationId,
          organizationId,
          operation: 'test',
          deviceIds: []
        }
      });

      if (error) {
        throw new Error(error.message || 'Test failed');
      }

      setMessage({ 
        type: data?.success ? 'success' : 'error', 
        text: data?.message || 'Test completed'
      });
    } catch (error) {
      console.error('Error testing integration:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to test integration' 
      });
    } finally {
      setLoading(false);
    }
  };

  const syncIntegration = async (integrationId: string) => {
    try {
      setSyncLoading(true);
      const result = await organizationGoliothSyncService.syncDevices(
        organizationId,
        integrationId,
        {
          syncStatus: true,
          syncBattery: true,
          syncLastSeen: true,
          createMissingDevices: true
        }
      );

      setSyncResults({ ...syncResults, [integrationId]: result });
      
      if (result.errors.length === 0) {
        setMessage({ 
          type: 'success', 
          text: `Sync completed: ${result.syncedDevices} devices synced` 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: `Sync completed with ${result.errors.length} errors` 
        });
      }

      // Reload devices to show updated data
      await loadData();
    } catch (error) {
      console.error('Error syncing integration:', error);
      setMessage({ type: 'error', text: 'Failed to sync integration' });
    } finally {
      setSyncLoading(false);
    }
  };

  const deleteIntegration = async (integrationId: string) => {
    try {
      setLoading(true);
      await organizationIntegrationService.deleteIntegration(integrationId);
      setIntegrations(integrations.filter(i => i.id !== integrationId));
      setMessage({ type: 'success', text: 'Integration deleted successfully' });
      setDeleteConfirmation({ open: false, integrationId: null });
    } catch (error) {
      console.error('Error deleting integration:', error);
      setMessage({ type: 'error', text: 'Failed to delete integration' });
      setDeleteConfirmation({ open: false, integrationId: null });
    } finally {
      setLoading(false);
    }
  };

  const mapDeviceToIntegration = async () => {
    if (!selectedDevice || !selectedIntegration || !externalDeviceId) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    try {
      setLoading(true);
      
      // Update device with integration mapping
      const response = await fetch(`/api/devices/${selectedDevice}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integration_id: selectedIntegration,
          external_device_id: externalDeviceId,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Device mapped successfully' });
        setSelectedDevice(null);
        setSelectedIntegration(null);
        setExternalDeviceId('');
        await loadData();
      } else {
        throw new Error('Failed to map device');
      }
    } catch (error) {
      console.error('Error mapping device:', error);
      setMessage({ type: 'error', text: 'Failed to map device' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="device-mapping">Device Mapping</TabsTrigger>
          <TabsTrigger value="sync-status">Sync Status</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">External Integrations</h3>
            <Button onClick={() => setShowNewIntegrationForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Integration
            </Button>
          </div>

          {showNewIntegrationForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Integration</CardTitle>
                <CardDescription>
                  Add a new external system integration for your organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="integration-name">Integration Name</Label>
                    <Input
                      id="integration-name"
                      value={newIntegration.name}
                      onChange={(e) => setNewIntegration({...newIntegration, name: e.target.value})}
                      placeholder="e.g., Production Golioth"
                    />
                  </div>
                  <div>
                    <Label htmlFor="integration-type">Integration Type</Label>
                    <Input
                      id="integration-type"
                      value={newIntegration.integration_type}
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="api-key">API Key</Label>
                    <Input
                      id="api-key"
                      type="password"
                      value={newIntegration.api_key}
                      onChange={(e) => setNewIntegration({...newIntegration, api_key: e.target.value})}
                      placeholder="Enter Golioth API key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="project-id">Project ID</Label>
                    <Input
                      id="project-id"
                      value={newIntegration.project_id}
                      onChange={(e) => setNewIntegration({...newIntegration, project_id: e.target.value})}
                      placeholder="Enter Golioth project ID"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="base-url">Base URL</Label>
                  <Input
                    id="base-url"
                    value={newIntegration.base_url}
                    onChange={(e) => setNewIntegration({...newIntegration, base_url: e.target.value})}
                    placeholder="https://api.golioth.io"
                  />
                </div>

                <div className="flex space-x-2">
                  <Button onClick={createIntegration} disabled={loading}>
                    Create Integration
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewIntegrationForm(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4">
            {integrations.map((integration) => (
              <Card key={integration.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold">{integration.name}</h4>
                        <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                          {integration.status}
                        </Badge>
                        <Badge variant="outline">{integration.integration_type}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        Project: {integration.project_id || 'Not configured'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Base URL: {integration.base_url || 'Default'}
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => testIntegration(integration.id)}
                        disabled={loading}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Test
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => syncIntegration(integration.id)}
                        disabled={syncLoading}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Sync
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setDeleteConfirmation({ open: true, integrationId: integration.id })}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="device-mapping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Map Local Device to External System</CardTitle>
              <CardDescription>
                Connect your local devices with external IoT platform devices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="device-select">Local Device</Label>
                  <select
                    id="device-select"
                    value={selectedDevice || ''}
                    onChange={(e) => setSelectedDevice(e.target.value || null)}
                    className="w-full p-2 border rounded-md"
                    aria-label="Select local device"
                  >
                    <option value="">Select a device...</option>
                    {devices.filter(d => !d.isExternallyManaged).map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name} ({device.device_type})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="integration-select">Integration</Label>
                  <select
                    id="integration-select"
                    value={selectedIntegration || ''}
                    onChange={(e) => setSelectedIntegration(e.target.value || null)}
                    className="w-full p-2 border rounded-md"
                    aria-label="Select integration"
                  >
                    <option value="">Select an integration...</option>
                    {integrations.filter(i => i.status === 'active').map((integration) => (
                      <option key={integration.id} value={integration.id}>
                        {integration.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="external-device-id">External Device ID</Label>
                  <Input
                    id="external-device-id"
                    value={externalDeviceId}
                    onChange={(e) => setExternalDeviceId(e.target.value)}
                    placeholder="Device ID from external system"
                  />
                </div>
              </div>
              
              <Button onClick={mapDeviceToIntegration} disabled={loading}>
                Map Device
              </Button>
            </CardContent>
          </Card>

          {/* Show currently mapped devices */}
          <Card>
            <CardHeader>
              <CardTitle>Mapped Devices</CardTitle>
              <CardDescription>
                Devices currently connected to external systems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {devices.filter(d => d.isExternallyManaged).map((device) => (
                  <div key={device.id} className="flex justify-between items-center p-3 border rounded">
                    <div>
                      <div className="font-medium">{device.name}</div>
                      <div className="text-sm text-gray-600">
                        {device.integrationName} → {device.externalDeviceId}
                      </div>
                    </div>
                    <Badge variant={device.status === 'online' ? 'default' : 'secondary'}>
                      {device.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync-status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Synchronization Status</CardTitle>
              <CardDescription>
                View the results of recent device synchronizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(syncResults).length === 0 ? (
                <p className="text-gray-500">No sync results available. Run a sync to see results.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(syncResults).map(([integrationId, result]) => {
                    const integration = integrations.find(i => i.id === integrationId);
                    return (
                      <div key={integrationId} className="border rounded p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-semibold">{integration?.name || 'Unknown Integration'}</h4>
                          <Badge variant={result.errors.length === 0 ? 'default' : 'destructive'}>
                            {result.errors.length === 0 ? 'Success' : 'Errors'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Synced Devices:</span> {result.syncedDevices}
                          </div>
                          <div>
                            <span className="font-medium">Unmapped Devices:</span> {result.unmappedGoliothDevices}
                          </div>
                          <div>
                            <span className="font-medium">Errors:</span> {result.errors.length}
                          </div>
                        </div>
                        {result.errors.length > 0 && (
                          <div className="mt-2">
                            <h5 className="font-medium text-red-600">Errors:</h5>
                            <ul className="text-sm text-red-600 list-disc list-inside">
                              {result.errors.map((error, index) => (
                                <li key={index}>{error.deviceId}: {error.error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmation.open} onOpenChange={(open) => setDeleteConfirmation({ open, integrationId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Integration?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this integration? This will remove all device mappings. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmation({ open: false, integrationId: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmation.integrationId && deleteIntegration(deleteConfirmation.integrationId)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}