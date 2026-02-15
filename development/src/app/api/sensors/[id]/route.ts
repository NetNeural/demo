import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Helper function to safely extract number from telemetry value
function extractNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'value' in value) {
    const obj = value as { value: unknown }
    if (typeof obj.value === 'number') return obj.value
  }
  return null
}

// Helper function to extract metadata from telemetry value
function extractMetadata(value: unknown): { unit?: string; quality?: number } {
  const result: { unit?: string; quality?: number } = {}
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.unit === 'string') result.unit = obj.unit
    if (typeof obj.quality === 'number') result.quality = obj.quality
  }
  return result
}

// Helper to get default unit for sensor type
function getDefaultUnit(sensorType: string): string {
  const units: Record<string, string> = {
    temperature: '°C',
    humidity: '%',
    pressure: 'hPa',
    battery: 'V',
    voltage: 'V',
    current: 'A',
    power: 'W',
    energy: 'kWh',
    distance: 'm',
    speed: 'm/s',
    acceleration: 'm/s²',
    angle: '°',
    frequency: 'Hz',
    luminosity: 'lux',
    sound: 'dB',
    co2: 'ppm',
    voc: 'ppb',
  }
  return units[sensorType.toLowerCase()] || ''
}

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

    // Fetch telemetry data from device_telemetry_history (where webhooks store data)
    const { data: telemetryRecords } = await supabase
      .from('device_telemetry_history')
      .select('telemetry, created_at, device_timestamp')
      .eq('device_id', deviceId)
      .gte('created_at', startTime)
      .order('created_at', { ascending: false })
      .limit(1000)

    // Extract sensor readings from telemetry JSONB
    const readings: Array<{ timestamp: string; value: number; quality: number | null; unit?: string }> = []
    let latestReading: typeof readings[0] & { id: string; device_id: string; sensor_type: string; created_at: string } | null = null

    if (telemetryRecords && telemetryRecords.length > 0) {
      for (const record of telemetryRecords) {
        const telemetry = record.telemetry as Record<string, unknown>
        
        // Extract the specific sensor value from telemetry
        // Telemetry format can be: { temperature: 22.5, humidity: 60, ... }
        // or { metrics: { temperature: { value: 22.5, unit: "°C" } } }
        let sensorValue: number | null = null
        let sensorUnit: string | null = null
        let quality: number | null = 95 // Default quality

        // Try direct property
        if (sensorType in telemetry) {
          sensorValue = extractNumber(telemetry[sensorType])
          const metadata = extractMetadata(telemetry[sensorType])
          sensorUnit = metadata.unit ?? null
          quality = metadata.quality ?? quality
        }
        
        // Try nested in metrics
        if (sensorValue === null && 'metrics' in telemetry && telemetry.metrics && typeof telemetry.metrics === 'object') {
          const metrics = telemetry.metrics as Record<string, unknown>
          if (sensorType in metrics) {
            sensorValue = extractNumber(metrics[sensorType])
            const metadata = extractMetadata(metrics[sensorType])
            sensorUnit = metadata.unit ?? null
            quality = metadata.quality ?? quality
          }
        }
        
        // Try in data object
        if (sensorValue === null && 'data' in telemetry && telemetry.data && typeof telemetry.data === 'object') {
          const data = telemetry.data as Record<string, unknown>
          if (sensorType in data) {
            sensorValue = extractNumber(data[sensorType])
            const metadata = extractMetadata(data[sensorType])
            sensorUnit = metadata.unit ?? null
            quality = metadata.quality ?? quality
          }
        }

        if (sensorValue !== null) {
          const reading = {
            timestamp: record.device_timestamp || record.created_at,
            value: sensorValue,
            quality,
            unit: sensorUnit || getDefaultUnit(sensorType)
          }
          
          readings.push(reading)
          
          // First (most recent) reading with this sensor
          if (!latestReading) {
            latestReading = {
              id: record.created_at,
              device_id: deviceId,
              sensor_type: sensorType,
              value: sensorValue,
              unit: sensorUnit || getDefaultUnit(sensorType),
              quality,
              timestamp: record.device_timestamp || record.created_at,
              created_at: record.created_at
            }
          }
        }
      }
    }

    // Reverse to get chronological order for trend data
    const trendData = readings.reverse()

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

    // Get all available sensor types from telemetry
    const { data: recentTelemetry } = await supabase
      .from('device_telemetry_history')
      .select('telemetry')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(10)

    const uniqueSensors: string[] = []
    if (recentTelemetry && recentTelemetry.length > 0) {
      const sensorSet = new Set<string>()
      for (const record of recentTelemetry) {
        const telemetry = record.telemetry as TelemetryData
        // Extract sensor names from telemetry structure
        const extractSensorNames = (obj: TelemetryData, prefix = ''): void => {
          for (const key in obj) {
            const value = obj[key]
            if (typeof value === 'number' || (typeof value === 'object' && value !== null && 'value' in value)) {
              sensorSet.add(prefix + key)
            } else if (typeof value === 'object' && value !== null && key !== 'metadata' && key !== 'location') {
              extractSensorNames(value as TelemetryData, prefix)
            }
          }Record<string, unknown>
        // Extract sensor names from telemetry structure
        const extractSensorNames = (obj: Record<string, unknown>, prefix = ''): void => {
          for (const key in obj) {
            const value = obj[key]
            // Skip metadata and location keys
            if (key === 'metadata' || key === 'location') continue
            
            // If it's a number or has a value property, it's a sensor
            if (typeof value === 'number' || (value && typeof value === 'object' && 'value' in value)) {
              sensorSet.add(prefix + key)
            } 
            // Recursively check nested objects (like metrics, data)
            else if (value && typeof value === 'object' && !Array.isArray(value)) {
              extractSensorNames(value as Record<string, unknown>
      uniqueSensors.push('temperature', 'humidity', 'pressure')
    }

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
      available_sensors: uniqueSensors,
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
