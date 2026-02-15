import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sensors/[id]
// Fetch sensor details and telemetry data for a specific device
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: deviceId } = params
    const searchParams = request.nextUrl.searchParams
    const sensorType = searchParams.get('sensor_type') || 'temperature'
    const timeRange = searchParams.get('time_range') || '48h'
    const organizationId = request.headers.get('x-organization-id')

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ORG', message: 'Organization ID is required' } },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify device belongs to organization
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('organization_id', organizationId)
      .single()

    if (deviceError || !device) {
      return NextResponse.json(
        { success: false, error: { code: 'DEVICE_NOT_FOUND', message: 'Device not found' } },
        { status: 404 }
      )
    }

    // Calculate time range
    const timeRangeHours: Record<string, number> = {
      '48h': 48,
      '7d': 168,
      '30d': 720,
      '90d': 2160,
    }
    const hours = timeRangeHours[timeRange] || 48
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // Fetch latest reading
    const { data: latestReading } = await supabase
      .from('device_data')
      .select('*')
      .eq('device_id', deviceId)
      .eq('sensor_type', sensorType)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    // Fetch trend data (time-series)
    const { data: trendData } = await supabase
      .from('device_data')
      .select('timestamp, value, quality')
      .eq('device_id', deviceId)
      .eq('sensor_type', sensorType)
      .gte('timestamp', startTime)
      .order('timestamp', { ascending: true })
      .limit(1000)

    // Calculate statistics
    let statistics = null
    if (trendData && trendData.length > 0) {
      const values = trendData.map((d: { value: number }) => d.value)
      const sum = values.reduce((acc: number, val: number) => acc + val, 0)
      const avg = sum / values.length
      const min = Math.min(...values)
      const max = Math.max(...values)
      
      // Calculate standard deviation
      const squareDiffs = values.map((val: number) => Math.pow(val - avg, 2))
      const avgSquareDiff = squareDiffs.reduce((acc: number, val: number) => acc + val, 0) / values.length
      const stddev = Math.sqrt(avgSquareDiff)

      statistics = {
        current: latestReading?.value || 0,
        min,
        max,
        avg,
        stddev,
        readings_count: trendData.length,
        last_updated: latestReading?.timestamp || new Date().toISOString(),
      }
    }

    // Fetch threshold configuration
    // NOTE: TypeScript error expected - sensor_thresholds table not in types yet
    // Run: npx supabase gen types typescript --local > src/lib/database.types.ts
    // after applying migrations to fix
    const { data: threshold } = await supabase
      .from('sensor_thresholds')
      .select('*')
      .eq('device_id', deviceId)
      .eq('sensor_type', sensorType)
      .single()

    // Fetch recent activity
    // NOTE: TypeScript error expected - sensor_activity table not in types yet
    const { data: recentActivity } = await supabase
      .from('sensor_activity')
      .select('*')
      .eq('device_id', deviceId)
      .eq('sensor_type', sensorType)
      .order('occurred_at', { ascending: false })
      .limit(20)

    // Get all available sensor types for this device
    const { data: availableSensors } = await supabase
      .from('device_data')
      .select('sensor_type')
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .limit(100)

    const uniqueSensors = [
      ...new Set(availableSensors?.map((s: { sensor_type: string }) => s.sensor_type) || []),
    ]

    // Build response
    const responseData = {
      device: {
        id: device.id,
        name: device.name,
        device_type: device.device_type,
        model: device.model,
        serial_number: device.serial_number,
        status: device.status,
        location: device.location_id,
        firmware_version: device.firmware_version,
        battery_level: device.battery_level,
        signal_strength: device.signal_strength,
        last_seen: device.last_seen,
        metadata: device.metadata,
      },
      sensor_type: sensorType,
      latest_reading: latestReading || null,
      trend_data: trendData || [],
      statistics,
      threshold: threshold || null,
      recent_activity: recentActivity || [],
      available_sensors: uniqueSensors.length > 0 ? uniqueSensors : ['temperature'],
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    })
  } catch (error) {
    console.error('Error fetching sensor data:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch sensor data',
        },
      },
      { status: 500 }
    )
  }
}
