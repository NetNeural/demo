'use client';

import { useState } from 'react';
import { User, Bell, Send } from 'lucide-react';
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

interface ProfileTabProps {
  initialName?: string;
  initialEmail?: string;
  initialNotifications?: boolean;
}

export function ProfileTab({
  initialName = 'NetNeural Admin',
  initialEmail = 'admin@netneural.ai',
  initialNotifications = true
}: ProfileTabProps) {
  const [profileName, setProfileName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [notifications, setNotifications] = useState(initialNotifications);
  const [marketing, setMarketing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    // TODO: Implement save functionality
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  const handleReset = () => {
    setProfileName(initialName);
    setEmail(initialEmail);
    setJobTitle('');
    setDepartment('');
    setNotifications(initialNotifications);
    setMarketing(false);
  };

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <SettingsSection
        icon={<User className="w-5 h-5" />}
        title="Personal Information"
        description="Manage your personal details and contact information"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SettingsFormGroup label="Full Name" required>
            <Input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Enter your full name"
            />
          </SettingsFormGroup>

          <SettingsFormGroup label="Email Address" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@company.com"
            />
          </SettingsFormGroup>

          <SettingsFormGroup label="Job Title">
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., IoT Engineer, Operations Manager"
            />
          </SettingsFormGroup>

          <SettingsFormGroup label="Department">
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="operations">Operations</SelectItem>
                <SelectItem value="management">Management</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </SettingsFormGroup>
        </div>
      </SettingsSection>

      {/* Notification Preferences */}
      <SettingsSection
        icon={<Bell className="w-5 h-5" />}
        title="Notification Preferences"
        description="Control how you receive updates and communications"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications" className="text-base font-medium">
                Email Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive email notifications for account updates and alerts
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div className="space-y-0.5">
              <Label htmlFor="marketing" className="text-base font-medium">
                Product Updates
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive product updates, newsletters, and feature announcements
              </p>
            </div>
            <Switch
              id="marketing"
              checked={marketing}
              onCheckedChange={setMarketing}
            />
          </div>
        </div>
      </SettingsSection>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? (
            <>
              <Send className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={isLoading}>
          Reset Changes
        </Button>
      </div>
    </div>
  );
}
