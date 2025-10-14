'use client';

import React, { useState } from 'react';
import { Settings, Globe, Clock, Shield } from 'lucide-react';
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
import { SettingsSection } from './shared/SettingsSection';
import { SettingsFormGroup } from './shared/SettingsFormGroup';

interface GeneralTabProps {
  initialAppName?: string;
  initialLanguage?: string;
  initialTimezone?: string;
  initialAnalytics?: boolean;
  initialCrashReports?: boolean;
}

export default function GeneralTab({
  initialAppName = 'NetNeural IoT Platform',
  initialLanguage = 'en-US',
  initialTimezone = 'UTC-8',
  initialAnalytics = true,
  initialCrashReports = true,
}: GeneralTabProps) {
  const [appName, setAppName] = useState(initialAppName);
  const [language, setLanguage] = useState(initialLanguage);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [crashReports, setCrashReports] = useState(initialCrashReports);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement API call to save general settings
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Saving general settings:', {
        appName,
        language,
        timezone,
        analytics,
        crashReports,
      });
    } catch (error) {
      console.error('Error saving general settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAppName(initialAppName);
    setLanguage(initialLanguage);
    setTimezone(initialTimezone);
    setAnalytics(initialAnalytics);
    setCrashReports(initialCrashReports);
  };

  return (
    <div className="space-y-6">
      {/* Application Settings */}
      <SettingsSection
        icon={<Settings className="w-5 h-5" />}
        title="Application Settings"
        description="Configure global application settings and preferences"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <SettingsFormGroup
            label="Application Name"
            description="The name displayed throughout the platform"
            required
          >
            <Input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="Enter application name"
            />
          </SettingsFormGroup>

          <SettingsFormGroup
            label="Default Language"
            description="Language for the user interface"
            required
          >
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en-US">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    English (US)
                  </div>
                </SelectItem>
                <SelectItem value="en-UK">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    English (UK)
                  </div>
                </SelectItem>
                <SelectItem value="es">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Spanish
                  </div>
                </SelectItem>
                <SelectItem value="fr">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    French
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingsFormGroup>

          <SettingsFormGroup
            label="Timezone"
            description="Default timezone for timestamps"
            required
          >
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UTC-8">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    UTC-8 (Pacific Time)
                  </div>
                </SelectItem>
                <SelectItem value="UTC-5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    UTC-5 (Eastern Time)
                  </div>
                </SelectItem>
                <SelectItem value="UTC+0">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    UTC+0 (GMT)
                  </div>
                </SelectItem>
                <SelectItem value="UTC+1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    UTC+1 (Central European Time)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </SettingsFormGroup>
        </div>
      </SettingsSection>

      {/* Data & Privacy */}
      <SettingsSection
        icon={<Shield className="w-5 h-5" />}
        title="Data & Privacy"
        description="Control how your data is collected and used"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="analytics" className="text-base">
                Analytics & Usage Tracking
              </Label>
              <p className="text-sm text-muted-foreground">
                Help us improve the platform by sharing anonymous usage data
              </p>
            </div>
            <Switch
              id="analytics"
              checked={analytics}
              onCheckedChange={setAnalytics}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="crash-reports" className="text-base">
                Automatic Crash Reports
              </Label>
              <p className="text-sm text-muted-foreground">
                Send crash reports automatically to help diagnose issues
              </p>
            </div>
            <Switch
              id="crash-reports"
              checked={crashReports}
              onCheckedChange={setCrashReports}
            />
          </div>
        </div>
      </SettingsSection>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSave} disabled={isLoading} className="flex-1 sm:flex-initial">
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button onClick={handleReset} variant="outline" disabled={isLoading}>
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
