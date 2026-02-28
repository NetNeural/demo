// ===========================================================================
// Device Utility Functions
// Shared helpers for device type detection and telemetry normalization
// ===========================================================================

import type { Device, TelemetryReading } from '@/types/sensor-details'

/**
 * Determine if a device is a gateway/cellular type (not an environmental sensor).
 * Gateways don't produce temperature/humidity/pressure data — they relay data
 * from child sensors and report connectivity metrics instead.
 */
export function isGatewayDevice(device: Device): boolean {
  const type = (device.device_type || '').toLowerCase()
  const name = (device.name || '').toLowerCase()
  const model = (device.model || '').toLowerCase()

  if (
    type.includes('gateway') ||
    type.includes('cellular') ||
    type.includes('nrf9151') ||
    type.includes('nrf9160') ||
    type.includes('router') ||
    type.includes('hub') ||
    type === 'netneural-gateway' ||
    type === 'cellular-gateway' ||
    type === 'nrf9151_cellular'
  ) return true

  if (name.includes('gateway') || name.includes('cellular')) return true
  if (model.includes('gateway') || model.includes('nrf9151') || model.includes('nrf9160')) return true

  if (device.metadata) {
    if (
      device.metadata.is_gateway === true ||
      device.metadata.isGateway === true ||
      (typeof device.metadata.device_category === 'string' &&
        (device.metadata.device_category as string).toLowerCase().includes('gateway'))
    ) return true
  }

  return false
}

export function isTestDevice(device: Device): boolean {
  if (device.is_test_device === true) return true

  const type = (device.device_type || '').toLowerCase()
  const name = (device.name || '').toLowerCase()

  if (type.includes('test') || type.includes('modular test sensor')) return true
  if (name.includes('test sensor') || name.includes('modular test sensor')) return true

  if (device.metadata) {
    if (device.metadata.is_test_device === true || device.metadata.isTestDevice === true) return true
  }

  return false
}

// Config for flat JSONB telemetry fields from MQTT subscriber
const FLAT_SENSOR_CONFIG: Record<string, { label: string; unit: string }> = {
  temperature: { label: 'Temperature', unit: '°C' },
  humidity: { label: 'Humidity', unit: '%' },
  pressure: { label: 'Pressure', unit: 'hPa' },
  co2: { label: 'CO₂', unit: 'ppm' },
  battery: { label: 'Battery', unit: '%' },
  RSSI: { label: 'RSSI', unit: 'dBm' },
  SNR: { label: 'SNR', unit: 'dB' },
  BatteryIdle: { label: 'Battery (Idle)', unit: 'mV' },
  BatteryTx: { label: 'Battery (TX)', unit: 'mV' },
  GwRssi: { label: 'GW RSSI', unit: 'dBm' },
  GwSnr: { label: 'GW SNR', unit: 'dB' },
  voltage: { label: 'Voltage', unit: 'V' },
  current: { label: 'Current', unit: 'A' },
  power: { label: 'Power', unit: 'W' },
}

/**
 * Expand flat JSONB telemetry records (e.g. { temperature: 22.7, BatteryIdle: 3593 })
 * into individual per-sensor rows ({ sensor: 'Temperature', value: 22.7, unit: '°C' }).
 */
export function normalizeTelemetryReadings(
  readings: TelemetryReading[]
): TelemetryReading[] {
  const result: TelemetryReading[] = []
  for (const row of readings) {
    const t = row.telemetry
    if (!t) { result.push(row); continue }
    // Golioth typed format: numeric type + numeric value — pass through
    if (typeof t.type === 'number' && typeof t.value === 'number') { result.push(row); continue }
    // Already normalized (sensor string + value number) — pass through
    if (typeof t.sensor === 'string' && typeof t.value === 'number') { result.push(row); continue }
    // Flat JSONB — expand each numeric field into its own row
    const entries = Object.entries(t).filter(([, v]) => typeof v === 'number')
    if (entries.length === 0) { result.push(row); continue }
    for (const [key, val] of entries) {
      const config = FLAT_SENSOR_CONFIG[key]
      result.push({
        ...row,
        telemetry: { sensor: config?.label ?? key, value: val as number, unit: config?.unit ?? '' },
      })
    }
  }
  return result
}

/**
 * Map raw device data from edge function response to a typed Device object.
 */
export function mapDeviceData(raw: Record<string, unknown>): Device {
  const deviceData = (raw as { device?: Record<string, unknown> }).device || raw
  const d = deviceData as Record<string, unknown>
  const metadata = (d.metadata as Record<string, unknown>) || {}

  const isTest =
    d.is_test_device === true ||
    metadata.is_test_device === true ||
    metadata.isTestDevice === true ||
    ((d.device_type as string) || '').toLowerCase().includes('test') ||
    ((d.name as string) || '').toLowerCase().includes('test')

  return {
    id: (d.id as string) || '',
    name: (d.name as string) || '',
    device_type: (d.device_type as string) || (d.type as string) || '',
    device_type_id: (d.device_type_id as string) || null,
    is_test_device: isTest,
    model: (d.model as string) || undefined,
    serial_number: (d.serial_number as string) || undefined,
    external_device_id: (d.external_device_id as string) || (d.externalDeviceId as string) || null,
    status: ((d.status as string) || 'offline') as Device['status'],
    location: (d.location as string) || undefined,
    location_id: (d.location_id as string) || undefined,
    department_id: (d.department_id as string) || undefined,
    firmware_version: (d.firmware_version as string) || undefined,
    battery_level: d.battery_level != null ? (d.battery_level as number) : (d.batteryLevel as number | undefined),
    signal_strength: d.signal_strength != null ? (d.signal_strength as number) : undefined,
    last_seen: (d.last_seen as string) || (d.lastSeen as string) || undefined,
    last_seen_online: (d.last_seen_online as string) || undefined,
    last_seen_offline: (d.last_seen_offline as string) || undefined,
    metadata,
    organization_id: (d.organization_id as string) || '',
    description: (d.description as string) || undefined,
    hardware_ids: (d.hardware_ids as string[]) || [],
    cohort_id: (d.cohort_id as string) || undefined,
    parent_device_id: (d.parent_device_id as string) || null,
    is_gateway: (d.is_gateway as boolean) ?? (metadata.is_gateway as boolean) ?? false,
    integration_id: (d.integration_id as string) || null,
    is_externally_managed: (d.is_externally_managed as boolean) ?? (d.isExternallyManaged as boolean) ?? false,
    integration_name: (d.integration_name as string) || (d.integrationName as string) || null,
    integration_type: (d.integration_type as string) || (d.integrationType as string) || null,
    created_at: (d.created_at as string) || undefined,
    updated_at: (d.updated_at as string) || undefined,
  }
}
