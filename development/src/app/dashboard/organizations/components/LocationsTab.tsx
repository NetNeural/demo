'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Plus } from 'lucide-react';

interface LocationsTabProps {
  organizationId: string;
}

export function LocationsTab({ organizationId }: LocationsTabProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Locations
            </CardTitle>
            <CardDescription>
              Manage physical locations for organization {organizationId}
            </CardDescription>
          </div>
          <Button onClick={() => alert('Add Location feature coming soon! This will open a dialog to add a new location.')}>
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-center py-8">
          Locations management interface coming soon...
        </p>
      </CardContent>
    </Card>
  );
}
