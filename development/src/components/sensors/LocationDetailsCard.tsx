'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin } from 'lucide-react'
import type { Device } from '@/types/sensor-details'

interface LocationDetailsCardProps {
  device: Device
}

export function LocationDetailsCard({ device }: LocationDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          📍 Location Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">Location</p>
          <p className="font-medium">{device.location || 'Not assigned'}</p>
        </div>
        {device.metadata?.placement && (
          <div>
            <p className="text-sm text-muted-foreground">Placement</p>
            <p className="font-medium">{device.metadata.placement}</p>
          </div>
        )}
        {device.metadata?.installed_at && (
          <div>
            <p className="text-sm text-muted-foreground">Installation Date</p>
            <p className="font-medium">
              {new Date(device.metadata.installed_at).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
