'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Settings, Shield, Building2, CreditCard } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { ProfileTab } from './components/ProfileTab'
import { PreferencesTab } from './components/PreferencesTab'
import { SecurityTab } from './components/SecurityTab'
import { UserOrganizationsTab } from './components/UserOrganizationsTab'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useUser } from '@/contexts/UserContext'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SettingsPageContent />
    </Suspense>
  )
}

function SettingsPageContent() {
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
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <TabsTrigger
            value="subscription"
            className="flex items-center gap-2"
          >
            <CreditCard className="h-4 w-4" />
            <span>Subscription</span>
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

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="text-lg font-semibold">Current Plan</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentOrganization?.subscription_tier
                  ? `Your organization is on the ${currentOrganization.subscription_tier.charAt(0).toUpperCase() + currentOrganization.subscription_tier.slice(1)} plan.`
                  : 'No active subscription found.'}
              </p>
              <div className="mt-4 flex gap-3">
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <CreditCard className="h-4 w-4" />
                  View Plans & Pricing
                </a>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
