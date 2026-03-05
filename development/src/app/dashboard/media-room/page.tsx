'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Share2,
  Mail,
  Shield,
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
import { EmailBroadcastCard } from '../support/components/EmailBroadcastCard'

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
            Social media management and communications
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="w-full justify-start">
          <TabsTrigger
            value="social-media"
            className="flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            <span>Social Media</span>
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger
              value="communication"
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              <span>Communication</span>
              <Shield className="h-3 w-3 text-red-400" />
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="social-media">
          <SocialMediaTab organizationId={orgId} />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="communication">
            <EmailBroadcastCard />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
