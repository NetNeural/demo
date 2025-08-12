import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const response = await fetch(`${apiUrl}/api/locations`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching locations:', error)
    
    // Return mock data if API fails
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
