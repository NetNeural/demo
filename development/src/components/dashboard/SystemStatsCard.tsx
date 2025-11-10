'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState, useCallback } from 'react'
import { edgeFunctions } from '@/lib/edge-functions/client'
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
      const response = await edgeFunctions.organizations.stats(currentOrganization.id);

      if (!response.success || !response.data) {
        console.error('Failed to fetch system stats:', response.error);
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
        
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = response.data as any;
      
      // Convert API response to component format
      setStats({
        totalDevices: data.totalDevices || 0,
        activeDevices: data.onlineDevices || 0,
        offlineDevices: (data.totalDevices || 0) - (data.onlineDevices || 0),
        alertsCount: data.activeAlerts || 0,
        connectivityRate: data.totalDevices > 0 ? Math.round((data.onlineDevices / data.totalDevices) * 100) : 0,
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