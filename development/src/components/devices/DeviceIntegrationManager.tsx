'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { Plus, ExternalLink, Settings, Trash2, CheckCircle, AlertTriangle } from "lucide-react";
import { edgeFunctions } from "@/lib/edge-functions";
import { MqttConfigDialog } from "@/components/integrations/MqttConfigDialog";
import { useOrganization } from "@/contexts/OrganizationContext";

interface DeviceIntegration {
  id: string;
  name: string;
  integration_type: string;
  status: string;
  settings: Record<string, unknown>;
  device_count?: number;
}

interface LocalDevice {
  id: string;
  name: string;
  device_type: string;
  status: string;
  isExternallyManaged: boolean;
  externalDeviceId?: string | null;
  integrationName?: string | null;
}

export function DeviceIntegrationManager() {
  const [integrations, setIntegrations] = useState<DeviceIntegration[]>([]);
  const [devices, setDevices] = useState<LocalDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [externalDeviceId, setExternalDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [integrationToConfig, setIntegrationToConfig] = useState<DeviceIntegration | null>(null);
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load devices
      const response = await fetch('/api/devices');
      const deviceData = await response.json();
      setDevices(deviceData.devices || []);

      // Mock integrations for now (would come from API)
      setIntegrations([
        {
          id: 'golioth-integration-1',
          name: 'Golioth IoT Platform',
          integration_type: 'golioth',
          status: 'active',
          settings: { api_key: '***', project_id: 'my-project' },
          device_count: deviceData.devices?.filter((d: LocalDevice) => d.isExternallyManaged).length || 0
        }
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load device data' });
    } finally {
      setLoading(false);
    }
  };

  const handleMapDevice = async () => {
    if (!selectedDevice || !selectedIntegration || !externalDeviceId) {
      setMessage({ type: 'error', text: 'Please select device, integration, and enter external device ID' });
      return;
    }

    try {
      setLoading(true);
      
      const response = await edgeFunctions.devices.mapToExternal(
        selectedDevice,
        selectedIntegration,
        externalDeviceId
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to map device');
      }

      setMessage({ type: 'success', text: 'Device successfully mapped to external system' });
      setSelectedDevice(null);
      setSelectedIntegration(null);
      setExternalDeviceId('');
      loadData(); // Refresh data
    } catch (error) {
      console.error('Error mapping device:', error);
      setMessage({ type: 'error', text: 'Failed to map device to external system' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnmapDevice = async (deviceId: string) => {
    try {
      setLoading(true);
      
      const response = await edgeFunctions.devices.unmapFromExternal(deviceId);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to unmap device');
      }
      
      setMessage({ type: 'success', text: 'Device unmapped from external system' });
      loadData(); // Refresh data
    } catch (error) {
      console.error('Error unmapping device:', error);
      setMessage({ type: 'error', text: 'Failed to unmap device' });
    } finally {
      setLoading(false);
    }
  };

  const localDevices = devices.filter(d => !d.isExternallyManaged);
  const mappedDevices = devices.filter(d => d.isExternallyManaged);

  return (
    <div className="space-y-6">
      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Integration Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Integration Overview
          </CardTitle>
          <CardDescription>
            Manage connections between local devices and external IoT platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{devices.length}</div>
              <div className="text-sm text-muted-foreground">Total Devices</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{mappedDevices.length}</div>
              <div className="text-sm text-muted-foreground">Externally Managed</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{localDevices.length}</div>
              <div className="text-sm text-muted-foreground">Local Only</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device Mapping Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Map Device to External System
          </CardTitle>
          <CardDescription>
            Connect a local device to an external IoT platform for unified management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device-select">Select Local Device</Label>
              <select
                id="device-select"
                className="w-full p-2 border rounded-md"
                value={selectedDevice || ''}
                onChange={(e) => setSelectedDevice(e.target.value || null)}
                aria-label="Select local device to map"
              >
                <option value="">Choose a device...</option>
                {localDevices.map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name} ({device.device_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="integration-select">Select Integration</Label>
              <select
                id="integration-select"
                className="w-full p-2 border rounded-md"
                value={selectedIntegration || ''}
                onChange={(e) => setSelectedIntegration(e.target.value || null)}
                aria-label="Select integration platform"
              >
                <option value="">Choose integration...</option>
                {integrations.map(integration => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="external-id">External Device ID</Label>
              <Input
                id="external-id"
                placeholder="e.g., golioth-device-123"
                value={externalDeviceId}
                onChange={(e) => setExternalDeviceId(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleMapDevice} 
            disabled={loading || !selectedDevice || !selectedIntegration || !externalDeviceId}
            className="w-full md:w-auto"
          >
            {loading ? 'Mapping...' : 'Map Device'}
          </Button>
        </CardContent>
      </Card>

      {/* Device Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Local Devices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Local Devices ({localDevices.length})</span>
              <Badge variant="outline">Local Management</Badge>
            </CardTitle>
            <CardDescription>
              Devices managed locally without external platform integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {localDevices.map(device => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{device.name}</div>
                    <div className="text-sm text-muted-foreground">{device.device_type}</div>
                  </div>
                  <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                    {device.status}
                  </Badge>
                </div>
              ))}
              {localDevices.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No local-only devices found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mapped Devices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Externally Managed ({mappedDevices.length})</span>
              <Badge variant="default">External Integration</Badge>
            </CardTitle>
            <CardDescription>
              Devices connected to external IoT platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mappedDevices.map(device => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{device.name}</div>
                    <div className="text-sm text-muted-foreground">{device.device_type}</div>
                    <div className="text-xs text-blue-600 mt-1">
                      {device.integrationName} • {device.externalDeviceId}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                      {device.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnmapDevice(device.id)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {mappedDevices.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No externally managed devices found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Active Integrations
          </CardTitle>
          <CardDescription>
            Manage your external IoT platform connections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {integrations.map(integration => (
              <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <ExternalLink className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">{integration.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {integration.device_count} devices connected
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={integration.status === 'active' ? 'default' : 'destructive'}>
                    {integration.status === 'active' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setIntegrationToConfig(integration);
                      setConfigDialogOpen(true);
                    }}
                  >
                    Configure
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* MQTT Config Dialog (works for MQTT integrations, can be extended for others) */}
      {integrationToConfig?.integration_type === 'mqtt' && currentOrganization && (
        <MqttConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          organizationId={currentOrganization.id}
          integrationId={integrationToConfig.id}
          onSaved={() => {
            loadData(); // Refresh integrations list
          }}
        />
      )}
    </div>
  );
}