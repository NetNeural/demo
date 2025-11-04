'use client';

import React, { useState } from 'react';
import { Smartphone, Upload, Download, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsSection } from './shared/SettingsSection';
import { SettingsFormGroup } from './shared/SettingsFormGroup';

interface DevicesTabProps {
  deviceCount?: number;
}

export default function DevicesTab({ deviceCount = 334 }: DevicesTabProps) {
  const [autoProvision, setAutoProvision] = useState(true);
  const [devicePrefix, setDevicePrefix] = useState('NN-');
  const [defaultGroup, setDefaultGroup] = useState('production');
  const [bulkImportData, setBulkImportData] = useState('');

  const handleBulkImport = async () => {
    console.log('Importing devices:', bulkImportData);
    // TODO: Implement bulk import
  };

  const handleExportDevices = async () => {
    console.log('Exporting devices...');
    // TODO: Implement export
  };

  const handleDownloadTemplate = () => {
    const template = `device_id,name,group,type
device-001,Sensor 1,production,temperature
device-002,Sensor 2,staging,humidity
device-003,Gateway 1,production,gateway`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'device-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSync = async () => {
    console.log('Syncing devices...');
    // TODO: Implement sync
  };

  return (
    <div className="space-y-6">
      {/* Device Configuration */}
      <SettingsSection
        icon={<Smartphone className="w-5 h-5" />}
        title="Device Configuration"
        description="Configure device provisioning and management settings"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <SettingsFormGroup
            label="Auto-Provisioning"
            description="Automatically provision new devices when they connect"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-provision"
                checked={autoProvision}
                onChange={(e) => setAutoProvision(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="auto-provision" className="text-sm">
                Enable auto-provisioning
              </label>
            </div>
          </SettingsFormGroup>

          <SettingsFormGroup
            label="Device Name Prefix"
            description="Prefix for auto-generated device names"
          >
            <Input
              value={devicePrefix}
              onChange={(e) => setDevicePrefix(e.target.value)}
              placeholder="NN-"
            />
          </SettingsFormGroup>

          <SettingsFormGroup
            label="Default Device Group"
            description="Group for newly provisioned devices"
          >
            <Select value={defaultGroup} onValueChange={setDefaultGroup}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="testing">Testing</SelectItem>
              </SelectContent>
            </Select>
          </SettingsFormGroup>

          <SettingsFormGroup
            label="Device Timeout"
            description="Minutes before marking device as offline"
          >
            <Input type="number" defaultValue="120" min="1" />
          </SettingsFormGroup>
        </div>
      </SettingsSection>

      {/* Bulk Operations */}
      <SettingsSection
        icon={<Upload className="w-5 h-5" />}
        title="Bulk Device Operations"
        description="Import or export multiple devices at once"
      >
        <div className="space-y-6">
          {/* Bulk Import */}
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Import Devices
            </h4>
            <p className="text-sm text-muted-foreground">
              Import devices from CSV. Format: device_id, name, group, type
            </p>
            <Textarea
              value={bulkImportData}
              onChange={(e) => setBulkImportData(e.target.value)}
              placeholder="device-001,Sensor 1,production,temperature&#10;device-002,Sensor 2,staging,humidity&#10;device-003,Gateway 1,production,gateway"
              rows={6}
              className="font-mono text-sm"
            />
            <div className="flex gap-2">
              <Button onClick={handleBulkImport} disabled={!bulkImportData}>
                <Upload className="w-4 h-4 mr-2" />
                Import Devices
              </Button>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>
          </div>

          {/* Export */}
          <div className="space-y-3 pt-6 border-t">
            <h4 className="font-semibold flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Devices
            </h4>
            <p className="text-sm text-muted-foreground">
              Export all devices to CSV file ({deviceCount} devices)
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportDevices}>
                <Download className="w-4 h-4 mr-2" />
                Export All Devices
              </Button>
              <Button variant="outline" onClick={handleSync}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync with Cloud
              </Button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Quick Actions */}
      <SettingsSection
        icon={<Plus className="w-5 h-5" />}
        title="Quick Actions"
        description="Common device management tasks"
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Button variant="outline" className="justify-start">
            <Plus className="w-4 h-4 mr-2" />
            Add Single Device
          </Button>
          <Button variant="outline" className="justify-start">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Device List
          </Button>
          <Button variant="outline" className="justify-start">
            <Smartphone className="w-4 h-4 mr-2" />
            View All Devices
          </Button>
          <Button variant="outline" className="justify-start">
            <Download className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </SettingsSection>

      {/* Save Actions */}
      <div className="flex gap-3">
        <Button>Save Configuration</Button>
        <Button variant="outline">Reset to Defaults</Button>
      </div>
    </div>
  );
}
