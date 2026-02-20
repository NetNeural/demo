/**
 * Test Device Interactive Controls
 *
 * Provides UI controls for manipulating test device sensor values in real-time.
 * Allows raising/lowering values, changing device status, and triggering alerts.
 */
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  Activity,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { DeviceType } from '@/types/device-types'

interface TestDeviceControlsProps {
  deviceId: string
  deviceTypeId: string | null
  currentStatus: string
  onDataSent?: () => void
}

export function TestDeviceControls({
  deviceId,
  deviceTypeId,
  currentStatus,
  onDataSent,
}: TestDeviceControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deviceType, setDeviceType] = useState<DeviceType | null>(null)
  const [organizationId, setOrganizationId] = useState<string>('')

  // Control values
  const [sensorValue, setSensorValue] = useState(50)
  const [batteryLevel, setBatteryLevel] = useState(100)
  const [signalStrength, setSignalStrength] = useState(-50)
  const [status, setStatus] = useState<
    'online' | 'offline' | 'error' | 'warning'
  >((currentStatus as 'online' | 'offline' | 'error' | 'warning') || 'online')

  // Load device and device type configuration
  useEffect(() => {
    if (!isOpen) return

    const loadData = async () => {
      try {
        const supabase = createClient()

        // Load device to get organization_id
        const { data: deviceData, error: deviceError } = await supabase
          .from('devices')
          .select('organization_id')
          .eq('id', deviceId)
          .single()

        if (deviceError) throw deviceError
        if (deviceData) setOrganizationId(deviceData.organization_id)

        // Load device type if provided
        if (deviceTypeId) {
          const { data, error } = await supabase
            .from('device_types')
            .select('*')
            .eq('id', deviceTypeId)
            .single()

          if (error) throw error
          setDeviceType(data)

          // Set initial sensor value to middle of normal range
          if (data) {
            const midPoint = (data.lower_normal + data.upper_normal) / 2
            setSensorValue(midPoint)
          }
        }
      } catch (error) {
        console.error('Failed to load device data:', error)
      }
    }

    loadData()
  }, [deviceTypeId, deviceId, isOpen])

  const handleSendData = async () => {
    setLoading(true)
    try {
      const supabase = createClient()

      // Insert telemetry data
      const { error: telemetryError } = await supabase
        .from('device_telemetry_history')
        .insert({
          device_id: deviceId,
          organization_id: organizationId,
          telemetry: {
            value: sensorValue,
            unit: deviceType?.unit || '',
            type: deviceType?.device_class || 'test',
            sensor: deviceType?.name || 'test',
          },
          device_timestamp: new Date().toISOString(),
          received_at: new Date().toISOString(),
        })

      if (telemetryError) throw telemetryError

      // Update device status and metadata
      const { error: deviceError } = await supabase
        .from('devices')
        .update({
          status,
          battery_level: batteryLevel,
          signal_strength: signalStrength,
          last_seen: new Date().toISOString(),
        })
        .eq('id', deviceId)

      if (deviceError) throw deviceError

      // Check if value is outside normal range
      const isAlert =
        deviceType &&
        (sensorValue < deviceType.lower_normal ||
          sensorValue > deviceType.upper_normal)

      toast.success(
        isAlert
          ? `⚠️ Data sent - Value outside normal range!`
          : `✅ Test data sent successfully`,
        {
          description: `${deviceType?.name || 'Sensor'}: ${sensorValue.toFixed(deviceType?.precision_digits ?? 2)}${deviceType?.unit || ''}`,
        }
      )

      onDataSent?.()
    } catch (error) {
      console.error('Failed to send test data:', error)
      toast.error('Failed to send test data')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickPreset = (preset: 'normal' | 'warning' | 'error') => {
    if (!deviceType) return

    switch (preset) {
      case 'normal':
        setSensorValue((deviceType.lower_normal + deviceType.upper_normal) / 2)
        setStatus('online')
        break
      case 'warning':
        // Just outside normal range
        setSensorValue(deviceType.upper_normal + deviceType.upper_normal * 0.1)
        setStatus('warning')
        break
      case 'error':
        // At or beyond alert threshold
        const errorValue =
          deviceType.upper_alert ?? deviceType.upper_normal * 1.5
        setSensorValue(errorValue)
        setStatus('error')
        break
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3 transition-colors hover:bg-blue-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-sm font-medium">
                  Test Controls
                </CardTitle>
                <Badge
                  variant="outline"
                  className="border-blue-500/30 bg-blue-500/10 px-1.5 py-0 text-[10px] text-blue-600"
                >
                  Interactive
                </Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {deviceType ? (
              <>
                {/* Quick Presets */}
                <div className="space-y-2">
                  <Label className="text-xs">Quick Scenarios</Label>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => handleQuickPreset('normal')}
                    >
                      ✅ Normal
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs text-yellow-600 hover:text-yellow-600"
                      onClick={() => handleQuickPreset('warning')}
                    >
                      ⚠️ Warning
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs text-red-600 hover:text-red-600"
                      onClick={() => handleQuickPreset('error')}
                    >
                      🚨 Error
                    </Button>
                  </div>
                </div>

                {/* Sensor Value Slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      {deviceType.name} Value
                      {deviceType.unit && (
                        <span className="ml-1 text-muted-foreground">
                          ({deviceType.unit})
                        </span>
                      )}
                    </Label>
                    <Badge variant="outline" className="font-mono text-xs">
                      {sensorValue.toFixed(deviceType.precision_digits ?? 2)}
                    </Badge>
                  </div>

                  <Slider
                    value={[sensorValue]}
                    onValueChange={([value]) =>
                      value !== undefined && setSensorValue(value)
                    }
                    min={
                      deviceType.lower_alert ?? deviceType.lower_normal * 0.5
                    }
                    max={
                      deviceType.upper_alert ?? deviceType.upper_normal * 1.5
                    }
                    step={
                      (deviceType.upper_normal - deviceType.lower_normal) / 100
                    }
                    className="w-full"
                  />

                  {/* Range indicators */}
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    {deviceType.lower_alert && (
                      <span className="text-red-500">
                        Min: {deviceType.lower_alert}
                      </span>
                    )}
                    <span className="text-green-500">
                      Normal: {deviceType.lower_normal} -{' '}
                      {deviceType.upper_normal}
                    </span>
                    {deviceType.upper_alert && (
                      <span className="text-red-500">
                        Max: {deviceType.upper_alert}
                      </span>
                    )}
                  </div>
                </div>

                {/* Device Status */}
                <div className="space-y-2">
                  <Label className="text-xs">Device Status</Label>
                  <Select
                    value={status}
                    onValueChange={(val) =>
                      setStatus(
                        val as 'online' | 'offline' | 'error' | 'warning'
                      )
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">🟢 Online</SelectItem>
                      <SelectItem value="offline">⚫ Offline</SelectItem>
                      <SelectItem value="warning">🟡 Warning</SelectItem>
                      <SelectItem value="error">🔴 Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Battery Level */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Battery Level (%)</Label>
                    <Badge variant="outline" className="font-mono text-xs">
                      {batteryLevel}%
                    </Badge>
                  </div>
                  <Slider
                    value={[batteryLevel]}
                    onValueChange={([value]) =>
                      value !== undefined && setBatteryLevel(value)
                    }
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>

                {/* Signal Strength */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Signal Strength (dBm)</Label>
                    <Badge variant="outline" className="font-mono text-xs">
                      {signalStrength} dBm
                    </Badge>
                  </div>
                  <Slider
                    value={[signalStrength]}
                    onValueChange={([value]) =>
                      value !== undefined && setSignalStrength(value)
                    }
                    min={-120}
                    max={-30}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Weak</span>
                    <span>Strong</span>
                  </div>
                </div>

                {/* Send Button */}
                <Button
                  onClick={handleSendData}
                  disabled={loading}
                  className="w-full"
                  size="sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Send Test Data
                    </>
                  )}
                </Button>

                {/* Alert Warning */}
                {deviceType &&
                  (sensorValue < deviceType.lower_normal ||
                    sensorValue > deviceType.upper_normal) && (
                    <div className="flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                      <p className="text-xs text-muted-foreground">
                        This value is outside the normal range and will trigger
                        an alert state.
                      </p>
                    </div>
                  )}
              </>
            ) : (
              <div className="py-4 text-center text-sm text-muted-foreground">
                <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                Loading device configuration...
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
