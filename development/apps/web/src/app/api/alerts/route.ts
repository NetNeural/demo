import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

// Required for static export
export const dynamic = 'force-static'
export const revalidate = false

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select(`
        *,
        sensor:sensors(name, location, type)
      `)
      .eq('is_active', true)
      .order('triggered_at', { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json(alerts)
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
