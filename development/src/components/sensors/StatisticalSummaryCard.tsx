'use client'

// Statistical AI Summary - Intelligent analysis with instant temperature unit sync
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMemo, useEffect, useState, useCallback } from 'react'
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
  temperatureUnit: 'celsius' | 'fahrenheit'
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

// Location-specific expectations for context-aware AI analysis
interface LocationContext {
  tempMin: number  // °C
  tempMax: number  // °C
  humidityMin: number  // %
  humidityMax: number  // %
  context: string
}

const LOCATION_CONTEXTS: Record<string, LocationContext> = {
  // Refrigerated spaces
  'walk-in cooler': { tempMin: 0, tempMax: 4, humidityMin: 85, humidityMax: 95, context: 'Walk-in coolers require 32-40°F (0-4°C) and 85-95% humidity for fresh produce storage.' },
  'cooler': { tempMin: 0, tempMax: 4, humidityMin: 85, humidityMax: 95, context: 'Coolers should maintain refrigeration temperatures around 32-40°F (0-4°C).' },
  'refrigerator': { tempMin: 1, tempMax: 4, humidityMin: 65, humidityMax: 75, context: 'Refrigerators should stay between 34-40°F (1-4°C) for food safety.' },
  'freezer': { tempMin: -23, tempMax: -18, humidityMin: 0, humidityMax: 10, context: 'Freezers must maintain -10 to 0°F (-23 to -18°C) for proper food preservation.' },
  
  // Food preparation
  'kitchen': { tempMin: 18, tempMax: 24, humidityMin: 40, humidityMax: 60, context: 'Commercial kitchens should maintain 65-75°F (18-24°C) with moderate humidity.' },
  'prep area': { tempMin: 18, tempMax: 24, humidityMin: 40, humidityMax: 60, context: 'Food prep areas need controlled temperatures around 65-75°F (18-24°C).' },
  'bean room': { tempMin: 18, tempMax: 22, humidityMin: 50, humidityMax: 70, context: 'Coffee bean storage requires cool, dry conditions around 65-72°F (18-22°C) with 50-70% humidity.' },
  
  // Produce storage
  'produce': { tempMin: 7, tempMax: 13, humidityMin: 85, humidityMax: 95, context: 'Fresh vegetables need 45-55°F (7-13°C) and 85-95% humidity to prevent wilting.' },
  'vegetable': { tempMin: 7, tempMax: 13, humidityMin: 85, humidityMax: 95, context: 'Vegetable storage requires cool temperatures and high humidity to maintain freshness.' },
  
  // Humid environments
  'bathroom': { tempMin: 20, tempMax: 26, humidityMin: 40, humidityMax: 70, context: 'Bathrooms typically have higher humidity (40-70%) and should stay between 68-78°F (20-26°C).' },
  'shower': { tempMin: 20, tempMax: 26, humidityMin: 60, humidityMax: 80, context: 'Shower areas have elevated humidity and should monitor for excess moisture above 80%.' },
  
  // Storage areas
  'basement': { tempMin: 15, tempMax: 21, humidityMin: 30, humidityMax: 50, context: 'Basements should stay cool and dry, around 60-70°F (15-21°C) with 30-50% humidity to prevent mold.' },
  'storage': { tempMin: 15, tempMax: 24, humidityMin: 30, humidityMax: 60, context: 'General storage areas benefit from stable conditions around 60-75°F (15-24°C).' },
  'warehouse': { tempMin: 15, tempMax: 27, humidityMin: 30, humidityMax: 60, context: 'Warehouse spaces should maintain 60-80°F (15-27°C) depending on stored goods.' },
  
  // Climate controlled
  'server room': { tempMin: 18, tempMax: 27, humidityMin: 40, humidityMax: 60, context: 'Server rooms require 64-80°F (18-27°C) and 40-60% humidity for optimal equipment performance.' },
  'office': { tempMin: 20, tempMax: 24, humidityMin: 40, humidityMax: 60, context: 'Office spaces should maintain comfortable conditions around 68-75°F (20-24°C).' },
  'lab': { tempMin: 20, tempMax: 24, humidityMin: 30, humidityMax: 60, context: 'Laboratory environments need stable conditions around 68-75°F (20-24°C) with controlled humidity.' },
}

// Smart location detection from installed_at field
function getLocationContext(installedAt: string | undefined): LocationContext | null {
  if (!installedAt) return null
  
  const location = installedAt.toLowerCase()
  
  // Direct match
  for (const [key, context] of Object.entries(LOCATION_CONTEXTS)) {
    if (location.includes(key)) {
      return context
    }
  }
  
  return null
}

export function StatisticalSummaryCard({ device, telemetryReadings, temperatureUnit }: StatisticalSummaryCardProps) {
  console.log('🌡️ [StatisticalSummaryCard] Rendering with temperatureUnit:', temperatureUnit)
  
  // Extract installation location for context-aware analysis
  const installedAt = device.metadata?.installed_at as string | undefined
  const locationContext = getLocationContext(installedAt)
  console.log('📍 [LocationContext]:', installedAt, locationContext)
  
  // State for AI insights
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [useOpenAI, setUseOpenAI] = useState(true) // Toggle for AI vs rule-based
  const supabase = createClient()
  
  // Helper to format values with units - memoized to ensure stable reference
  const formatValue = useCallback((value: number, sensorName: string): string => {
    const nameLower = sensorName.toLowerCase()
    if (nameLower.includes('temperature') || nameLower.includes('temp')) {
      if (temperatureUnit === 'fahrenheit') {
        const fahrenheit = (value * 9/5) + 32
        console.log('🌡️ [formatValue] Converting to Fahrenheit:', value, '°C →', fahrenheit.toFixed(1), '°F')
        return `${fahrenheit.toFixed(1)}°F`
      }
      console.log('🌡️ [formatValue] Keeping Celsius:', value, '°C')
      return `${value.toFixed(1)}°C`
    } else if (nameLower.includes('humidity')) {
      return `${value.toFixed(1)}%`
    } else if (nameLower.includes('battery')) {
      return `${value.toFixed(0)}%`
    } else if (nameLower.includes('pressure')) {
      return `${value.toFixed(1)} hPa`
    }
    return value.toFixed(1)
  }, [temperatureUnit])

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

  // Fetch AI insights from OpenAI Edge Function
  useEffect(() => {
    let mounted = true

    const fetchAIInsights = async () => {
      // Skip if no data or AI disabled
      if (sensorAnalyses.length === 0 || !useOpenAI) {
        if (mounted) {
          setAiInsights(generateRuleBasedInsights())
        }
        return
      }

      setAiLoading(true)
      
      try {
        console.log('🤖 Fetching AI insights from OpenAI...')
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-insights`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            deviceId: device.id,
            deviceName: device.name,
            installedAt,
            telemetryReadings: telemetryReadings.slice(0, 50), // Last 50 readings
            temperatureUnit,
            organizationId: device.organization_id
          }),
        })

        const data = await response.json()
        
        if (data.fallback || data.error) {
          console.warn('⚠️ AI insights unavailable, using rule-based fallback:', data.error)
          if (mounted) {
            setAiInsights(generateRuleBasedInsights())
          }
        } else {
          console.log('✅ AI insights received:', data.cached ? '(cached)' : '(fresh)', data.insights)
          if (mounted) {
            setAiInsights(data.insights.map((insight: { type: string; title: string; message: string; confidence?: number }) => ({
              ...insight,
              icon: getIconForInsightType(insight.type)
            })))
          }
        }
      } catch (error) {
        console.error('❌ Failed to fetch AI insights:', error)
        if (mounted) {
          setAiInsights(generateRuleBasedInsights())
        }
      } finally {
        if (mounted) {
          setAiLoading(false)
        }
      }
    }

    fetchAIInsights()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.id, telemetryReadings.length, temperatureUnit, sensorAnalyses.length, useOpenAI])

  // Helper: Get icon for insight type
  const getIconForInsightType = (type: string) => {
    switch (type) {
      case 'critical': return AlertCircle
      case 'warning': return TrendingUp
      case 'normal': return CheckCircle
      default: return Brain
    }
  }

  // Generate rule-based insights as fallback
  const generateRuleBasedInsights = useCallback((): AIInsight[] => {
    console.log('🤖 [aiInsights] Generating rule-based insights with temperatureUnit:', temperatureUnit)
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

    // Add location context insight if available
    if (locationContext && installedAt) {
      insights.push({
        type: 'info',
        icon: Brain,
        title: `Location-Aware Analysis: ${installedAt}`,
        message: locationContext.context,
      })
    }

    let hasWarning = false
    let hasCritical = false

    // Analyze each sensor for issues
    for (const sensor of sensorAnalyses) {
      // Temperature analysis with location context
      if (sensor.sensorName.toLowerCase().includes('temperature')) {
        const tempCelsius = sensor.lastValue // Always in Celsius for comparison
        
        // Location-aware temperature analysis
        if (locationContext) {
          const { tempMin, tempMax, context } = locationContext
          const isRefrigeratedSpace = installedAt && (
            installedAt.toLowerCase().includes('cooler') ||
            installedAt.toLowerCase().includes('freezer') ||
            installedAt.toLowerCase().includes('refriger')
          )
          
          if (tempCelsius < tempMin - 2) {
            const lowTempAdvice = isRefrigeratedSpace
              ? 'Check thermostat settings or cooling system - may be running too cold.'
              : 'Check heating system or insulation.'
            
            insights.push({
              type: 'critical',
              icon: AlertCircle,
              title: `Temperature Too Low for ${installedAt}`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} is below optimal range for this location. ${context} ${lowTempAdvice}`,
            })
            hasCritical = true
          } else if (tempCelsius < tempMin) {
            insights.push({
              type: 'warning',
              icon: TrendingDown,
              title: `Temperature Below Optimal`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} is slightly below recommended range for ${installedAt}. Expected: ${formatValue(tempMin, sensor.sensorName)}-${formatValue(tempMax, sensor.sensorName)}`,
            })
            hasWarning = true
          } else if (tempCelsius > tempMax + 2) {
            const highTempAdvice = isRefrigeratedSpace
              ? 'Cooling system may be failing or door left open. Check immediately to prevent spoilage.'
              : 'Check HVAC/cooling system.'
            
            insights.push({
              type: 'critical',
              icon: AlertCircle,
              title: `Temperature Too High for ${installedAt}`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} exceeds safe limits. ${context} ${highTempAdvice}`,
            })
            hasCritical = true
          } else if (tempCelsius > tempMax) {
            insights.push({
              type: 'warning',
              icon: TrendingUp,
              title: `Temperature Above Optimal`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} is above recommended range for ${installedAt}. Expected: ${formatValue(tempMin, sensor.sensorName)}-${formatValue(tempMax, sensor.sensorName)}`,
            })
            hasWarning = true
          } else {
            // Within optimal range - provide positive feedback
            insights.push({
              type: 'normal',
              icon: CheckCircle,
              title: `Temperature Optimal for ${installedAt}`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} is within ideal range. ${context}`,
            })
          }
        } else {
          // Generic temperature analysis when no location context
          if (sensor.trend === 'falling' && sensor.trendPercent > 10) {
            insights.push({
              type: 'warning',
              icon: TrendingDown,
              title: 'Temperature Dropping',
              message: `Temperature has dropped ${sensor.trendPercent.toFixed(1)}% recently. Current: ${formatValue(sensor.lastValue, sensor.sensorName)}`,
            })
            hasWarning = true
          } else if (sensor.trend === 'rising' && sensor.trendPercent > 10) {
            insights.push({
              type: 'warning',
              icon: TrendingUp,
              title: 'Temperature Rising',
              message: `Temperature has increased ${sensor.trendPercent.toFixed(1)}% recently. Current: ${formatValue(sensor.lastValue, sensor.sensorName)}`,
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
      }

      // Humidity analysis with location context
      if (sensor.sensorName.toLowerCase().includes('humidity')) {
        const humidity = sensor.lastValue
        
        // Location-aware humidity analysis
        if (locationContext) {
          const { humidityMin, humidityMax, context } = locationContext
          
          if (humidity < humidityMin - 10) {
            insights.push({
              type: 'critical',
              icon: AlertCircle,
              title: `Humidity Too Low for ${installedAt}`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} is critically below optimal range. ${context} Check humidification or ventilation systems.`,
            })
            hasCritical = true
          } else if (humidity < humidityMin) {
            insights.push({
              type: 'warning',
              icon: TrendingDown,
              title: `Humidity Below Optimal`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} is below recommended range for ${installedAt}. Expected: ${humidityMin}-${humidityMax}%`,
            })
            hasWarning = true
          } else if (humidity > humidityMax + 10) {
            insights.push({
              type: 'critical',
              icon: AlertCircle,
              title: `Humidity Too High for ${installedAt}`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} exceeds safe limits. ${context} Risk of condensation, mold, or spoilage. Increase ventilation immediately.`,
            })
            hasCritical = true
          } else if (humidity > humidityMax) {
            insights.push({
              type: 'warning',
              icon: TrendingUp,
              title: `Humidity Above Optimal`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} is above recommended range for ${installedAt}. Expected: ${humidityMin}-${humidityMax}%`,
            })
            hasWarning = true
          } else {
            // Within optimal range
            insights.push({
              type: 'normal',
              icon: CheckCircle,
              title: `Humidity Optimal for ${installedAt}`,
              message: `${formatValue(sensor.lastValue, sensor.sensorName)} is within ideal range. ${context}`,
            })
          }
        } else {
          // Generic humidity analysis when no location context
          if (sensor.trend === 'rising' && sensor.trendPercent > 8) {
            insights.push({
              type: 'warning',
              icon: TrendingUp,
              title: 'Humidity Climbing',
              message: `Humidity has increased ${sensor.trendPercent.toFixed(1)}% recently (now ${formatValue(sensor.lastValue, sensor.sensorName)}). Room ventilation may be needed to prevent moisture buildup.`,
            })
            hasWarning = true
          } else if (sensor.lastValue > 70) {
            insights.push({
              type: 'critical',
              icon: AlertCircle,
              title: 'High Humidity Alert',
              message: `Humidity at ${formatValue(sensor.lastValue, sensor.sensorName)} is too high. Risk of mold and equipment damage. Increase ventilation immediately.`,
            })
            hasCritical = true
          } else if (sensor.lastValue < 20) {
            insights.push({
              type: 'warning',
              icon: AlertCircle,
              title: 'Low Humidity',
              message: `Humidity at ${formatValue(sensor.lastValue, sensor.sensorName)} is very low. May cause static electricity and discomfort.`,
            })
            hasWarning = true
          }
        }
      }

      // Battery analysis
      if (sensor.sensorName.toLowerCase().includes('battery')) {
        if (sensor.lastValue < 20) {
          insights.push({
            type: 'critical',
            icon: Battery,
            title: 'Low Battery Critical',
            message: `Battery at ${formatValue(sensor.lastValue, sensor.sensorName)}. Device will shut down soon. Replace or recharge immediately.`,
          })
          hasCritical = true
        } else if (sensor.lastValue < 30) {
          insights.push({
            type: 'warning',
            icon: Battery,
            title: 'Battery Low',
            message: `Battery at ${formatValue(sensor.lastValue, sensor.sensorName)}. Consider replacing soon to avoid service interruption.`,
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
      message: `Analyzing ${totalReadings.toLocaleString()} readings across ${sensorAnalyses.length} sensor${sensorAnalyses.length > 1 ? 's' : ''}. Rule-based pattern detection.`,
    })

    console.log('🤖 [generateRuleBasedInsights] Generated', insights.length, 'insights')
    return insights
  }, [sensorAnalyses, formatValue, temperatureUnit, locationContext, installedAt])

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
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            🤖 AI Powered Predictive Analysis
            {aiLoading && (
              <span className="text-xs text-muted-foreground animate-pulse">
                (generating insights...)
              </span>
            )}
          </CardTitle>
          <button
            onClick={() => setUseOpenAI(!useOpenAI)}
            className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
            title={useOpenAI ? 'Using OpenAI GPT-3.5' : 'Using rule-based analysis'}
          >
            {useOpenAI ? '🤖 AI' : '📊 Rules'}
          </button>
        </div>
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
