'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Wrench, Activity, Settings2, FlaskConical, BookOpen, Shield } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
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
  { id: 'customer-assistance', label: 'Customer Assistance', icon: Users, superAdminOnly: false },
  { id: 'admin-tools', label: 'Admin Tools', icon: Settings2, superAdminOnly: false },
  { id: 'documentation', label: 'Documentation', icon: BookOpen, superAdminOnly: false },
  // Platform tabs — NetNeural super admins only
  { id: 'troubleshooting', label: 'Troubleshooting', icon: Wrench, superAdminOnly: true },
  { id: 'system-health', label: 'System Health', icon: Activity, superAdminOnly: true },
  { id: 'tests', label: 'Tests & Validation', icon: FlaskConical, superAdminOnly: true },
]

export default function SupportPage() {
  const { user, loading: userLoading } = useUser()
  const { currentOrganization } = useOrganization()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('customer-assistance')

  useEffect(() => {
    if (!userLoading && !canAccessSupport(user)) {
      toast.error('You do not have permission to access the Support page')
      router.replace('/dashboard')
    }
  }, [user, userLoading, router])

  if (userLoading) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
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

  const visibleTabs = tabs.filter(tab => !tab.superAdminOnly || isSuperAdmin)

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <PageHeader
        title={orgName ? `${orgName} Support & Administration` : 'Support & Administration'}
        description={`Diagnostics, customer tools, and troubleshooting for ${orgName}`}
        action={
          isSuperAdmin ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Super Admin — Cross-Org Access
            </Badge>
          ) : undefined
        }
      />

      <Tabs defaultValue="customer-assistance" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start flex-wrap">
          {visibleTabs.map(({ id, label, icon: Icon, superAdminOnly }) => (
            <TabsTrigger key={id} value={id} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              {superAdminOnly && <Shield className="w-3 h-3 text-red-400" />}
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
            <SystemHealthTab organizationId={orgId} isSuperAdmin={isSuperAdmin} />
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
