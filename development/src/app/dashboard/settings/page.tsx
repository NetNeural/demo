'use client';

import { useState } from 'react';
import { User, Settings, Shield, Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { ProfileTab } from './components/ProfileTab';
import { PreferencesTab } from './components/PreferencesTab';
import { SecurityTab } from './components/SecurityTab';
import { UserOrganizationsTab } from './components/UserOrganizationsTab';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Settings"
        description="Manage your profile, preferences, and security settings"
      />

      <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span>Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Security</span>
          </TabsTrigger>
          <TabsTrigger value="organizations" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span>Organizations</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <ProfileTab
            initialName="NetNeural Admin"
            initialEmail="admin@netneural.ai"
            initialNotifications={true}
          />
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <PreferencesTab />
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations">
          <UserOrganizationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
