'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Users,
  Wrench,
  Activity,
  Settings2,
  FlaskConical,
  BookOpen,
  Shield,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { canAccessSupport } from '@/lib/permissions'
import { toast } from 'sonner'

import CustomerAssistanceTab from './components/CustomerAssistanceTab'
import TroubleshootingTab from './components/TroubleshootingTab'
import SystemHealthTab from './components/SystemHealthTab'
import AdminToolsTab from './components/AdminToolsTab'
import TestsTab from './components/TestsTab'
import DocumentationTab from './components/DocumentationTab'

const tabs = [
  // Org-admin tabs — visible to all org admins
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
  // Platform tabs — NetNeural super admins only
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

export default function SupportPage() {
  const { user, loading: userLoading } = useUser()
  const { currentOrganization } = useOrganization()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize activeTab from URL parameter or default
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return searchParams.get('tab') || 'customer-assistance'
    }
    return 'customer-assistance'
  })

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

  useEffect(() => {
    if (!userLoading && !canAccessSupport(user)) {
      toast.error('You do not have permission to access the Support page')
      router.replace('/dashboard')
    }
  }, [user, userLoading, router])

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

  if (!canAccessSupport(user)) {
    return null
  }

  const orgId = currentOrganization?.id || user?.organizationId || ''
  const orgName = currentOrganization?.name || user?.organizationName || ''
  const isSuperAdmin = user?.isSuperAdmin || false

  const visibleTabs = tabs.filter((tab) => !tab.superAdminOnly || isSuperAdmin)

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
            {orgName
              ? `${orgName} Support & Administration`
              : 'Support & Administration'}
          </h2>
          <p className="text-muted-foreground">
            Diagnostics, customer tools, and troubleshooting for {orgName}
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="w-full flex-wrap justify-start">
          {visibleTabs.map(({ id, label, icon: Icon, superAdminOnly }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              {superAdminOnly && <Shield className="h-3 w-3 text-red-400" />}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="customer-assistance">
          <CustomerAssistanceTab organizationId={orgId} />
        </TabsContent>

        <TabsContent value="admin-tools">
          <AdminToolsTab organizationId={orgId} />
        </TabsContent>

        <TabsContent value="documentation">
          <DocumentationTab />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="troubleshooting">
            <TroubleshootingTab organizationId={orgId} />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="system-health">
            <SystemHealthTab
              organizationId={orgId}
              isSuperAdmin={isSuperAdmin}
            />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="tests">
            <TestsTab organizationId={orgId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
