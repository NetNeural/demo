/**
 * Test Device Interactive Controls
 *
 * NetNeural Modular Test Sensor — 4 sensor channels with independent controls:
 * Temperature (°C), Humidity (%), CO₂ (ppm), Battery (%).
 * Send all sensors at once or select individual channels.
 * Auto-generate historical data to populate graphs.
 */
'use client'

import { useState, useEffect, useRef } from 'react'
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
  Thermometer,
  Droplets,
  Wind,
  BatteryMedium,
  BarChart2,
  Play,
  Square,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface TestDeviceControlsProps {
  deviceId: string
  deviceTypeId: string | null
  currentStatus: string
  onDataSent?: () => void
}

// ─── Sensor definitions ───────────────────────────────────────────────────────
const SENSORS = {
  temperature: {
    label: 'Temperature',
    unit: '°C',
    min: -10,
    max: 60,
    normalMin: 18,
    normalMax: 26,
    step: 0.5,
    decimals: 1,
    initial: 22,
    Icon: Thermometer,
    color: 'text-red-500',
  },
  humidity: {
    label: 'Humidity',
    unit: '%',
    min: 0,
    max: 100,
    normalMin: 30,
    normalMax: 60,
    step: 1,
    decimals: 0,
    initial: 45,
    Icon: Droplets,
    color: 'text-blue-500',
  },
  co2: {
    label: 'CO₂',
    unit: 'ppm',
    min: 300,
    max: 3000,
    normalMin: 400,
    normalMax: 1000,
    step: 50,
    decimals: 0,
    initial: 600,
    Icon: Wind,
    color: 'text-green-500',
  },
  battery: {
    label: 'Battery',
    unit: '%',
    min: 0,
    max: 100,
    normalMin: 20,
    normalMax: 100,
    step: 5,
    decimals: 0,
    initial: 85,
    Icon: BatteryMedium,
    color: 'text-yellow-500',
  },
} as const

type SensorKey = keyof typeof SENSORS
type SendTarget = 'all' | SensorKey
const SENSOR_KEYS = Object.keys(SENSORS) as SensorKey[]

function initialValues(): Record<SensorKey, number> {
  return Object.fromEntries(
    SENSOR_KEYS.map((k) => [k, SENSORS[k].initial])
  ) as Record<SensorKey, number>
}

export function TestDeviceControls({
  deviceId,
  currentStatus,
  onDataSent,
}: TestDeviceControlsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [organizationId, setOrganizationId] = useState<string>('')
  const [values, setValues] = useState<Record<SensorKey, number>>(initialValues)
  const [sendTarget, setSendTarget] = useState<SendTarget>('all')
  const [status, setStatus] = useState<
    'online' | 'offline' | 'error' | 'warning'
  >((currentStatus as 'online' | 'offline' | 'error' | 'warning') || 'online')
  const [batteryDevice, setBatteryDevice] = useState(85)
  const [signalStrength, setSignalStrength] = useState(-55)

  // History generation controls
  const [histSpanHours, setHistSpanHours] = useState(24)
  const [histIntervalMins, setHistIntervalMins] = useState(15)

  // Auto-stream controls
  const [autoStreaming, setAutoStreaming] = useState(false)
  const [autoIntervalSecs, setAutoIntervalSecs] = useState(30)
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isOpen || organizationId) return
    const load = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('devices')
          .select('organization_id')
          .eq('id', deviceId)
          .single()
        if (data) setOrganizationId(data.organization_id)
      } catch (e) {
        console.error('Failed to load device org:', e)
      }
    }
    load()
  }, [isOpen, deviceId, organizationId])

  const setValue = (key: SensorKey, val: number) =>
    setValues((prev) => ({ ...prev, [key]: val }))

  const handlePreset = (preset: 'normal' | 'warm' | 'alarm') => {
    if (preset === 'normal') {
      setValues({ temperature: 22, humidity: 45, co2: 600, battery: 85 })
      setStatus('online')
    } else if (preset === 'warm') {
      setValues({ temperature: 35, humidity: 72, co2: 1400, battery: 55 })
      setStatus('warning')
    } else {
      setValues({ temperature: 45, humidity: 88, co2: 2200, battery: 8 })
      setStatus('error')
    }
  }

  const isOutOfRange = (key: SensorKey) => {
    const s = SENSORS[key]
    return values[key] < s.normalMin || values[key] > s.normalMax
  }

  const anyOutOfRange = SENSOR_KEYS.some(isOutOfRange)

  const handleSendData = async () => {
    if (!organizationId) {
      toast.error('Organization not loaded yet — please try again.')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()

      // Build flat JSONB payload — matches MQTT flat format, normalizer will expand it
      const payload: Record<string, number> =
        sendTarget === 'all'
          ? (Object.fromEntries(
              SENSOR_KEYS.map((k) => [k, values[k]])
            ) as Record<string, number>)
          : { [sendTarget]: values[sendTarget as SensorKey] }

      const { error: telError } = await supabase
        .from('device_telemetry_history')
        .insert({
          device_id: deviceId,
          organization_id: organizationId,
          telemetry: payload,
          device_timestamp: new Date().toISOString(),
          received_at: new Date().toISOString(),
        })
      if (telError) throw telError

      const { error: devError } = await supabase
        .from('devices')
        .update({
          status,
          battery_level: batteryDevice,
          signal_strength: signalStrength,
          last_seen: new Date().toISOString(),
        })
        .eq('id', deviceId)
      if (devError) throw devError

      const alerting =
        anyOutOfRange &&
        (sendTarget === 'all' || isOutOfRange(sendTarget as SensorKey))
      const label =
        sendTarget === 'all'
          ? 'All sensors'
          : SENSORS[sendTarget as SensorKey].label

      toast.success(
        alerting
          ? `⚠️ Data sent — value(s) outside normal range`
          : `✅ Test data sent`,
        {
          description: `${label}: ${JSON.stringify(payload)}`,
        }
      )
      onDataSent?.()
    } catch (err) {
      console.error('Failed to send test data:', err)
      toast.error('Failed to send test data')
    } finally {
      setLoading(false)
    }
  }

  // ── Drift helper: walk a value randomly within bounds ───────────────────────
  function driftValue(
    current: number,
    min: number,
    max: number,
    step: number
  ): number {
    const delta = (Math.random() - 0.5) * step * 4
    return Math.min(max, Math.max(min, parseFloat((current + delta).toFixed(2))))
  }

  // ── Generate a bulk batch of fake historical telemetry rows ─────────────────
  const handleGenerateHistory = async () => {
    if (!organizationId) {
      toast.error('Organization not loaded yet — please try again.')
      return
    }
    setGenerating(true)
    try {
      const supabase = createClient()
      const nowMs = Date.now()
      const spanMs = histSpanHours * 60 * 60 * 1000
      const stepMs = histIntervalMins * 60 * 1000
      const totalPoints = Math.floor(spanMs / stepMs)

      // Seed values from current slider positions
      let t = values.temperature
      let h = values.humidity
      let c = values.co2
      let b = values.battery

      const rows: {
        device_id: string
        organization_id: string
        telemetry: Record<string, number>
        device_timestamp: string
        received_at: string
      }[] = []

      for (let i = totalPoints; i >= 0; i--) {
        const ts = new Date(nowMs - i * stepMs).toISOString()
        // Realistic drift each step
        t = driftValue(t, SENSORS.temperature.min, SENSORS.temperature.max, SENSORS.temperature.step)
        h = driftValue(h, SENSORS.humidity.min, SENSORS.humidity.max, SENSORS.humidity.step)
        c = driftValue(c, SENSORS.co2.min, SENSORS.co2.max, SENSORS.co2.step)
        b = Math.max(0, Math.min(100, b - Math.random() * 0.2)) // slow drain
        rows.push({
          device_id: deviceId,
          organization_id: organizationId,
          telemetry: {
            temperature: parseFloat(t.toFixed(1)),
            humidity: parseFloat(h.toFixed(0)),
            co2: parseFloat(c.toFixed(0)),
            battery: parseFloat(b.toFixed(0)),
          },
          device_timestamp: ts,
          received_at: ts,
        })
      }

      // Insert in batches of 100 to avoid payload limits
      const BATCH = 100
      for (let s = 0; s < rows.length; s += BATCH) {
        const { error } = await supabase
          .from('device_telemetry_history')
          .insert(rows.slice(s, s + BATCH))
        if (error) throw error
      }

      // Update device status/battery to reflect latest generated point
      if (rows.length > 0) {
        const lastRow = rows[rows.length - 1]
        await supabase
          .from('devices')
          .update({
            status: 'online',
            battery_level: lastRow.telemetry.battery,
            last_seen: lastRow.received_at,
          })
          .eq('id', deviceId)
      }

      toast.success(`✅ Generated ${rows.length} data points`, {
        description: `${histSpanHours}h history · every ${histIntervalMins} min`,
      })
      onDataSent?.()
    } catch (err) {
      console.error('Failed to generate history:', err)
      toast.error('Failed to generate history')
    } finally {
      setGenerating(false)
    }
  }

  // ── Auto-stream: send a live reading every N seconds ────────────────────────
  const sendOneLiveReading = async () => {
    if (!organizationId) return
    try {
      const supabase = createClient()
      const payload: Record<string, number> = Object.fromEntries(
        SENSOR_KEYS.map((k) => [
          k,
          driftValue(values[k], SENSORS[k].min, SENSORS[k].max, SENSORS[k].step),
        ])
      ) as Record<string, number>
      const ts = new Date().toISOString()
      await supabase.from('device_telemetry_history').insert({
        device_id: deviceId,
        organization_id: organizationId,
        telemetry: payload,
        device_timestamp: ts,
        received_at: ts,
      })
      await supabase
        .from('devices')
        .update({ status: 'online', last_seen: ts })
        .eq('id', deviceId)
      onDataSent?.()
    } catch (err) {
      console.error('Auto-stream error:', err)
    }
  }

  const handleToggleAutoStream = () => {
    if (autoStreaming) {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
      setAutoStreaming(false)
      toast.info('Auto-stream stopped')
    } else {
      setAutoStreaming(true)
      void sendOneLiveReading()
      autoTimerRef.current = setInterval(
        () => void sendOneLiveReading(),
        autoIntervalSecs * 1000
      )
      toast.success(`▶ Auto-streaming every ${autoIntervalSecs}s`)
    }
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current)
    }
  }, [])

  const sensorsToShow: SensorKey[] =
    sendTarget === 'all' ? SENSOR_KEYS : [sendTarget as SensorKey]

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
                  Modular
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
            {/* Quick Presets */}
            <div className="space-y-2">
              <Label className="text-xs">Quick Scenarios</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => handlePreset('normal')}
                >
                  ✅ Normal
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs text-yellow-600 hover:text-yellow-600"
                  onClick={() => handlePreset('warm')}
                >
                  🌡️ Warm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs text-red-600 hover:text-red-600"
                  onClick={() => handlePreset('alarm')}
                >
                  🚨 Alarm
                </Button>
              </div>
            </div>

            {/* Send Target */}
            <div className="space-y-2">
              <Label className="text-xs">Send Target</Label>
              <Select
                value={sendTarget}
                onValueChange={(v) => setSendTarget(v as SendTarget)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">📡 All Sensors</SelectItem>
                  {SENSOR_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {SENSORS[k].label} ({SENSORS[k].unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sensor Sliders */}
            {sensorsToShow.map((key) => {
              const s = SENSORS[key]
              const { Icon } = s
              const outOfRange = isOutOfRange(key)
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className={`flex items-center gap-1.5 text-xs`}>
                      <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                      {s.label}
                      <span className="text-muted-foreground">({s.unit})</span>
                    </Label>
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs ${outOfRange ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-600' : ''}`}
                    >
                      {values[key].toFixed(s.decimals)}
                    </Badge>
                  </div>
                  <Slider
                    value={[values[key]]}
                    onValueChange={([v]) => v !== undefined && setValue(key, v)}
                    min={s.min}
                    max={s.max}
                    step={s.step}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>
                      {s.min}
                      {s.unit}
                    </span>
                    <span className="text-green-600">
                      Normal: {s.normalMin}–{s.normalMax}
                    </span>
                    <span>
                      {s.max}
                      {s.unit}
                    </span>
                  </div>
                </div>
              )
            })}

            {/* Device Status */}
            <div className="space-y-2">
              <Label className="text-xs">Device Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as typeof status)}
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

            {/* Battery + Signal */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Device Battery</Label>
                  <Badge variant="outline" className="font-mono text-xs">
                    {batteryDevice}%
                  </Badge>
                </div>
                <Slider
                  value={[batteryDevice]}
                  onValueChange={([v]) =>
                    v !== undefined && setBatteryDevice(v)
                  }
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Signal (dBm)</Label>
                  <Badge variant="outline" className="font-mono text-xs">
                    {signalStrength}
                  </Badge>
                </div>
                <Slider
                  value={[signalStrength]}
                  onValueChange={([v]) =>
                    v !== undefined && setSignalStrength(v)
                  }
                  min={-120}
                  max={-30}
                  step={5}
                />
              </div>
            </div>

            {/* Out-of-range warning */}
            {anyOutOfRange && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-500" />
                <p className="text-xs text-muted-foreground">
                  One or more values are outside the normal range and will
                  trigger an alert.
                </p>
              </div>
            )}

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
                  Send{' '}
                  {sendTarget === 'all'
                    ? 'All Sensors'
                    : SENSORS[sendTarget as SensorKey].label}
                </>
              )}
            </Button>

            {/* ── Generate Historical Data ─────────────────────────────── */}
            <div className="mt-4 rounded-md border border-dashed border-muted p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <BarChart2 className="h-4 w-4 text-muted-foreground" />
                Generate Historical Data
              </div>

              {/* Time span */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Span</span>
                  <span>{histSpanHours}h</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={168}
                  step={1}
                  value={histSpanHours}
                  onChange={(e) => setHistSpanHours(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              {/* Interval */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Interval</span>
                  <span>{histIntervalMins} min</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={60}
                  step={1}
                  value={histIntervalMins}
                  onChange={(e) => setHistIntervalMins(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="text-xs text-muted-foreground text-center">
                ≈{' '}
                {Math.floor((histSpanHours * 60) / histIntervalMins)} data
                points
              </div>

              <Button
                onClick={handleGenerateHistory}
                disabled={generating}
                variant="outline"
                className="w-full"
                size="sm"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <BarChart2 className="mr-2 h-4 w-4" />
                    Generate{' '}
                    {Math.floor((histSpanHours * 60) / histIntervalMins)}{' '}
                    Points
                  </>
                )}
              </Button>
            </div>

            {/* ── Auto-Stream ──────────────────────────────────────────── */}
            <div className="mt-2 rounded-md border border-dashed border-muted p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {autoStreaming ? (
                  <Play className="h-4 w-4 text-green-500 animate-pulse" />
                ) : (
                  <Play className="h-4 w-4 text-muted-foreground" />
                )}
                Live Auto-Stream
                {autoStreaming && (
                  <span className="ml-auto text-xs font-normal text-green-600">
                    ● active — every {autoIntervalSecs}s
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Interval</span>
                  <span>{autoIntervalSecs}s</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={300}
                  step={5}
                  value={autoIntervalSecs}
                  disabled={autoStreaming}
                  onChange={(e) => setAutoIntervalSecs(Number(e.target.value))}
                  className="w-full accent-primary disabled:opacity-50"
                />
              </div>

              <Button
                onClick={handleToggleAutoStream}
                variant={autoStreaming ? 'destructive' : 'outline'}
                className="w-full"
                size="sm"
              >
                {autoStreaming ? (
                  <>
                    <Square className="mr-2 h-4 w-4" />
                    Stop Streaming
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Streaming
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
