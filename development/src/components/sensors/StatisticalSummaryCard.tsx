'use client'

// Statistical AI Summary - Intelligent analysis of sensor telemetry data
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMemo, useEffect, useState } from 'react'
import { Brain, TrendingUp, TrendingDown, AlertCircle, CheckCircle, Thermometer, Droplets, Wind, Battery } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Device } from '@/types/sensor-details'

interface TelemetryReading {
  telemetry: {
    value?: number
    type?: number
    sensor?: string
    [key: string]: unknown
  }
  device_timestamp: string | null
  received_at: string
}

interface StatisticalSummaryCardProps {
  device: Device
  telemetryReadings: TelemetryReading[]
}

interface SensorAnalysis {
  sensorType: string
  sensorName: string
  icon: typeof Thermometer
  avg: number
  min: number
  max: number
  trend: 'rising' | 'falling' | 'stable'
  trendPercent: number
  readings: number
  lastValue: number
}

interface AIInsight {
  type: 'normal' | 'warning' | 'critical' | 'info'
  icon: typeof CheckCircle
  title: string
  message: string
}

const SENSOR_LABELS: Record<number, string> = {
  1: 'Temperature',
  2: 'Humidity',
  3: 'Pressure',
  4: 'CO₂',
  5: 'VOC',
  6: 'Light',
  7: 'Motion',
}

const SENSOR_ICONS: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Wind,
  battery: Battery,
}

export function StatisticalSummaryCard({ device, telemetryReadings }: StatisticalSummaryCardProps) {
  const [temperatureUnit, setTemperatureUnit] = useState<'celsius' | 'fahrenheit'>('celsius')

  // Fetch temperature unit preference from thresholds
  useEffect(() => {
    const fetchTemperatureUnit = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('sensor_thresholds')
        .select('temperature_unit')
        .eq('device_id', device.id)
        .limit(1)
        .single() as { data: { temperature_unit?: string } | null }
      
      if (data?.temperature_unit) {
        setTemperatureUnit(data.temperature_unit as 'celsius' | 'fahrenheit')
      }
    }
    fetchTemperatureUnit()
  }, [device.id])

  // Helper to format values with units
  const formatValue = (value: number, sensorName: string): string => {
    const nameLower = sensorName.toLowerCase()
    if (nameLower.includes('temperature') || nameLower.includes('temp')) {
      if (temperatureUnit === 'fahrenheit') {
        const fahrenheit = (value * 9/5) + 32
        return `${fahrenheit.toFixed(1)}°F`
      }
      return `${value.toFixed(1)}°C`
    } else if (nameLower.includes('humidity')) {
      return `${value.toFixed(1)}%`
    } else if (nameLower.includes('battery')) {
      return `${value.toFixed(0)}%`
    } else if (nameLower.includes('pressure')) {
      return `${value.toFixed(1)} hPa`
    }
    return value.toFixed(1)
  }

  // Analyze each sensor type separately
  const sensorAnalyses = useMemo<SensorAnalysis[]>(() => {
    if (telemetryReadings.length === 0) return []

    const sensorGroups: Record<string, TelemetryReading[]> = {}
    
    // Group readings by sensor type
    for (const reading of telemetryReadings) {
      const sensorKey = reading.telemetry.type != null
        ? `type_${reading.telemetry.type}`
        : reading.telemetry.sensor || 'unknown'
      
      if (!sensorGroups[sensorKey]) {
        sensorGroups[sensorKey] = []
      }
      sensorGroups[sensorKey].push(reading)
    }

    // Analyze each sensor group
    return Object.entries(sensorGroups).map(([sensorKey, readings]) => {
      const values = readings
        .map(r => r.telemetry.value)
        .filter((v): v is number => v != null)

      if (values.length === 0) return null

      const avg = values.reduce((sum, v) => sum + v, 0) / values.length
      const min = Math.min(...values)
      const max = Math.max(...values)
      const lastValue = values[0] // Most recent

      // Calculate trend: compare first half vs second half
      const halfPoint = Math.floor(values.length / 2)
      const recentValues = values.slice(0, halfPoint)
      const olderValues = values.slice(halfPoint)
      
      const recentAvg = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length
      const olderAvg = olderValues.reduce((sum, v) => sum + v, 0) / olderValues.length
      
      const change = recentAvg - olderAvg
      const trendPercent = Math.abs((change / olderAvg) * 100)
      
      let trend: 'rising' | 'falling' | 'stable' = 'stable'
      if (trendPercent > 5) {
        trend = change > 0 ? 'rising' : 'falling'
      }

      // Get sensor label and icon
      const parts = sensorKey.split('_')
      const typeId = sensorKey.startsWith('type_') && parts[1] ? parseInt(parts[1]) : null
      
      // Safely access readings array
      const firstReading = readings[0]
      const sensorName = (typeId && SENSOR_LABELS[typeId]) 
        || firstReading?.telemetry.sensor 
        || 'Sensor'
      const sensorTypeLower = sensorName.toLowerCase()
      const icon = SENSOR_ICONS[sensorTypeLower] || Thermometer


      return {
        sensorType: sensorKey,
        sensorName,
        icon,
        avg,
        min,
        max,
        trend,
        trendPercent,
        readings: values.length,
        lastValue,
      }
    }).filter((a): a is SensorAnalysis => a !== null)
  }, [telemetryReadings])

  // Generate AI insights based on sensor data
  const aiInsights = useMemo<AIInsight[]>(() => {
    const insights: AIInsight[] = []

    if (sensorAnalyses.length === 0) {
      insights.push({
        type: 'info',
        icon: AlertCircle,
        title: 'No Data Available',
        message: 'Waiting for telemetry data to generate insights.',
      })
      return insights
    }

    let hasWarning = false
    let hasCritical = false

    // Analyze each sensor for issues
    for (const sensor of sensorAnalyses) {
      // Temperature analysis
      if (sensor.sensorName.toLowerCase().includes('temperature')) {
        if (sensor.trend === 'falling' && sensor.trendPercent > 10) {
          insights.push({
            type: 'warning',
            icon: TrendingDown,
            title: 'Temperature Dropping',
            message: `Temperature has dropped ${sensor.trendPercent.toFixed(1)}% recently. Condenser or cooling system may be failing. Current: ${formatValue(sensor.lastValue, sensor.sensorName)}`,
          })
          hasWarning = true
        } else if (sensor.trend === 'rising' && sensor.trendPercent > 10) {
          insights.push({
            type: 'warning',
            icon: TrendingUp,
            title: 'Temperature Rising',
            message: `Temperature has increased ${sensor.trendPercent.toFixed(1)}% recently. Check HVAC system or cooling. Current: ${formatValue(sensor.lastValue, sensor.sensorName)}`,
          })
          hasWarning = true
        } else if (sensor.lastValue > 35) {
          insights.push({
            type: 'critical',
            icon: AlertCircle,
            title: 'High Temperature Alert',
            message: `Temperature at ${formatValue(sensor.lastValue, sensor.sensorName)} is critically high. Immediate cooling required.`,
          })
          hasCritical = true
        } else if (sensor.lastValue < 5) {
          insights.push({
            type: 'critical',
            icon: AlertCircle,
            title: 'Low Temperature Alert',
            message: `Temperature at ${formatValue(sensor.lastValue, sensor.sensorName)} is critically low. Check heating system.`,
          })
          hasCritical = true
        }
      }

      // Humidity analysis
      if (sensor.sensorName.toLowerCase().includes('humidity')) {
        if (sensor.trend === 'rising' && sensor.trendPercent > 8) {
          insights.push({
            type: 'warning',
            icon: TrendingUp,
            title: 'Humidity Climbing',
            message: `Humidity has increased ${sensor.trendPercent.toFixed(1)}% recently (now ${sensor.lastValue.toFixed(1)}%). Room ventilation may be needed to prevent moisture buildup.`,
          })
          hasWarning = true
        } else if (sensor.lastValue > 70) {
          insights.push({
            type: 'critical',
            icon: AlertCircle,
            title: 'High Humidity Alert',
            message: `Humidity at ${sensor.lastValue.toFixed(1)}% is too high. Risk of mold and equipment damage. Increase ventilation immediately.`,
          })
          hasCritical = true
        } else if (sensor.lastValue < 20) {
          insights.push({
            type: 'warning',
            icon: AlertCircle,
            title: 'Low Humidity',
            message: `Humidity at ${sensor.lastValue.toFixed(1)}% is very low. May cause static electricity and discomfort.`,
          })
          hasWarning = true
        }
      }

      // Battery analysis
      if (sensor.sensorName.toLowerCase().includes('battery')) {
        if (sensor.lastValue < 20) {
          insights.push({
            type: 'critical',
            icon: Battery,
            title: 'Low Battery Critical',
            message: `Battery at ${sensor.lastValue.toFixed(0)}%. Device will shut down soon. Replace or recharge immediately.`,
          })
          hasCritical = true
        } else if (sensor.lastValue < 30) {
          insights.push({
            type: 'warning',
            icon: Battery,
            title: 'Battery Low',
            message: `Battery at ${sensor.lastValue.toFixed(0)}%. Consider replacing soon to avoid service interruption.`,
          })
          hasWarning = true
        }
      }

      // Pressure analysis
      if (sensor.sensorName.toLowerCase().includes('pressure')) {
        if (sensor.trend === 'falling' && sensor.trendPercent > 5) {
          insights.push({
            type: 'info',
            icon: TrendingDown,
            title: 'Pressure Dropping',
            message: `Pressure has decreased ${sensor.trendPercent.toFixed(1)}%. Weather change or system depressurization detected.`,
          })
        }
      }
    }

    // If no warnings or critical issues, add positive feedback
    if (!hasWarning && !hasCritical) {
      insights.push({
        type: 'normal',
        icon: CheckCircle,
        title: 'All Systems Normal',
        message: 'Based on recent sensor data, all measurements are within normal operating ranges. Equipment is functioning properly.',
      })
    }

    // Overall data quality insight
    const totalReadings = sensorAnalyses.reduce((sum, s) => sum + s.readings, 0)
    insights.push({
      type: 'info',
      icon: Brain,
      title: 'Data Quality',
      message: `Analyzing ${totalReadings.toLocaleString()} readings across ${sensorAnalyses.length} sensor${sensorAnalyses.length > 1 ? 's' : ''}. AI pattern detection active.`,
    })

    return insights
  }, [sensorAnalyses, temperatureUnit])

  const getTrendIcon = (trend: 'rising' | 'falling' | 'stable') => {
    if (trend === 'rising') return <TrendingUp className="h-4 w-4 text-orange-500" />
    if (trend === 'falling') return <TrendingDown className="h-4 w-4 text-blue-500" />
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const getInsightColor = (type: AIInsight['type']) => {
    switch (type) {
      case 'critical': return 'destructive'
      case 'warning': return 'secondary'
      case 'normal': return 'default'
      case 'info': return 'outline'
      default: return 'outline'
    }
  }

  const getInsightBg = (type: AIInsight['type']) => {
    switch (type) {
      case 'critical': return 'bg-red-50 dark:bg-red-950 border-red-200'
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200'
      case 'normal': return 'bg-green-50 dark:bg-green-950 border-green-200'
      case 'info': return 'bg-blue-50 dark:bg-blue-950 border-blue-200'
      default: return 'bg-muted'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          🤖 AI Powered Predictive Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sensor Statistics Grid */}
        {sensorAnalyses.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sensorAnalyses.map((sensor) => {
              const Icon = sensor.icon
              return (
                <div key={sensor.sensorType} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{sensor.sensorName}</span>
                    </div>
                    {getTrendIcon(sensor.trend)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Avg</p>
                      <p className="font-semibold">{formatValue(sensor.avg, sensor.sensorName)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Min</p>
                      <p className="font-semibold">{formatValue(sensor.min, sensor.sensorName)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Max</p>
                      <p className="font-semibold">{formatValue(sensor.max, sensor.sensorName)}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {sensor.readings.toLocaleString()} readings
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* AI Insights */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4" />
            AI-Powered Predictive Analysis
          </div>
          <ScrollArea className="h-[200px]">
            <div className="space-y-2 pr-3">
              {aiInsights.map((insight, idx) => {
                const Icon = insight.icon
                return (
                  <div key={idx} className={`p-3 border rounded-lg ${getInsightBg(insight.type)}`}>
                    <div className="flex items-start gap-3">
                      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{insight.title}</p>
                          <Badge variant={getInsightColor(insight.type)} className="text-xs">
                            {insight.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{insight.message}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}
