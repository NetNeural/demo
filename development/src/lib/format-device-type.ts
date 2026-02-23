/**
 * Human-readable display labels for raw device_type strings stored in the DB.
 * Covers legacy values like "cellular-gateway", "iot-device" and any new
 * canonical values set by the app (e.g. "gateway").
 */
const DEVICE_TYPE_LABELS: Record<string, string> = {
  // Gateway variants
  gateway: 'Gateway',
  'cellular-gateway': 'Gateway',
  cellular_gateway: 'Gateway',
  'cellular gateway': 'Gateway',
  'netneural-gateway': 'Gateway',
  netneural_gateway: 'Gateway',
  hub: 'Gateway',
  // IoT device / sensor hub variants
  'iot-device': 'Gateway',
  iot_device: 'Gateway',
  'iot device': 'Gateway',
}

/**
 * Format a raw device_type string for display.
 * Known gateway / hub values are mapped to "Gateway".
 * Unknown values are title-cased with dashes/underscores replaced by spaces.
 */
export function formatDeviceType(rawType: string | null | undefined): string {
  if (!rawType) return 'Unknown'
  const lower = rawType.toLowerCase().trim()
  const byLower = DEVICE_TYPE_LABELS[lower]
  if (byLower) return byLower
  const byRaw = DEVICE_TYPE_LABELS[rawType.trim()]
  if (byRaw) return byRaw
  // Generic fallback: replace separators and title-case
  return rawType.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
