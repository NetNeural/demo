'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Users,
  Wrench,
  Activity,
  FileBarChart,
  Download,
  Mail,
  FlaskConical,
  BookOpen,
  Shield,
  UserCheck,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { canAccessSupport } from '@/lib/permissions'
import { toast } from 'sonner'

import { LoadingSpinner } from '@/components/ui/loading-spinner'

import CustomerAssistanceTab from './components/CustomerAssistanceTab'
import TroubleshootingTab from './components/TroubleshootingTab'
import SystemHealthTab from './components/SystemHealthTab'
import DataOperationsTab from './components/DataOperationsTab'
import ExecutiveReportsCard from './components/ExecutiveReportsCard'
import { EmailBroadcastCard } from './components/EmailBroadcastCard'
import { AccessRequestsTab } from '@/app/dashboard/organizations/components/AccessRequestsTab'
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
    id: 'executive-reports',
    label: 'Reports',
    icon: FileBarChart,
    superAdminOnly: false,
  },
  {
    id: 'data-operations',
    label: 'Data & Operations',
    icon: Download,
    superAdminOnly: false,
  },
  {
    id: 'communication',
    label: 'Communication',
    icon: Mail,
    superAdminOnly: true,
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
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SupportPageContent />
    </Suspense>
  )
}

function SupportPageContent() {
  const { user, loading: userLoading } = useUser()
  const { currentOrganization, userRole } = useOrganization()
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
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle tab change - update both state and URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    if (!userLoading && !canAccessSupport(user, userRole)) {
      toast.error(
        'You do not have permission to access the Support page. Admin or Owner role required.'
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

  // Super admins get access to platform tabs (troubleshooting, system-health, tests)
  const canAccessPlatformTabs = isSuperAdmin

  const visibleTabs = tabs.filter(
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
        value={(() => {
          const groupMap: Record<string, string> = {
            'customer-assistance': 'customer-support',
            'access-requests': 'customer-support',
            'executive-reports': 'customer-support',
            'data-operations': 'customer-support',
            communication: 'customer-support',
            documentation: 'resources',
            troubleshooting: 'platform', 'system-health': 'platform', tests: 'platform',
          }
          return groupMap[activeTab] || 'customer-support'
        })()}
        onValueChange={(group) => {
          const defaults: Record<string, string> = {
            'customer-support': 'customer-assistance',
            resources: 'documentation',
            platform: 'troubleshooting',
          }
          handleTabChange(defaults[group] || 'customer-assistance')
        }}
        className="space-y-6"
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger value="customer-support" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Customer Support</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span>Resources</span>
          </TabsTrigger>
          {canAccessPlatformTabs && (
            <TabsTrigger value="platform" className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-400" />
              <span>Platform</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Customer Support — Customer Assistance + Reports + Data & Ops + Communication */}
        <TabsContent value="customer-support">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="customer-assistance" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Customer Assistance
              </TabsTrigger>
              <TabsTrigger value="access-requests" className="flex items-center gap-2">
                <UserCheck className="h-4 w-4" />
                Access Requests
              </TabsTrigger>
              <TabsTrigger value="executive-reports" className="flex items-center gap-2">
                <FileBarChart className="h-4 w-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="data-operations" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Data & Operations
              </TabsTrigger>
              {isSuperAdmin && (
                <TabsTrigger value="communication" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Communication
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="customer-assistance" className="mt-6">
              <CustomerAssistanceTab organizationId={orgId} />
            </TabsContent>
            <TabsContent value="access-requests" className="mt-6">
              <AccessRequestsTab organizationId={orgId} />
            </TabsContent>
            <TabsContent value="executive-reports" className="mt-6">
              <ExecutiveReportsCard organizationId={orgId} />
            </TabsContent>
            <TabsContent value="data-operations" className="mt-6">
              <DataOperationsTab organizationId={orgId} />
            </TabsContent>
            {isSuperAdmin && (
              <TabsContent value="communication" className="mt-6">
                <EmailBroadcastCard />
              </TabsContent>
            )}
          </Tabs>
        </TabsContent>

        {/* Resources — Documentation (single tab, no sub-tabs) */}
        <TabsContent value="resources">
          <DocumentationTab />
        </TabsContent>

        {/* Platform — Troubleshooting + System Health + Tests (super admin) */}
        {canAccessPlatformTabs && (
          <TabsContent value="platform">
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="troubleshooting" className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Troubleshooting
                </TabsTrigger>
                <TabsTrigger value="system-health" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  System Health
                </TabsTrigger>
                <TabsTrigger value="tests" className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Tests & Validation
                </TabsTrigger>
              </TabsList>
              <TabsContent value="troubleshooting" className="mt-6">
                <TroubleshootingTab organizationId={orgId} />
              </TabsContent>
              <TabsContent value="system-health" className="mt-6">
                <SystemHealthTab
                  organizationId={orgId}
                  isSuperAdmin={isSuperAdmin}
                />
              </TabsContent>
              <TabsContent value="tests" className="mt-6">
                <TestsTab organizationId={orgId} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
