'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Loader2 } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useRouter } from 'next/navigation'
import { edgeFunctions } from '@/lib/edge-functions/client'

interface Location {
  id: string
  name: string
  city: string | null
  state: string | null
}

export function LocationsCard() {
  const { currentOrganization } = useOrganization()
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLocations = useCallback(async () => {
    if (!currentOrganization?.id) return

    try {
      setLoading(true)

      const response = await edgeFunctions.locations.list(
        currentOrganization.id
      )

      if (!response.success || !response.data) {
        console.log(
          '[LocationsCard] Failed to fetch locations:',
          response.error
        )
        setLocations([])
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setLocations(response.data as any)
    } catch (error) {
      console.error('Error fetching locations:', error)
      setLocations([])
    } finally {
      setLoading(false)
    }
  }, [currentOrganization?.id])

  useEffect(() => {
    fetchLocations()
  }, [fetchLocations])

  const handleViewAll = () => {
    router.push('/dashboard/organizations?tab=locations')
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Locations</CardTitle>
        <MapPin className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-2xl font-bold">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              locations.length
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {locations.length === 1 ? 'Active location' : 'Active locations'}
          </p>

          {!loading && locations.length > 0 && (
            <div className="mt-4 space-y-2">
              {locations.slice(0, 3).map((location) => (
                <div
                  key={location.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    {location.name}
                    {location.city && ` • ${location.city}`}
                    {location.state && `, ${location.state}`}
                  </span>
                </div>
              ))}
              {locations.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{locations.length - 3} more
                </p>
              )}
            </div>
          )}

          {!loading && locations.length === 0 && (
            <div className="py-4 text-center">
              <MapPin className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                No locations added yet
              </p>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={handleViewAll}
          >
            {locations.length > 0 ? 'View All Locations' : 'Add Location'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
