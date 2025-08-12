import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

// Required for static export
export const dynamic = 'force-static'
export const revalidate = false

// This route gets sensor readings from Supabase for a specific sensor
export async function GET(
  request: NextRequest,
  { params }: { params: { sensorId: string } }
) {
  try {
    const supabase = createClient()
    const { sensorId } = params
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '24h'
    
    // Calculate the time range
    let hoursBack = 24
    switch (range) {
      case '1h':
        hoursBack = 1
        break
      case '6h':
        hoursBack = 6
        break
      case '24h':
        hoursBack = 24
        break
      case '7d':
        hoursBack = 24 * 7
        break
      default:
        hoursBack = 24
    }
    
    const timeAgo = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
    
    const { data: readings, error } = await supabase
      .from('sensor_readings')
      .select('*')
      .eq('sensor_id', sensorId)
      .gte('reading_time', timeAgo)
      .order('reading_time', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    return NextResponse.json(readings || [])
  } catch (error) {
    console.error('Error fetching sensor readings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sensor readings' },
      { status: 500 }
    )
  }
}
