'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'

export function LocationsCard() {
  const { stats } = useOrganization()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Locations</CardTitle>
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-2xl font-bold">
            {stats?.totalLocations || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            Active locations monitored
          </p>
          
          {(stats?.totalLocations || 0) > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {/* Location thumbnails would go here when locations are loaded */}
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                <MapPin className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                <MapPin className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          )}
          
          <Button variant="outline" size="sm" className="w-full mt-2">
            View All Locations
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
