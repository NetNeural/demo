'use client';

import React, { useState } from 'react';
import { Bell, Plus, Mail, MessageSquare, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SettingsSection } from './shared/SettingsSection';

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  description: string;
}

interface NotificationSettings {
  email: {
    enabled: boolean;
    address: string;
  };
  sms: {
    enabled: boolean;
    phone: string;
  };
  slack: {
    enabled: boolean;
    webhook: string;
  };
}

interface AlertsTabProps {
  initialRules?: AlertRule[];
  initialNotifications?: NotificationSettings;
}

export default function AlertsTab({
  initialRules = [
    {
      id: '1',
      name: 'High Temperature Threshold',
      condition: 'temperature > 85',
      severity: 'critical',
      enabled: true,
      description: 'Trigger when temperature exceeds 85°C',
    },
    {
      id: '2',
      name: 'Low Battery Warning',
      condition: 'battery < 20',
      severity: 'warning',
      enabled: true,
      description: 'Alert when battery level drops below 20%',
    },
    {
      id: '3',
      name: 'Device Offline',
      condition: 'last_seen > 30m',
      severity: 'critical',
      enabled: false,
      description: 'Alert when device has been offline for 30 minutes',
    },
  ],
  initialNotifications = {
    email: { enabled: true, address: 'admin@netneural.ai' },
    sms: { enabled: false, phone: '' },
    slack: { enabled: false, webhook: '' },
  },
}: AlertsTabProps) {
  const [alertRules, setAlertRules] = useState<AlertRule[]>(initialRules);
  const [notificationSettings, setNotificationSettings] = useState(initialNotifications);

  const handleToggleRule = (id: string, enabled: boolean) => {
    setAlertRules((rules) =>
      rules.map((rule) => (rule.id === id ? { ...rule, enabled } : rule))
    );
  };

  const getSeverityBadge = (severity: AlertRule['severity']) => {
    switch (severity) {
      case 'critical':
        return <Badge className="bg-red-500">CRITICAL</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">WARNING</Badge>;
      case 'info':
        return <Badge className="bg-blue-500">INFO</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Rules */}
      <SettingsSection
        icon={<Bell className="w-5 h-5" />}
        title="Alert Rules"
        description="Configure alert rules and conditions"
        actions={
          <Button size="sm" variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Add Rule
          </Button>
        }
      >
        <div className="space-y-4">
          {alertRules.map((rule) => (
            <div
              key={rule.id}
              className="border rounded-lg p-4 space-y-3 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold">{rule.name}</h4>
                    {getSeverityBadge(rule.severity)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                  <div className="inline-block bg-muted px-3 py-1 rounded text-sm font-mono">
                    {rule.condition}
                  </div>
                </div>
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(enabled) => handleToggleRule(rule.id, enabled)}
                />
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline">
                  <Edit className="w-3 h-3 mr-2" />
                  Edit
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Notification Channels */}
      <SettingsSection
        icon={<MessageSquare className="w-5 h-5" />}
        title="Notification Channels"
        description="Configure how you want to receive alerts"
      >
        <div className="space-y-6">
          {/* Email Notifications */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <h4 className="font-semibold">Email Notifications</h4>
                  <p className="text-sm text-muted-foreground">Send alerts via email</p>
                </div>
              </div>
              <Switch
                checked={notificationSettings.email.enabled}
                onCheckedChange={(enabled) =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    email: { ...prev.email, enabled },
                  }))
                }
              />
            </div>
            {notificationSettings.email.enabled && (
              <div className="space-y-2 pl-8">
                <Label htmlFor="email-address">Email Address</Label>
                <input
                  id="email-address"
                  type="email"
                  className="w-full px-3 py-2 border rounded-md"
                  value={notificationSettings.email.address}
                  onChange={(e) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      email: { ...prev.email, address: e.target.value },
                    }))
                  }
                  placeholder="admin@netneural.ai"
                />
              </div>
            )}
          </div>

          {/* SMS Notifications */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-muted-foreground" />
                <div>
                  <h4 className="font-semibold">SMS Notifications</h4>
                  <p className="text-sm text-muted-foreground">Send alerts via SMS</p>
                </div>
              </div>
              <Switch
                checked={notificationSettings.sms.enabled}
                onCheckedChange={(enabled) =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    sms: { ...prev.sms, enabled },
                  }))
                }
              />
            </div>
            {notificationSettings.sms.enabled && (
              <div className="space-y-2 pl-8">
                <Label htmlFor="phone-number">Phone Number</Label>
                <input
                  id="phone-number"
                  type="tel"
                  className="w-full px-3 py-2 border rounded-md"
                  value={notificationSettings.sms.phone}
                  onChange={(e) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      sms: { ...prev.sms, phone: e.target.value },
                    }))
                  }
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            )}
          </div>

          {/* Slack Notifications */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <div>
                  <h4 className="font-semibold">Slack Notifications</h4>
                  <p className="text-sm text-muted-foreground">Send alerts to Slack channel</p>
                </div>
              </div>
              <Switch
                checked={notificationSettings.slack.enabled}
                onCheckedChange={(enabled) =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    slack: { ...prev.slack, enabled },
                  }))
                }
              />
            </div>
            {notificationSettings.slack.enabled && (
              <div className="space-y-2 pl-8">
                <Label htmlFor="slack-webhook">Webhook URL</Label>
                <input
                  id="slack-webhook"
                  type="url"
                  className="w-full px-3 py-2 border rounded-md"
                  value={notificationSettings.slack.webhook}
                  onChange={(e) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      slack: { ...prev.slack, webhook: e.target.value },
                    }))
                  }
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Actions */}
      <div className="flex gap-3">
        <Button>Save Alert Settings</Button>
        <Button variant="outline">Test Notifications</Button>
      </div>
    </div>
  );
}
