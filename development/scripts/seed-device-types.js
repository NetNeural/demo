#!/usr/bin/env node
/**
 * Seed sample device types for testing
 * Seeds common IoT sensor types for the NetNeural organization
 */

const STAGING_URL = 'https://atgbmxicqikmapfqouco.supabase.co'
const STAGING_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const NETNEURAL_ORG_ID = '00000000-0000-0000-0000-000000000001'

const sampleDeviceTypes = [
  {
    name: 'Temperature Sensor',
    description: 'Monitors ambient temperature with Celsius readings',
    device_class: 'temperature',
    unit: '°C',
    lower_normal: 18.0,
    upper_normal: 26.0,
    lower_alert: 10.0,
    upper_alert: 35.0,
    precision_digits: 1,
    icon: 'thermometer',
  },
  {
    name: 'Humidity Sensor',
    description: 'Tracks relative humidity percentage',
    device_class: 'humidity',
    unit: '%',
    lower_normal: 30.0,
    upper_normal: 60.0,
    lower_alert: 20.0,
    upper_alert: 80.0,
    precision_digits: 1,
    icon: 'droplet',
  },
  {
    name: 'Pressure Sensor',
    description: 'Atmospheric pressure monitoring',
    device_class: 'pressure',
    unit: 'hPa',
    lower_normal: 980.0,
    upper_normal: 1030.0,
    lower_alert: 950.0,
    upper_alert: 1050.0,
    precision_digits: 1,
    icon: 'gauge',
  },
  {
    name: 'Light Sensor',
    description: 'Ambient light intensity measurement',
    device_class: 'light',
    unit: 'lux',
    lower_normal: 50.0,
    upper_normal: 1000.0,
    lower_alert: 0.0,
    upper_alert: 10000.0,
    precision_digits: 0,
    icon: 'sun',
  },
  {
    name: 'CO2 Sensor',
    description: 'Indoor air quality - carbon dioxide concentration',
    device_class: 'environmental',
    unit: 'ppm',
    lower_normal: 400.0,
    upper_normal: 1000.0,
    lower_alert: null,
    upper_alert: 2000.0,
    precision_digits: 0,
    icon: 'wind',
  },
  {
    name: 'Vibration Sensor',
    description: 'Detects vibration and shock levels',
    device_class: 'vibration',
    unit: 'g',
    lower_normal: 0.0,
    upper_normal: 0.5,
    lower_alert: null,
    upper_alert: 2.0,
    precision_digits: 2,
    icon: 'activity',
  },
  {
    name: 'Battery Voltage',
    description: 'Battery level monitoring',
    device_class: 'power',
    unit: 'V',
    lower_normal: 3.3,
    upper_normal: 4.2,
    lower_alert: 3.0,
    upper_alert: 4.5,
    precision_digits: 2,
    icon: 'battery',
  },
  {
    name: 'Water Level',
    description: 'Liquid level monitoring',
    device_class: 'level',
    unit: 'cm',
    lower_normal: 10.0,
    upper_normal: 90.0,
    lower_alert: 5.0,
    upper_alert: 95.0,
    precision_digits: 1,
    icon: 'waves',
  },
]

async function seedDeviceTypes() {
  console.log('🌱 Seeding sample device types...\n')

  for (const deviceType of sampleDeviceTypes) {
    const payload = {
      organization_id: NETNEURAL_ORG_ID,
      ...deviceType,
    }

    try {
      const response = await fetch(`${STAGING_URL}/rest/v1/device_types`, {
        method: 'POST',
        headers: {
          apikey: STAGING_SERVICE_KEY,
          Authorization: `Bearer ${STAGING_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error(`❌ Failed to create ${deviceType.name}:`, error)
        continue
      }

      const created = await response.json()
      console.log(`✅ Created: ${deviceType.name} (${deviceType.unit})`)
    } catch (err) {
      console.error(`❌ Error creating ${deviceType.name}:`, err.message)
    }
  }

  console.log('\n✨ Seeding complete!')
}

seedDeviceTypes().catch(console.error)
