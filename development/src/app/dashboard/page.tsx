'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { StatsCard } from '@/components/ui/stats-card'
import { LocationsCard } from '@/components/dashboard/LocationsCard'
import { useOrganization } from '@/contexts/OrganizationContext'

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const { currentOrganization, stats, isLoading: isLoadingOrg } = useOrganization()

  useEffect(() => {
    // Simple timeout to simulate loading
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  if (loading || isLoadingOrg) {
    return (
      <div className="dashboard-loading">
        <div className="text-center">
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!currentOrganization) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Welcome to NetNeural IoT Platform"
          description="Select an organization to view your dashboard"
        />
        <div className="flex items-center justify-center p-12 border-2 border-dashed rounded-lg">
          <div className="text-center space-y-3">
            <p className="text-muted-foreground">No organization selected</p>
            <p className="text-sm text-muted-foreground">Please select an organization from the sidebar to continue</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`${currentOrganization.name} Dashboard`}
        description={`Overview of your IoT infrastructure for ${currentOrganization.name}`}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div onClick={() => router.push('/dashboard/devices')} className="cursor-pointer">
          <StatsCard
            icon="📱"
            label="Total Devices"
            value={stats?.totalDevices?.toString() || currentOrganization.deviceCount?.toString() || "0"}
          />
        </div>
        
        <div onClick={() => router.push('/dashboard/devices')} className="cursor-pointer">
          <StatsCard
            icon="✅"
            label="Active Devices"
            value={stats?.onlineDevices?.toString() || "0"}
          />
        </div>
        
        <div onClick={() => router.push('/dashboard/alerts')} className="cursor-pointer">
          <StatsCard
            icon="🚨"
            label="Active Alerts"
            value={stats?.activeAlerts?.toString() || "0"}
          />
        </div>
        
        <div onClick={() => router.push('/dashboard/organizations')} className="cursor-pointer">
          <StatsCard
            icon="👥"
            label="Team Members"
            value={stats?.totalUsers?.toString() || currentOrganization.userCount?.toString() || "0"}
          />
        </div>
      </div>

      {/* Locations Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <LocationsCard />
      </div>
    </div>
  )
}