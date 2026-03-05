'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Newspaper,
  Share2,
  Users,
  Wrench,
  Activity,
  Settings2,
  FlaskConical,
  BookOpen,
  Shield,
  LifeBuoy,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { canAccessSupport } from '@/lib/permissions'
import { toast } from 'sonner'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

import { SocialMediaTab } from './components/SocialMediaTab'

// Support tab components (moved under Media Room)
import CustomerAssistanceTab from '../support/components/CustomerAssistanceTab'
import TroubleshootingTab from '../support/components/TroubleshootingTab'
import SystemHealthTab from '../support/components/SystemHealthTab'
import AdminToolsTab from '../support/components/AdminToolsTab'
import TestsTab from '../support/components/TestsTab'
import DocumentationTab from '../support/components/DocumentationTab'

const supportTabs = [
  {
    id: 'customer-assistance',
    label: 'Customer Assistance',
    icon: Users,
    superAdminOnly: false,
  },
  {
    id: 'admin-tools',
    label: 'Admin Tools',
    icon: Settings2,
    superAdminOnly: false,
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: BookOpen,
    superAdminOnly: false,
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    icon: Wrench,
    superAdminOnly: true,
  },
  {
    id: 'system-health',
    label: 'System Health',
    icon: Activity,
    superAdminOnly: true,
  },
  {
    id: 'tests',
    label: 'Tests & Validation',
    icon: FlaskConical,
    superAdminOnly: true,
  },
]

export default function MediaRoomPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <MediaRoomPageContent />
    </Suspense>
  )
}

function MediaRoomPageContent() {
  const { user, loading: userLoading } = useUser()
  const { currentOrganization, userRole } = useOrganization()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState(() => {
    return searchParams.get('tab') || 'social-media'
  })

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    if (!userLoading && !canAccessSupport(user, userRole)) {
      toast.error(
        'You do not have permission to access the Media Room. Admin or Owner role required.'
      )
      router.replace('/dashboard')
    }
  }, [user, userRole, userLoading, router])

  if (userLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-6 w-96" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!canAccessSupport(user, userRole)) {
    return null
  }

  const orgId = currentOrganization?.id || user?.organizationId || ''
  const orgName = currentOrganization?.name || user?.organizationName || ''
  const isSuperAdmin = user?.isSuperAdmin || false

  const NETNEURAL_ORG_ID = '00000000-0000-0000-0000-000000000001'
  const isNetNeuralOrg = currentOrganization?.id === NETNEURAL_ORG_ID
  const canAccessPlatformTabs =
    isSuperAdmin ||
    (isNetNeuralOrg && ['admin', 'owner'].includes(userRole ?? ''))

  const visibleSupportTabs = supportTabs.filter(
    (tab) => !tab.superAdminOnly || canAccessPlatformTabs
  )

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      <div className="flex items-center gap-3">
        <OrganizationLogo
          settings={currentOrganization?.settings}
          name={currentOrganization?.name || orgName || 'NetNeural'}
          size="xl"
        />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {orgName ? `${orgName} Media Room` : 'Media Room'}
          </h2>
          <p className="text-muted-foreground">
            Social media management, support communications, and customer tools
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="w-full flex-wrap justify-start">
          {/* Media Room tabs */}
          <TabsTrigger
            value="social-media"
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Social Media</span>
          </TabsTrigger>

          {/* Divider indicator */}
          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

          {/* Support Communications tabs */}
          {visibleSupportTabs.map(
            ({ id, label, icon: Icon, superAdminOnly }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex items-center gap-2"
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                {superAdminOnly && (
                  <Shield className="h-3 w-3 text-red-400" />
                )}
              </TabsTrigger>
            )
          )}
        </TabsList>

        {/* Social Media Tab */}
        <TabsContent value="social-media">
          <SocialMediaTab organizationId={orgId} />
        </TabsContent>

        {/* Support Tabs */}
        <TabsContent value="customer-assistance">
          <CustomerAssistanceTab organizationId={orgId} />
        </TabsContent>

        <TabsContent value="admin-tools">
          <AdminToolsTab organizationId={orgId} />
        </TabsContent>

        <TabsContent value="documentation">
          <DocumentationTab />
        </TabsContent>

        {canAccessPlatformTabs && (
          <TabsContent value="troubleshooting">
            <TroubleshootingTab organizationId={orgId} />
          </TabsContent>
        )}

        {canAccessPlatformTabs && (
          <TabsContent value="system-health">
            <SystemHealthTab
              organizationId={orgId}
              isSuperAdmin={isSuperAdmin}
            />
          </TabsContent>
        )}

        {canAccessPlatformTabs && (
          <TabsContent value="tests">
            <TestsTab organizationId={orgId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
