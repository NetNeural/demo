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
  { id: 'customer-assistance', label: 'Customer Assistance', icon: Users },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: Wrench },
  { id: 'system-health', label: 'System Health', icon: Activity },
  { id: 'admin-tools', label: 'Admin Tools', icon: Settings2 },
  { id: 'tests', label: 'Tests & Validation', icon: FlaskConical },
  { id: 'documentation', label: 'Documentation', icon: BookOpen },
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
      <div className="space-y-6">
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support & Administration"
        description={`Diagnostics, customer tools, and troubleshooting for ${orgName}`}
        action={
          user?.isSuperAdmin ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Super Admin — Cross-Org Access
            </Badge>
          ) : undefined
        }
      />

      <Tabs defaultValue="customer-assistance" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start flex-wrap">
          {tabs.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="flex items-center gap-2">
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="customer-assistance">
          <CustomerAssistanceTab organizationId={orgId} />
        </TabsContent>

        <TabsContent value="troubleshooting">
          <TroubleshootingTab organizationId={orgId} />
        </TabsContent>

        <TabsContent value="system-health">
          <SystemHealthTab organizationId={orgId} isSuperAdmin={user?.isSuperAdmin || false} />
        </TabsContent>

        <TabsContent value="admin-tools">
          <AdminToolsTab organizationId={orgId} />
        </TabsContent>

        <TabsContent value="tests">
          <TestsTab organizationId={orgId} />
        </TabsContent>

        <TabsContent value="documentation">
          <DocumentationTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
