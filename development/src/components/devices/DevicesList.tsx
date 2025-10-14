'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useOrganization } from '@/contexts/OrganizationContext'

interface Device {
  id: string
  name: string
  type: string
  status: 'online' | 'offline' | 'warning' | 'error'
  location: string
  lastSeen: string
  batteryLevel?: number
  isExternallyManaged?: boolean
  externalDeviceId?: string | null
  integrationName?: string | null
}

export function DevicesList() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { currentOrganization } = useOrganization()

  const fetchDevices = useCallback(async () => {
    if (!currentOrganization) {
      setDevices([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      // Get authenticated user's session
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session. Please log in.')
      }
      
      // Filter by current organization
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/devices?organization_id=${currentOrganization.id}`;
      
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
      setDevices(data.devices || [])
      
    } catch (err) {
      console.error('Error fetching devices:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch devices')
      // Show empty state on error instead of mock data
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [currentOrganization])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  const getStatusIcon = (status: Device['status']) => {
    switch (status) {
      case 'online': return '🟢'
      case 'warning': return '🟡'
      case 'error': return '🔴'
      case 'offline': return '⚫'
      default: return '❓'
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <p className="text-yellow-800">
              ⚠️ {error} - Showing cached data
            </p>
          </CardContent>
        </Card>
      )}
      
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        {devices.map((device) => (
          <Card key={device.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{device.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getStatusIcon(device.status)}</span>
                  {device.isExternallyManaged && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {device.integrationName || 'External'}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{device.type}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Location:</span>
                  <span>{device.location}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Seen:</span>
                  <span>{device.lastSeen}</span>
                </div>
                {device.batteryLevel !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Battery:</span>
                    <span>{device.batteryLevel}%</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Management:</span>
                  <span className={device.isExternallyManaged ? 'text-blue-600' : 'text-gray-600'}>
                    {device.isExternallyManaged ? 'External' : 'Local'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`font-medium ${
                    device.status === 'online' ? 'text-green-600' :
                    device.status === 'warning' ? 'text-yellow-600' :
                    device.status === 'error' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>
                    {device.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {devices.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">No devices found</p>
            <Button onClick={fetchDevices}>Retry</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}