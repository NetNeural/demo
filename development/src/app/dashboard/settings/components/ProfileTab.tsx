'use client';

import { useState, useEffect } from 'react';
import { User, Bell, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsSection } from './shared/SettingsSection';
import { SettingsFormGroup } from './shared/SettingsFormGroup';
import { createClient } from '@/lib/supabase/client';

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
  const { toast } = useToast();
  const [profileName, setProfileName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [notifications, setNotifications] = useState(initialNotifications);
  const [marketing, setMarketing] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState(initialEmail);
  const [notificationPhone, setNotificationPhone] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('all');
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('08:00');
  const [isLoading, setIsLoading] = useState(false);

  // Load profile from Supabase on mount
  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Load from users table for full_name
      const { data: userRecord } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (userRecord?.full_name) {
        setProfileName(userRecord.full_name);
      }

      // Load other profile fields from user_metadata
      const metadata = user.user_metadata;
      if (metadata) {
        if (metadata.job_title) setJobTitle(metadata.job_title);
        if (metadata.department) setDepartment(metadata.department);
        if (typeof metadata.email_notifications === 'boolean') setNotifications(metadata.email_notifications);
        if (typeof metadata.marketing_emails === 'boolean') setMarketing(metadata.marketing_emails);
      }
      
      // Email comes from auth
      if (user.email) setEmail(user.email);
    };
    
    loadProfile();
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to save profile",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Update full_name in users table
      const { error: userError } = await supabase
        .from('users')
        .update({
          full_name: profileName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (userError) {
        toast({
          title: "Error",
          description: "Failed to save profile: " + userError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Store other profile fields in user_metadata
      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          job_title: jobTitle,
          department: department,
          email_notifications: notifications,
          marketing_emails: marketing
        }
      });

      if (metadataError) {
        toast({
          title: "Partial Success",
          description: "Profile saved partially. Metadata update failed: " + metadataError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // If email changed, update auth user
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email
        });
        
        if (emailError) {
          toast({
            title: "Partial Success",
            description: "Profile saved but email update failed: " + emailError.message,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      toast({
        title: "Success",
        description: "Profile saved successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save profile: " + (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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

          {/* Email Configuration */}
          <div className="space-y-2 py-3 border-b">
            <Label htmlFor="notification-email" className="text-base font-medium">
              Notification Email
            </Label>
            <Input
              id="notification-email"
              type="email"
              placeholder="notifications@example.com"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Email address for receiving system notifications
            </p>
          </div>

          {/* Phone Number */}
          <div className="space-y-2 py-3 border-b">
            <Label htmlFor="notification-phone" className="text-base font-medium">
              Phone Number (SMS Alerts)
            </Label>
            <Input
              id="notification-phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={notificationPhone}
              onChange={(e) => setNotificationPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Phone number for critical alert SMS notifications
            </p>
          </div>

          {/* Alert Severity Filter */}
          <div className="space-y-2 py-3 border-b">
            <Label htmlFor="alert-severity" className="text-base font-medium">
              Alert Severity Level
            </Label>
            <Select value={alertSeverity} onValueChange={setAlertSeverity}>
              <SelectTrigger id="alert-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Alerts</SelectItem>
                <SelectItem value="high-critical">High & Critical Only</SelectItem>
                <SelectItem value="critical">Critical Only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Minimum severity level for notifications
            </p>
          </div>

          {/* Quiet Hours */}
          <div className="space-y-2 py-3">
            <Label className="text-base font-medium">Quiet Hours</Label>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">
                  From
                </Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">
                  To
                </Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              No non-critical notifications during these hours
            </p>
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
