import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const response = await fetch(`${apiUrl}/api/alerts`, {
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
    console.error('Error fetching alerts:', error)
    
    // Return mock data if API fails
    const mockAlerts = [
      {
        id: '1',
        type: 'critical',
        title: 'Temperature Alert',
        message: 'Temperature exceeds safe operating range',
        sensor_name: 'Temperature Sensor A1',
        location_name: 'Building A - Floor 1',
        department_name: 'Manufacturing',
        triggered_at: new Date().toISOString(),
        is_active: true,
        acknowledged: false,
      },
    ]
    
    return NextResponse.json(mockAlerts)
  }
}
