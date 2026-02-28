'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEffect, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { fetchEdgeFunction } from '@/lib/auth'

interface DeviceStatus {
  id: string
  name: string
  status: 'online' | 'offline' | 'warning'
  lastSeen: string
  batteryLevel?: number | undefined
  signalStrength?: number | undefined
}

export function DeviceStatusCard() {
  const { user } = useUser()
  const [devices, setDevices] = useState<DeviceStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDevices = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        // Super admins can view all devices or filter by org
        // Regular users only see their org's devices
        const params: Record<string, string> = {}
        if (user.organizationId) {
          params.organization_id = user.organizationId
        }
        // If super admin with no org specified, fetch all devices

        const result = (await fetchEdgeFunction('devices', params)) as {
          devices?: Array<{
            id: string
            name?: string
            device_name?: string
            status?: string
            last_seen?: string
            updated_at?: string
            battery_level?: number
            signal_strength?: number
          }>
        }

        const deviceStatuses =
          result.devices?.map((device) => ({
            id: device.id,
            name: device.name || device.device_name || 'Unknown Device',
            status: (device.status || 'offline') as
              | 'online'
              | 'offline'
              | 'warning',
            lastSeen:
              device.last_seen || device.updated_at || new Date().toISOString(),
            batteryLevel: device.battery_level,
            signalStrength: device.signal_strength,
          })) || []

        setDevices(deviceStatuses)
      } catch (error) {
        console.error('Error fetching devices:', error)
        setDevices([
          {
            id: '1',
            name: 'Temperature Sensor A1',
            status: 'online',
            lastSeen: '2 minutes ago',
            batteryLevel: 85,
            signalStrength: 92,
          },
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchDevices()
  }, [user])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Device Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-4 text-center">Loading devices...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {devices.slice(0, 5).map((device) => (
            <div
              key={device.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    device.status === 'online'
                      ? 'bg-green-500'
                      : device.status === 'warning'
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                />
                <div>
                  <p className="font-medium">{device.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Last seen: {device.lastSeen}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
