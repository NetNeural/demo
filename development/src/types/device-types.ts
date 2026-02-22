/**
 * Device Type Configuration Types
 *
 * Centralized device type definitions with normal ranges,
 * alert thresholds, and measurement metadata.
 *
 * @see Issue #118
 */

/** Standard device measurement classes with suggested units */
export const DEVICE_CLASSES = [
  {
    value: 'temperature',
    label: 'Temperature',
    suggestedUnits: ['°C', '°F', 'K'],
  },
  { value: 'humidity', label: 'Humidity', suggestedUnits: ['%', '% RH'] },
  {
    value: 'pressure',
    label: 'Pressure',
    suggestedUnits: ['hPa', 'mbar', 'Pa', 'psi', 'atm'],
  },
  {
    value: 'illuminance',
    label: 'Illuminance / Light',
    suggestedUnits: ['lux', 'lm', 'fc'],
  },
  { value: 'voltage', label: 'Voltage', suggestedUnits: ['V', 'mV', 'kV'] },
  { value: 'current', label: 'Current', suggestedUnits: ['A', 'mA', 'µA'] },
  { value: 'power', label: 'Power', suggestedUnits: ['W', 'kW', 'mW'] },
  {
    value: 'air_quality',
    label: 'Air Quality',
    suggestedUnits: ['ppm', 'ppb', 'mg/m³', 'µg/m³'],
  },
  {
    value: 'flow',
    label: 'Flow',
    suggestedUnits: ['L/min', 'gal/min', 'm³/h'],
  },
  { value: 'level', label: 'Level', suggestedUnits: ['%', 'cm', 'm', 'mm'] },
  {
    value: 'speed',
    label: 'Speed',
    suggestedUnits: ['m/s', 'km/h', 'mph', 'knots'],
  },
  { value: 'weight', label: 'Weight', suggestedUnits: ['kg', 'g', 'lb', 'oz'] },
  {
    value: 'distance',
    label: 'Distance',
    suggestedUnits: ['m', 'cm', 'mm', 'km', 'ft', 'in'],
  },
  { value: 'gateway', label: 'Gateway / Hub', suggestedUnits: ['dBm', 'dB', '%'] },
  { value: 'other', label: 'Other', suggestedUnits: [] },
] as const

export type DeviceClassName = (typeof DEVICE_CLASSES)[number]['value']

/** Common unit presets */
export const COMMON_UNITS = [
  '°C',
  '°F',
  '%',
  '% RH',
  'hPa',
  'lux',
  'ppm',
  'mg/m³',
  'V',
  'mV',
  'A',
  'mA',
  'W',
  'kW',
  'm/s',
  'L/min',
  'Pa',
  'K',
  'ppb',
  'µg/m³',
  'cm',
  'm',
  'kg',
  'g',
] as const

/** Device type row from the database */
export interface DeviceType {
  id: string
  organization_id: string
  name: string
  lower_normal: number
  upper_normal: number
  unit: string | null
  description: string | null
  device_class: string | null
  lower_alert: number | null
  upper_alert: number | null
  precision_digits: number | null
  icon: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string | null
  updated_at: string | null
}

/** Payload for creating/updating a device type */
export interface DeviceTypePayload {
  name: string
  lower_normal: number
  upper_normal: number
  unit?: string
  description?: string | null
  device_class?: string | null
  lower_alert?: number | null
  upper_alert?: number | null
  precision_digits?: number
  icon?: string | null
}

/** Form state (all fields as strings for controlled inputs) */
export interface DeviceTypeFormValues {
  name: string
  description: string
  device_class: string
  unit: string
  lower_normal: string
  upper_normal: string
  lower_alert: string
  upper_alert: string
  precision_digits: string
  icon: string
}

/** Default form values */
export const DEFAULT_DEVICE_TYPE_FORM: DeviceTypeFormValues = {
  name: '',
  description: '',
  device_class: '',
  unit: '',
  lower_normal: '',
  upper_normal: '',
  lower_alert: '',
  upper_alert: '',
  precision_digits: '2',
  icon: '',
}
