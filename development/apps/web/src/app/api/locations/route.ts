import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

// Required for static export
export const dynamic = 'force-static'
export const revalidate = false

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')

    if (error) {
      throw error
    }

    return NextResponse.json(locations)
  } catch (error) {
    console.error('Error fetching locations:', error)
    
    // Return mock data if Supabase fails
    const mockLocations = [
      {
        id: '1',
        name: 'Building A - Floor 1',
        address: '123 Industrial Blvd, Portland, OR',
        latitude: 45.5152,
        longitude: -122.6784,
        sensors_total: 4,
        sensors_online: 3,
        alerts_active: 1,
      },
      {
        id: '2',
        name: 'Building B - Floor 2',
        address: '456 Technology Ave, Portland, OR',
        latitude: 45.5200,
        longitude: -122.6700,
        sensors_total: 3,
        sensors_online: 3,
        alerts_active: 0,
      },
    ]
    
    return NextResponse.json(mockLocations)
  }
}
