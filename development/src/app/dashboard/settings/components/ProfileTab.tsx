'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { User, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAutoSave } from '@/hooks/useAutoSave';
import { AutoSaveIndicator } from '@/components/ui/auto-save-indicator';
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

export function ProfileTab() {
  const { toast } = useToast();
  const [profileName, setProfileName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

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
      }
      
      // Email comes from auth
      if (user.email) setEmail(user.email);

      // Mark loaded so auto-save starts watching
      setLoaded(true);
    };
    
    loadProfile();
  }, []);

  // Data object for auto-save — only profile fields (not email, which needs confirmation)
  const profileData = useMemo(
    () => ({ profileName, jobTitle, department }),
    [profileName, jobTitle, department]
  );

  const saveProfile = useCallback(async (data: typeof profileData) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not logged in');

    // Update full_name in users table
    const { error: userError } = await supabase
      .from('users')
      .update({
        full_name: data.profileName,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (userError) throw userError;

    // Store other profile fields in user_metadata
    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        job_title: data.jobTitle,
        department: data.department,
      }
    });

    if (metadataError) throw metadataError;
  }, []);

  const { status: autoSaveStatus } = useAutoSave({
    data: profileData,
    onSave: saveProfile,
    delay: 1200,
    enabled: loaded,
  });

  // Manual email update (requires confirmation flow)
  const handleEmailChange = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in",
          variant: "destructive",
        });
        return;
      }

      if (email === user.email) return;

      const { error } = await supabase.auth.updateUser({ email });
      if (error) {
        toast({
          title: "Error",
          description: "Failed to update email: " + error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Confirmation sent",
        description: "Check your new email to confirm the change.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update email: " + (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <SettingsSection
        icon={<User className="w-5 h-5" />}
        title="Personal Information"
        description="Manage your personal details and contact information"
        actions={<AutoSaveIndicator status={autoSaveStatus} />}
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
            <div className="flex gap-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@company.com"
                className="flex-1"
              />
              <Button size="sm" variant="outline" onClick={handleEmailChange} disabled={isLoading}>
                <Send className="w-3 h-3 mr-1" />
                Update
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Email changes require confirmation via email.</p>
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

      <p className="text-xs text-muted-foreground text-center">
        Changes are saved automatically.
      </p>
    </div>
  );
}
