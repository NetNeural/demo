'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Settings, Shield, Building2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { ProfileTab } from './components/ProfileTab'
import { PreferencesTab } from './components/PreferencesTab'
import { SecurityTab } from './components/SecurityTab'
import { UserOrganizationsTab } from './components/UserOrganizationsTab'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize activeTab from URL parameter or default
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return searchParams.get('tab') || 'profile'
    }
    return 'profile'
  })

  const { currentOrganization } = useOrganization()
  const { user } = useUser()

  // Update activeTab when URL parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams, activeTab])

  // Handle tab change - update both state and URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  const fullName = user?.fullName
  const orgName = currentOrganization?.name
  const titlePrefix =
    fullName && orgName
      ? `${fullName} @ ${orgName} `
      : fullName
        ? `${fullName} `
        : orgName
          ? `${orgName} `
          : ''

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <PageHeader
        title={`${titlePrefix}Personal Settings`}
        description="Manage your profile, preferences, and security settings"
      />

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Preferences</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Security</span>
          </TabsTrigger>
          <TabsTrigger
            value="organizations"
            className="flex items-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            <span>Organizations</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <ProfileTab />
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
  )
}
