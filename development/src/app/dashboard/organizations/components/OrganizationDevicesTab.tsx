'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Smartphone, Plus, Power, AlertCircle } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { edgeFunctions } from '@/lib/edge-functions'

interface Device {
  id: string
  name: string
  status: 'online' | 'offline' | 'warning' | 'error'
  location: string
  lastSeen: string
}

interface OrganizationDevicesTabProps {
  organizationId: string
}

export function OrganizationDevicesTab({
  organizationId,
}: OrganizationDevicesTabProps) {
  const router = useRouter()
  const { canManageDevices } = useOrganization()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDevices = useCallback(async () => {
    if (!organizationId) {
      setDevices([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await edgeFunctions.devices.list(organizationId)

      if (!response.success) {
        const errorMsg = response.error?.message || 'Failed to fetch devices'
        throw new Error(errorMsg)
      }

      setDevices((response.data?.devices as Device[]) || [])
    } catch (error) {
      console.error('Error fetching devices:', error)
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Devices ({devices.length})
              </CardTitle>
              <CardDescription>
                Devices registered in this organization (ID: {organizationId})
              </CardDescription>
            </div>
            {canManageDevices && (
              <Button
                onClick={() =>
                  router.push(
                    `/dashboard/devices?action=add&organization=${organizationId}`
                  )
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Device
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading devices...</p>
            </div>
          ) : devices.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                No devices found for this organization
              </p>
              {canManageDevices && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Click &quot;Add Device&quot; to register your first device
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-start gap-3">
                    <Smartphone className="mt-1 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{device.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {device.location}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last seen: {device.lastSeen}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {device.status === 'online' ? (
                      <Badge variant="default" className="bg-green-500">
                        <Power className="mr-1 h-3 w-3" />
                        Online
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Offline
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
