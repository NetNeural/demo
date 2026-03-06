'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Users,
  Wrench,
  Activity,
  FileBarChart,
  Download,
  Settings2,
  FlaskConical,
  BookOpen,
  Shield,
  ShieldCheck,
  KeyRound,
  Bot,
  Rocket,
  LifeBuoy,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OrganizationLogo } from '@/components/organizations/OrganizationLogo'
import { Skeleton } from '@/components/ui/skeleton'
import { useUser } from '@/contexts/UserContext'
import { useOrganization } from '@/contexts/OrganizationContext'
import { canAccessSupport, isPlatformAdmin } from '@/lib/permissions'
import { toast } from 'sonner'

import { LoadingSpinner } from '@/components/ui/loading-spinner'

import TroubleshootingTab from './components/TroubleshootingTab'
import SystemHealthTab from './components/SystemHealthTab'
import DataOperationsTab from './components/DataOperationsTab'
import ExecutiveReportsCard from './components/ExecutiveReportsCard'
import CustomerAssistanceTab from './components/CustomerAssistanceTab'
import AdminToolsTab from './components/AdminToolsTab'
import { AccessRequestsTab } from '@/app/dashboard/organizations/components/AccessRequestsTab'
import MercuryChat from './components/MercuryChat'
import TestsTab from './components/TestsTab'
import DocumentationTab from './components/DocumentationTab'
import PlatformHealthPage from '@/app/dashboard/admin/platform-health/page'
import SecurityAuditPage from '@/app/dashboard/admin/security-audit/page'
import PermissionsPage from '@/app/dashboard/admin/permissions/page'
import RunbookPage from '@/app/dashboard/admin/go-live-runbook/page'
import UserSupportTab from './components/UserSupportTab'

const tabs = [
  // Org-admin tabs — visible to all org admins
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
      return searchParams.get('tab') || 'access-requests'
    }
    return 'access-requests'
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
  // Platform admins (NetNeural org owners) also get access
  const canAccessPlatformTabs = isPlatformAdmin(
    user,
    currentOrganization?.id,
    userRole
  )

  // Non-root orgs (customer orgs) don't see Reports or Data & Operations
  const isRootOrg = currentOrganization?.id === '00000000-0000-0000-0000-000000000001'
  const showAdminTabs = isRootOrg || canAccessPlatformTabs

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
            'access-requests': 'customer-support',
            'executive-reports': 'customer-support',
            'data-operations': 'customer-support',
            'customer-assistance': 'customer-support',
            'admin-tools': 'customer-support',
            'user-support': 'customer-support',
            documentation: 'resources',
            troubleshooting: 'platform',
            'system-health': 'platform',
            tests: 'platform',
            'platform-health': 'platform',
            'security-audit': 'platform',
            permissions: 'platform',
            'go-live-runbook': 'platform',
          }
          return groupMap[activeTab] || 'customer-support'
        })()}
        onValueChange={(group) => {
          const defaults: Record<string, string> = {
            'customer-support': 'access-requests',
            resources: 'documentation',
            platform: 'troubleshooting',
          }
          handleTabChange(defaults[group] || 'access-requests')
        }}
        className="space-y-6"
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger
            value="customer-support"
            className="flex items-center gap-2"
          >
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
              <TabsTrigger
                value="access-requests"
                className="flex items-center gap-2"
              >
                <Bot className="h-4 w-4" />
                Mercury Support
              </TabsTrigger>
              <TabsTrigger
                value="customer-assistance"
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Customer Assistance
              </TabsTrigger>
              <TabsTrigger
                value="admin-tools"
                className="flex items-center gap-2"
              >
                <Settings2 className="h-4 w-4" />
                Admin Tools
              </TabsTrigger>
              {showAdminTabs && (
                <TabsTrigger
                  value="executive-reports"
                  className="flex items-center gap-2"
                >
                  <FileBarChart className="h-4 w-4" />
                  Reports
                </TabsTrigger>
              )}
              {showAdminTabs && (
                <TabsTrigger
                  value="data-operations"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Data & Operations
                </TabsTrigger>
              )}
              {canAccessPlatformTabs && (
                <TabsTrigger
                  value="user-support"
                  className="flex items-center gap-2"
                >
                  <LifeBuoy className="h-4 w-4" />
                  User Support
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="access-requests" className="mt-6">
              <div className="space-y-6">
                <MercuryChat key={`mercury-${orgId}`} organizationId={orgId} />
                <AccessRequestsTab key={`ar-${orgId}`} organizationId={orgId} />
              </div>
            </TabsContent>
            <TabsContent value="customer-assistance" className="mt-6">
              <CustomerAssistanceTab key={orgId} organizationId={orgId} />
            </TabsContent>
            <TabsContent value="admin-tools" className="mt-6">
              <AdminToolsTab key={orgId} organizationId={orgId} />
            </TabsContent>
            {showAdminTabs && (
              <TabsContent value="executive-reports" className="mt-6">
                <ExecutiveReportsCard key={orgId} organizationId={orgId} />
              </TabsContent>
            )}
            {showAdminTabs && (
              <TabsContent value="data-operations" className="mt-6">
                <DataOperationsTab key={orgId} organizationId={orgId} />
              </TabsContent>
            )}
            {canAccessPlatformTabs && (
              <TabsContent value="user-support" className="mt-6">
                <UserSupportTab />
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
                <TabsTrigger
                  value="troubleshooting"
                  className="flex items-center gap-2"
                >
                  <Wrench className="h-4 w-4" />
                  Troubleshooting
                </TabsTrigger>
                <TabsTrigger
                  value="system-health"
                  className="flex items-center gap-2"
                >
                  <Activity className="h-4 w-4" />
                  System Health
                </TabsTrigger>
                <TabsTrigger value="tests" className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Tests & Validation
                </TabsTrigger>
                <TabsTrigger
                  value="platform-health"
                  className="flex items-center gap-2"
                >
                  <Activity className="h-4 w-4" />
                  Platform Health
                </TabsTrigger>
                <TabsTrigger
                  value="security-audit"
                  className="flex items-center gap-2"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Security Audit
                </TabsTrigger>
                <TabsTrigger
                  value="permissions"
                  className="flex items-center gap-2"
                >
                  <KeyRound className="h-4 w-4" />
                  Permissions
                </TabsTrigger>
                <TabsTrigger
                  value="go-live-runbook"
                  className="flex items-center gap-2"
                >
                  <Rocket className="h-4 w-4" />
                  Go-Live Runbook
                </TabsTrigger>
              </TabsList>
              <TabsContent value="troubleshooting" className="mt-6">
                <TroubleshootingTab key={orgId} organizationId={orgId} />
              </TabsContent>
              <TabsContent value="system-health" className="mt-6">
                <SystemHealthTab
                  key={orgId}
                  organizationId={orgId}
                  isSuperAdmin={isSuperAdmin}
                />
              </TabsContent>
              <TabsContent value="tests" className="mt-6">
                <TestsTab key={orgId} organizationId={orgId} />
              </TabsContent>
              <TabsContent value="platform-health" className="mt-6">
                <PlatformHealthPage />
              </TabsContent>
              <TabsContent value="security-audit" className="mt-6">
                <SecurityAuditPage />
              </TabsContent>
              <TabsContent value="permissions" className="mt-6">
                <PermissionsPage />
              </TabsContent>
              <TabsContent value="go-live-runbook" className="mt-6">
                <RunbookPage />
              </TabsContent>
            </Tabs>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
