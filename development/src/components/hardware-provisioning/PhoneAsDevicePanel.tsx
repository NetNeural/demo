/**
 * Phone as Device Setup Panel
 *
 * Guides users through setting up iOS or Android phones as IoT sensor devices.
 * Phones have multiple built-in sensors (GPS, accelerometer, gyroscope,
 * magnetometer, barometer, ambient light, proximity) and can send data
 * via MQTT or CoAP — great for test devices or mobile monitoring.
 *
 * @see Issue #528
 */
'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Smartphone,
  Wifi,
  Radio,
  MapPin,
  Activity,
  Compass,
  Sun,
  Gauge,
  Thermometer,
  Mic,
  Copy,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/** Phone sensor capabilities */
const PHONE_SENSORS = [
  {
    name: 'GPS / Location',
    icon: MapPin,
    description: 'Latitude, longitude, altitude, speed, heading',
    telemetryKeys: 'latitude, longitude, altitude, speed, heading',
    ios: true,
    android: true,
  },
  {
    name: 'Accelerometer',
    icon: Activity,
    description: '3-axis acceleration (m/s²) — motion, vibration, tilt',
    telemetryKeys: 'accel_x, accel_y, accel_z',
    ios: true,
    android: true,
  },
  {
    name: 'Gyroscope',
    icon: Compass,
    description: '3-axis rotation rate (°/s) — orientation changes',
    telemetryKeys: 'gyro_x, gyro_y, gyro_z',
    ios: true,
    android: true,
  },
  {
    name: 'Magnetometer',
    icon: Compass,
    description: 'Magnetic field strength (µT) — compass heading',
    telemetryKeys: 'mag_x, mag_y, mag_z',
    ios: true,
    android: true,
  },
  {
    name: 'Barometer',
    icon: Gauge,
    description: 'Atmospheric pressure (hPa) — altitude estimation',
    telemetryKeys: 'pressure',
    ios: true,
    android: true,
  },
  {
    name: 'Ambient Light',
    icon: Sun,
    description: 'Light level (lux) — environment brightness',
    telemetryKeys: 'illuminance',
    ios: true,
    android: true,
  },
  {
    name: 'Proximity',
    icon: Smartphone,
    description: 'Near/far detection — object proximity',
    telemetryKeys: 'proximity',
    ios: true,
    android: true,
  },
  {
    name: 'Battery',
    icon: Activity,
    description: 'Battery level (%) and charging state',
    telemetryKeys: 'battery_level, battery_charging',
    ios: true,
    android: true,
  },
  {
    name: 'Temperature',
    icon: Thermometer,
    description: 'Ambient temperature sensor (where available)',
    telemetryKeys: 'ambient_temperature',
    ios: false,
    android: true,
  },
  {
    name: 'Microphone Level',
    icon: Mic,
    description: 'Sound level (dBA) — noise monitoring',
    telemetryKeys: 'sound_level',
    ios: true,
    android: true,
  },
]

/** Copyable code block */
function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative">
      {label && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      )}
      <div className="relative rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
        <pre className="overflow-x-auto whitespace-pre-wrap break-all">
          {code}
        </pre>
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1 h-7 w-7 p-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={handleCopy}
        >
          {copied ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  )
}

/** Step component */
function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
        {number}
      </div>
      <div className="flex-1 space-y-2">
        <h4 className="font-semibold">{title}</h4>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}

export function PhoneAsDevicePanel() {
  const samplePayload = JSON.stringify(
    {
      latitude: 39.0842,
      longitude: -84.5105,
      altitude: 267.3,
      accel_x: 0.02,
      accel_y: 0.01,
      accel_z: 9.81,
      gyro_x: 0.0,
      gyro_y: 0.0,
      gyro_z: 0.0,
      pressure: 1013.25,
      illuminance: 342,
      battery_level: 87,
      sound_level: 42.3,
    },
    null,
    2
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Phone as IoT Device
          </CardTitle>
          <CardDescription>
            Use your smartphone as a multi-sensor IoT device. Phones include GPS,
            accelerometer, gyroscope, magnetometer, barometer, light sensor, and
            more — perfect for testing, mobile monitoring, or field work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Available Sensors Grid */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Available Phone Sensors</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PHONE_SENSORS.map((sensor) => (
                <div
                  key={sensor.name}
                  className="flex items-start gap-2 rounded-lg border p-2.5"
                >
                  <sensor.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">{sensor.name}</p>
                      {!sensor.ios && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          Android only
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sensor.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Protocol & Telemetry Format */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            Supported Protocols
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-blue-500" />
                <h4 className="font-semibold">MQTT</h4>
                <Badge className="text-[10px]">Recommended</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Lightweight publish/subscribe messaging. Best app support, works
                over Wi-Fi and cellular. Most phone sensor apps support MQTT natively.
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-green-500" />
                <h4 className="font-semibold">CoAP</h4>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Constrained Application Protocol — UDP-based, lower overhead.
                Good for battery-constrained use cases. Fewer app options but
                very efficient.
              </p>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">MQTT Topic Format</h4>
            <CodeBlock code={`devices/{your-device-id}/telemetry`} />
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold">
              Telemetry JSON Payload Example
            </h4>
            <CodeBlock code={samplePayload} />
          </div>
        </CardContent>
      </Card>

      {/* Platform-specific Setup — iOS vs Android */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Instructions</CardTitle>
          <CardDescription>
            Choose your phone platform for step-by-step instructions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ios">
            <TabsList className="mb-4">
              <TabsTrigger value="ios" className="flex items-center gap-1.5">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                iOS (iPhone / iPad)
              </TabsTrigger>
              <TabsTrigger value="android" className="flex items-center gap-1.5">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.27-.86-.31-.16-.69-.04-.86.27l-1.87 3.24A11.43 11.43 0 0012 8c-1.59 0-3.09.33-4.44.95L5.69 5.71c-.16-.31-.54-.43-.86-.27-.31.16-.43.55-.27.86l1.84 3.18C3.85 10.96 2 13.3 2 16h20c0-2.7-1.85-5.04-4.4-6.52zM7 13.5a1 1 0 110-2 1 1 0 010 2zm10 0a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                Android
              </TabsTrigger>
            </TabsList>

            {/* iOS Setup */}
            <TabsContent value="ios" className="space-y-6">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Recommended iOS Apps
                </h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      SensorLog (MQTT)
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Streams all phone sensors (GPS, accelerometer, gyroscope,
                      magnetometer, barometer) via MQTT. Configurable publish
                      interval and topic. Free with in-app upgrade.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      MQTT Explorer / MQTTool
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      General-purpose MQTT clients. Manual publish of sensor data.
                      Good for testing connectivity before using a sensor-streaming app.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      phyphox
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Physics experiment app by RWTH Aachen. Accesses all
                      phone sensors with data export. Can forward data via
                      HTTP/MQTT with custom scripts. Free and open source.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <Step number={1} title="Register Your Phone as a Device">
                  <p>
                    Go to the <strong>Scan &amp; Add</strong> tab or create a device
                    manually. Use device class <strong>Smartphone / Mobile</strong>.
                    Give it a name like &quot;iPhone - Field Test 1&quot;.
                  </p>
                  <p className="mt-1">
                    Note the <strong>Device ID</strong> after creation — you&apos;ll need
                    it for the MQTT topic.
                  </p>
                </Step>

                <Step number={2} title="Set Up an MQTT Integration">
                  <p>
                    Go to the <strong>Integrations</strong> tab and add a new MQTT
                    integration. You can use your own broker or a cloud broker
                    (HiveMQ Cloud, CloudMQTT, Mosquitto).
                  </p>
                  <CodeBlock
                    label="Example: HiveMQ Cloud (free tier)"
                    code={`Broker: your-cluster.hivemq.cloud\nPort: 8883 (TLS)\nUsername: your-username\nPassword: your-password`}
                  />
                </Step>

                <Step number={3} title="Install & Configure SensorLog">
                  <ol className="ml-4 list-decimal space-y-2 text-sm">
                    <li>
                      Download <strong>SensorLog</strong> from the App Store
                    </li>
                    <li>
                      Open Settings → MQTT and enter your broker details
                    </li>
                    <li>
                      Set the publish topic to:
                      <CodeBlock code="devices/{your-device-id}/telemetry" />
                    </li>
                    <li>
                      Set the publish interval (e.g., every 5 seconds for testing,
                      every 60 seconds for monitoring)
                    </li>
                    <li>
                      Enable the sensors you want to stream (GPS, accelerometer,
                      gyroscope, barometer, etc.)
                    </li>
                    <li>
                      Tap <strong>Start Logging</strong> — data will flow to your
                      Sentinel dashboard
                    </li>
                  </ol>
                </Step>

                <Step number={4} title="Map the Device to Your MQTT Integration">
                  <p>
                    In the <strong>Devices</strong> tab, find your phone device and
                    click <strong>Edit</strong>. Under &quot;External Integration&quot;,
                    map it to your MQTT integration with the device ID matching the
                    topic.
                  </p>
                </Step>

                <Step number={5} title="Verify Data Flow">
                  <p>
                    Open the device detail page. Switch to the{' '}
                    <strong>Telemetry</strong> tab to see real-time sensor readings
                    from your iPhone. GPS coordinates will appear on the map.
                  </p>
                </Step>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                  📱 iOS Note
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  iOS restricts background sensor access. For continuous monitoring,
                  keep the app in the foreground or enable &quot;Background App
                  Refresh&quot; in Settings → General. GPS background tracking
                  requires &quot;Always&quot; location permission. Battery usage
                  will increase during active streaming.
                </p>
              </div>
            </TabsContent>

            {/* Android Setup */}
            <TabsContent value="android" className="space-y-6">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  Recommended Android Apps
                </h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Sensor Logger (MQTT)
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Streams all phone sensors via MQTT with configurable intervals
                      and topics. Supports background operation on Android. Free.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      IoT MQTT Panel
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Full MQTT dashboard for Android. Publish sensor data, create
                      custom dashboards, and monitor topics. Excellent for testing
                      and manual data feeds.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      phyphox
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Physics experiment app by RWTH Aachen. Accesses all phone
                      sensors with data export. Supports HTTP/MQTT data forwarding.
                      Free and open source.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Termux + mosquitto_pub (Advanced)
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Linux terminal for Android. Install mosquitto-clients and
                      write shell scripts to read sensors via the Termux:API plugin
                      and publish via MQTT. Maximum flexibility.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <Step number={1} title="Register Your Phone as a Device">
                  <p>
                    Go to the <strong>Scan &amp; Add</strong> tab or create a device
                    manually. Use device class <strong>Smartphone / Mobile</strong>.
                    Give it a name like &quot;Pixel - Warehouse Monitor&quot;.
                  </p>
                  <p className="mt-1">
                    Note the <strong>Device ID</strong> after creation — you&apos;ll need
                    it for the MQTT topic.
                  </p>
                </Step>

                <Step number={2} title="Set Up an MQTT Integration">
                  <p>
                    Go to the <strong>Integrations</strong> tab and add a new MQTT
                    integration. You can use your own broker or a cloud broker
                    (HiveMQ Cloud, CloudMQTT, Mosquitto).
                  </p>
                  <CodeBlock
                    label="Example: HiveMQ Cloud (free tier)"
                    code={`Broker: your-cluster.hivemq.cloud\nPort: 8883 (TLS)\nUsername: your-username\nPassword: your-password`}
                  />
                </Step>

                <Step number={3} title="Install & Configure Sensor Logger">
                  <ol className="ml-4 list-decimal space-y-2 text-sm">
                    <li>
                      Download <strong>Sensor Logger</strong> from Google Play
                    </li>
                    <li>
                      Open Settings → MQTT Connection and enter your broker details
                    </li>
                    <li>
                      Set the publish topic to:
                      <CodeBlock code="devices/{your-device-id}/telemetry" />
                    </li>
                    <li>
                      Set the publish interval (e.g., every 5 seconds for testing,
                      every 60 seconds for monitoring)
                    </li>
                    <li>
                      Enable sensors: GPS, accelerometer, gyroscope, magnetometer,
                      barometer, ambient temperature, light, proximity
                    </li>
                    <li>
                      Enable <strong>Background Service</strong> for continuous
                      monitoring (Android allows persistent background services)
                    </li>
                    <li>
                      Tap <strong>Start</strong> — data will flow to your Sentinel
                      dashboard
                    </li>
                  </ol>
                </Step>

                <Step number={3.5} title="Alternative: Termux CLI (Advanced)">
                  <p className="mb-2">
                    For advanced users — use Termux to script sensor data collection:
                  </p>
                  <CodeBlock
                    label="Install dependencies"
                    code={`pkg install mosquitto termux-api`}
                  />
                  <div className="mt-2" />
                  <CodeBlock
                    label="Publish GPS location via MQTT"
                    code={`# Get GPS location and publish via MQTT
LOC=$(termux-location -p gps)
LAT=$(echo $LOC | jq '.latitude')
LON=$(echo $LOC | jq '.longitude')
ALT=$(echo $LOC | jq '.altitude')

mosquitto_pub -h your-broker.hivemq.cloud \\
  -p 8883 --capath /etc/ssl/certs \\
  -u "your-user" -P "your-pass" \\
  -t "devices/{device-id}/telemetry" \\
  -m "{\\"latitude\\":$LAT,\\"longitude\\":$LON,\\"altitude\\":$ALT}"`}
                  />
                </Step>

                <Step number={4} title="Map the Device to Your MQTT Integration">
                  <p>
                    In the <strong>Devices</strong> tab, find your phone device and
                    click <strong>Edit</strong>. Under &quot;External Integration&quot;,
                    map it to your MQTT integration with the device ID matching the
                    topic.
                  </p>
                </Step>

                <Step number={5} title="Verify Data Flow">
                  <p>
                    Open the device detail page. Switch to the{' '}
                    <strong>Telemetry</strong> tab to see real-time sensor readings
                    from your Android device. GPS coordinates will appear on the map.
                  </p>
                </Step>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
                <p className="text-xs font-medium text-green-800 dark:text-green-200">
                  🤖 Android Advantage
                </p>
                <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                  Android allows persistent background services and has fewer sensor
                  access restrictions than iOS. You can run sensor streaming
                  continuously, access the ambient temperature sensor (on supported
                  devices), and use Termux for fully custom data pipelines.
                  Battery optimization settings may need to be disabled for the
                  sensor app (&quot;Don&apos;t optimize&quot; in Battery settings).
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Use Cases */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Use Cases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">🧪 Test Device</p>
              <p className="text-xs text-muted-foreground">
                Validate your IoT pipeline (MQTT → Sentinel → alerts) without
                needing physical hardware. Use your phone to simulate sensor
                readings.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">🚚 Fleet / Field Monitoring</p>
              <p className="text-xs text-muted-foreground">
                Mount phones in vehicles or give to field workers for GPS tracking,
                accelerometer-based driving analysis, and environmental monitoring.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">🏗️ Construction Site Monitoring</p>
              <p className="text-xs text-muted-foreground">
                Temporary noise (dBA), vibration (accelerometer), and environmental
                monitoring using phones placed at key locations.
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">📋 Demo &amp; Sales</p>
              <p className="text-xs text-muted-foreground">
                Show prospects a live demo of Sentinel with real sensor data from
                your phone — no hardware needed.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
