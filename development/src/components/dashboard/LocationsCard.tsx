'use client'

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Loader2 } from 'lucide-react'
import { useOrganization } from '@/contexts/OrganizationContext'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client';
import { handleApiError } from '@/lib/api-error-handler';

interface Location {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

export function LocationsCard() {
  const { currentOrganization } = useOrganization()
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      setLoading(true);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('[Auth] No session found for locations fetch');
        setLocations([]);
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/locations?organization_id=${currentOrganization.id}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const errorResult = handleApiError(response, { 
        throwOnError: false,
        silentAuthErrors: true,
        logErrors: response.status !== 404 // Don't log 404s - endpoint may not exist yet
      });
      
      if (errorResult.isAuthError) {
        setLocations([]);
        return;
      }
      
      if (errorResult.statusCode === 404) {
        // Locations endpoint doesn't exist yet - this is expected in development
        console.log('[LocationsCard] Locations endpoint not available (404)');
        setLocations([]);
        return;
      }
      
      if (!errorResult.isError) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

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
            <div className="space-y-2 mt-4">
              {locations.slice(0, 3).map((location) => (
                <div key={location.id} className="flex items-center gap-2 text-sm">
                  <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
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
            <div className="text-center py-4">
              <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">No locations added yet</p>
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2"
            onClick={handleViewAll}
          >
            {locations.length > 0 ? 'View All Locations' : 'Add Location'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
