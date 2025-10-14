'use client';

import React, { useState } from 'react';
import { Server, Shield, Database, HardDrive, Activity, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { SettingsSection } from './shared/SettingsSection';
import { SettingsFormGroup } from './shared/SettingsFormGroup';

interface SystemInfo {
  version: string;
  dbStatus: 'healthy' | 'warning' | 'error';
  apiStatus: 'operational' | 'degraded' | 'down';
  lastBackup: string;
  storageUsed: string;
  storageTotal: string;
  activeDevices: number;
}

interface SystemTabProps {
  systemInfo?: SystemInfo;
}

export default function SystemTab({
  systemInfo = {
    version: 'v2.1.0',
    dbStatus: 'healthy',
    apiStatus: 'operational',
    lastBackup: '2 hours ago',
    storageUsed: '2.3 GB',
    storageTotal: '10 GB',
    activeDevices: 334,
  },
}: SystemTabProps) {
  const [maintenanceMode, setMaintenanceMode] = useState('off');
  const [logLevel, setLogLevel] = useState('info');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [maxUploadSize, setMaxUploadSize] = useState('10');
  const [forceSSL, setForceSSL] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [auditLog, setAuditLog] = useState(true);
  const [apiRateLimit, setApiRateLimit] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to save system settings
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Saving system settings:', {
        maintenanceMode,
        logLevel,
        sessionTimeout,
        maxUploadSize,
        forceSSL,
        twoFactor,
        auditLog,
        apiRateLimit,
      });
    } catch (error) {
      console.error('Error saving system settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaintenanceAction = async (action: string) => {
    console.log(`Performing maintenance action: ${action}`);
    // TODO: Implement maintenance actions
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'operational':
        return <Badge className="bg-green-500">Healthy</Badge>;
      case 'warning':
      case 'degraded':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'error':
      case 'down':
        return <Badge className="bg-red-500">Error</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* System Information */}
      <SettingsSection
        icon={<Activity className="w-5 h-5" />}
        title="System Information"
        description="Current system status and health metrics"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Platform Version</p>
            <p className="font-semibold">{systemInfo.version}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Database Status</p>
            <div>{getStatusBadge(systemInfo.dbStatus)}</div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">API Status</p>
            <div>{getStatusBadge(systemInfo.apiStatus)}</div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Last Backup</p>
            <p className="font-semibold">{systemInfo.lastBackup}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Storage Used</p>
            <p className="font-semibold">
              {systemInfo.storageUsed} / {systemInfo.storageTotal}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Active Devices</p>
            <p className="font-semibold">{systemInfo.activeDevices}</p>
          </div>
        </div>
      </SettingsSection>

      {/* System Configuration */}
      <SettingsSection
        icon={<Server className="w-5 h-5" />}
        title="System Configuration"
        description="Configure system behavior and operational settings"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <SettingsFormGroup label="Maintenance Mode" description="Control system maintenance state">
            <Select value={maintenanceMode} onValueChange={setMaintenanceMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="immediate">Immediate</SelectItem>
              </SelectContent>
            </Select>
          </SettingsFormGroup>

          <SettingsFormGroup label="Log Level" description="System logging verbosity">
            <Select value={logLevel} onValueChange={setLogLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
          </SettingsFormGroup>

          <SettingsFormGroup label="Session Timeout" description="Minutes before session expires">
            <Input
              type="number"
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(e.target.value)}
              min="5"
              max="480"
            />
          </SettingsFormGroup>

          <SettingsFormGroup label="Max Upload Size" description="Maximum file upload size in MB">
            <Input
              type="number"
              value={maxUploadSize}
              onChange={(e) => setMaxUploadSize(e.target.value)}
              min="1"
              max="100"
            />
          </SettingsFormGroup>
        </div>
      </SettingsSection>

      {/* Security Settings */}
      <SettingsSection
        icon={<Shield className="w-5 h-5" />}
        title="Security Settings"
        description="Configure system security and access controls"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="force-ssl" className="text-base">
                Force SSL/HTTPS Connections
              </Label>
              <p className="text-sm text-muted-foreground">Require secure connections for all traffic</p>
            </div>
            <Switch id="force-ssl" checked={forceSSL} onCheckedChange={setForceSSL} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="two-factor" className="text-base">
                Require Two-Factor Authentication
              </Label>
              <p className="text-sm text-muted-foreground">Enforce 2FA for all user accounts</p>
            </div>
            <Switch id="two-factor" checked={twoFactor} onCheckedChange={setTwoFactor} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="audit-log" className="text-base">
                Enable Audit Logging
              </Label>
              <p className="text-sm text-muted-foreground">Track all system changes and access</p>
            </div>
            <Switch id="audit-log" checked={auditLog} onCheckedChange={setAuditLog} />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="api-rate-limit" className="text-base">
                Enable API Rate Limiting
              </Label>
              <p className="text-sm text-muted-foreground">Protect against API abuse</p>
            </div>
            <Switch id="api-rate-limit" checked={apiRateLimit} onCheckedChange={setApiRateLimit} />
          </div>
        </div>
      </SettingsSection>

      {/* Maintenance Actions */}
      <SettingsSection
        icon={<HardDrive className="w-5 h-5" />}
        title="Maintenance Actions"
        description="Perform system maintenance and administrative tasks"
      >
        <div className="space-y-6">
          {/* Backup & Restore */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              <h4 className="font-semibold">Backup & Restore</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => handleMaintenanceAction('create-backup')}>
                Create Backup
              </Button>
              <Button variant="outline" onClick={() => handleMaintenanceAction('download-backup')}>
                Download Backup
              </Button>
              <Button variant="outline" onClick={() => handleMaintenanceAction('restore-backup')}>
                Restore from Backup
              </Button>
            </div>
          </div>

          {/* Database */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              <h4 className="font-semibold">Database</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => handleMaintenanceAction('optimize-db')}>
                Optimize Database
              </Button>
              <Button variant="outline" onClick={() => handleMaintenanceAction('export-data')}>
                Export Data
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleMaintenanceAction('reset-db')}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Reset Database
              </Button>
            </div>
          </div>

          {/* System */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              <h4 className="font-semibold">System</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => handleMaintenanceAction('clear-cache')}>
                Clear Cache
              </Button>
              <Button variant="outline" onClick={() => handleMaintenanceAction('restart-services')}>
                Restart Services
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => handleMaintenanceAction('factory-reset')}
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Factory Reset
              </Button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSave} disabled={isLoading} className="flex-1 sm:flex-initial">
          {isLoading ? 'Saving...' : 'Save System Settings'}
        </Button>
        <Button variant="outline" disabled={isLoading}>
          Export Configuration
        </Button>
      </div>
    </div>
  );
}
