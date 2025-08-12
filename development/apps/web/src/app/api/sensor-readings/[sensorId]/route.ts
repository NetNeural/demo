import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/client'

// Required for static export - generate static params for known sensors
export const dynamic = 'force-static'
export const revalidate = false

// Generate static params for all available sensors
export async function generateStaticParams() {
  try {
    const supabase = createClient()
    const { data: sensors } = await supabase
      .from('sensors')
      .select('id')
    
    return sensors?.map((sensor) => ({
      sensorId: sensor.id,
    })) || []
  } catch (error) {
    console.error('Error generating static params:', error)
    return []
  }
}

// This route gets sensor readings from Supabase for a specific sensor
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sensorId: string }> }
) {
  try {
    const supabase = createClient()
    const { sensorId } = await params
    
    // For static export, we'll fetch the last 24 hours of data
    // Query parameters would need to be handled client-side in static export
    const timeAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
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
