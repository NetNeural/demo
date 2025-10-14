'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'

interface SystemStats {
  totalDevices: number
  activeDevices: number
  offlineDevices: number
  alertsCount: number
  connectivityRate: number
  dataPoints: number
}

export function SystemStatsCard() {
  const [stats, setStats] = useState<SystemStats>({
    totalDevices: 0,
    activeDevices: 0,
    offlineDevices: 0,
    alertsCount: 0,
    connectivityRate: 0,
    dataPoints: 0
  })
  const [loading, setLoading] = useState(true)
  const { currentOrganization } = useOrganization()

  const fetchStats = useCallback(async () => {
    if (!currentOrganization) {
      setStats({
        totalDevices: 0,
        activeDevices: 0,
        offlineDevices: 0,
        alertsCount: 0,
        connectivityRate: 0,
        dataPoints: 0
      })
      setLoading(false)
      return
    }

    try {
      // Get authenticated user's session
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }
      
      // Filter by current organization
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dashboard-stats?organization_id=${currentOrganization.id}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Convert API response to component format
        setStats({
          totalDevices: data.devices.total,
          activeDevices: data.devices.online,
          offlineDevices: data.devices.offline,
          alertsCount: data.alerts.unresolved || data.alerts.total,
          connectivityRate: Math.round((data.devices.online / data.devices.total) * 100) || 0,
          dataPoints: 0 // TODO: Implement sensor data aggregation for accurate count
        });
      } catch (error) {
        console.error('Failed to fetch system stats:', error);
        // Show empty state on error instead of mock data
        setStats({
          totalDevices: 0,
          activeDevices: 0,
          offlineDevices: 0,
          alertsCount: 0,
          connectivityRate: 0,
          dataPoints: 0
        });
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    fetchStats()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  if (loading) {
    return (
      <>
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-gray-200 animate-pulse rounded"></div>
            </CardContent>
          </Card>
        ))}
      </>
    )
  }

  const cards = [
    {
      title: "Total Devices",
      value: stats.totalDevices.toLocaleString(),
      description: "Connected IoT devices",
      icon: "📱",
      trend: "+12% from last month"
    },
    {
      title: "Active Devices", 
      value: stats.activeDevices.toLocaleString(),
      description: "Currently online",
      icon: "🟢",
      trend: `${stats.connectivityRate}% connectivity`
    },
    {
      title: "Active Alerts",
      value: stats.alertsCount.toLocaleString(),
      description: "Requiring attention",
      icon: "🚨",
      trend: stats.alertsCount > 0 ? "Action needed" : "All clear"
    },
    {
      title: "Data Points",
      value: stats.dataPoints > 0 ? (stats.dataPoints / 1000000).toFixed(1) + "M" : "N/A",
      description: "Collected this month",
      icon: "📊",
      trend: stats.dataPoints > 0 ? `${(stats.dataPoints / 1000000).toFixed(1)}M collected` : "Not yet tracking"
    }
  ]

  return (
    <>
      {cards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <span className="text-2xl">{card.icon}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
            <p className="text-xs text-green-600 mt-1">{card.trend}</p>
          </CardContent>
        </Card>
      ))}
    </>
  )
}