/**
 * Unit Conversion Utilities
 * 
 * Handles conversion between common measurement units for device types.
 * Supports temperature, pressure, voltage, current, power, and other measurements.
 * 
 * @see Issue #167
 */

type ConversionMap = Record<string, Record<string, (value: number) => number>>

/**
 * Conversion functions between units
 * Each function takes a value in the source unit and returns the converted value
 */
const CONVERSIONS: ConversionMap = {
  // ── Temperature Conversions ──
  '°C': {
    '°F': (c) => (c * 9/5) + 32,
    'K': (c) => c + 273.15,
  },
  '°F': {
    '°C': (f) => (f - 32) * 5/9,
    'K': (f) => ((f - 32) * 5/9) + 273.15,
  },
  'K': {
    '°C': (k) => k - 273.15,
    '°F': (k) => ((k - 273.15) * 9/5) + 32,
  },

  // ── Pressure Conversions ──
  'hPa': {
    'mbar': (hpa) => hpa, // 1 hPa = 1 mbar
    'Pa': (hpa) => hpa * 100,
    'psi': (hpa) => hpa * 0.0145038,
    'atm': (hpa) => hpa / 1013.25,
  },
  'mbar': {
    'hPa': (mbar) => mbar,
    'Pa': (mbar) => mbar * 100,
    'psi': (mbar) => mbar * 0.0145038,
    'atm': (mbar) => mbar / 1013.25,
  },
  'Pa': {
    'hPa': (pa) => pa / 100,
    'mbar': (pa) => pa / 100,
    'psi': (pa) => pa * 0.000145038,
    'atm': (pa) => pa / 101325,
  },
  'psi': {
    'hPa': (psi) => psi / 0.0145038,
    'mbar': (psi) => psi / 0.0145038,
    'Pa': (psi) => psi / 0.000145038,
    'atm': (psi) => psi / 14.696,
  },
  'atm': {
    'hPa': (atm) => atm * 1013.25,
    'mbar': (atm) => atm * 1013.25,
    'Pa': (atm) => atm * 101325,
    'psi': (atm) => atm * 14.696,
  },

  // ── Voltage Conversions ──
  'V': {
    'mV': (v) => v * 1000,
    'kV': (v) => v / 1000,
  },
  'mV': {
    'V': (mv) => mv / 1000,
    'kV': (mv) => mv / 1000000,
  },
  'kV': {
    'V': (kv) => kv * 1000,
    'mV': (kv) => kv * 1000000,
  },

  // ── Current Conversions ──
  'A': {
    'mA': (a) => a * 1000,
    'µA': (a) => a * 1000000,
  },
  'mA': {
    'A': (ma) => ma / 1000,
    'µA': (ma) => ma * 1000,
  },
  'µA': {
    'A': (ua) => ua / 1000000,
    'mA': (ua) => ua / 1000,
  },

  // ── Power Conversions ──
  'W': {
    'kW': (w) => w / 1000,
    'mW': (w) => w * 1000,
  },
  'kW': {
    'W': (kw) => kw * 1000,
    'mW': (kw) => kw * 1000000,
  },
  'mW': {
    'W': (mw) => mw / 1000,
    'kW': (mw) => mw / 1000000,
  },

  // ── Distance Conversions ──
  'm': {
    'cm': (m) => m * 100,
    'mm': (m) => m * 1000,
    'km': (m) => m / 1000,
    'ft': (m) => m * 3.28084,
    'in': (m) => m * 39.3701,
  },
  'cm': {
    'm': (cm) => cm / 100,
    'mm': (cm) => cm * 10,
    'km': (cm) => cm / 100000,
    'ft': (cm) => cm / 30.48,
    'in': (cm) => cm / 2.54,
  },
  'mm': {
    'm': (mm) => mm / 1000,
    'cm': (mm) => mm / 10,
    'km': (mm) => mm / 1000000,
    'ft': (mm) => mm / 304.8,
    'in': (mm) => mm / 25.4,
  },
  'km': {
    'm': (km) => km * 1000,
    'cm': (km) => km * 100000,
    'mm': (km) => km * 1000000,
    'ft': (km) => km * 3280.84,
    'in': (km) => km * 39370.1,
  },
  'ft': {
    'm': (ft) => ft / 3.28084,
    'cm': (ft) => ft * 30.48,
    'mm': (ft) => ft * 304.8,
    'km': (ft) => ft / 3280.84,
    'in': (ft) => ft * 12,
  },
  'in': {
    'm': (in_) => in_ / 39.3701,
    'cm': (in_) => in_ * 2.54,
    'mm': (in_) => in_ * 25.4,
    'km': (in_) => in_ / 39370.1,
    'ft': (in_) => in_ / 12,
  },

  // ── Speed Conversions ──
  'm/s': {
    'km/h': (ms) => ms * 3.6,
    'mph': (ms) => ms * 2.237,
    'knots': (ms) => ms * 1.944,
  },
  'km/h': {
    'm/s': (kmh) => kmh / 3.6,
    'mph': (kmh) => kmh * 0.621371,
    'knots': (kmh) => kmh * 0.539957,
  },
  'mph': {
    'm/s': (mph) => mph / 2.237,
    'km/h': (mph) => mph / 0.621371,
    'knots': (mph) => mph * 0.868976,
  },
  'knots': {
    'm/s': (knots) => knots / 1.944,
    'km/h': (knots) => knots / 0.539957,
    'mph': (knots) => knots / 0.868976,
  },

  // ── Weight Conversions ──
  'kg': {
    'g': (kg) => kg * 1000,
    'lb': (kg) => kg * 2.20462,
    'oz': (kg) => kg * 35.274,
  },
  'g': {
    'kg': (g) => g / 1000,
    'lb': (g) => g / 453.592,
    'oz': (g) => g / 28.3495,
  },
  'lb': {
    'kg': (lb) => lb / 2.20462,
    'g': (lb) => lb * 453.592,
    'oz': (lb) => lb * 16,
  },
  'oz': {
    'kg': (oz) => oz / 35.274,
    'g': (oz) => oz * 28.3495,
    'lb': (oz) => oz / 16,
  },

  // ── Flow Rate Conversions ──
  'L/min': {
    'gal/min': (lpm) => lpm * 0.264172,
    'm³/h': (lpm) => lpm * 0.06,
  },
  'gal/min': {
    'L/min': (gpm) => gpm / 0.264172,
    'm³/h': (gpm) => gpm * 0.227124,
  },
  'm³/h': {
    'L/min': (m3h) => m3h / 0.06,
    'gal/min': (m3h) => m3h / 0.227124,
  },
}

/**
 * Convert a value from one unit to another
 * @param value - The numerical value to convert
 * @param fromUnit - The current unit
 * @param toUnit - The target unit
 * @returns The converted value, or null if conversion is not available
 */
export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string
): number | null {
  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return value
  }

  const conversions = CONVERSIONS[fromUnit]
  if (!conversions) {
    return null
  }

  const converter = conversions[toUnit]
  if (!converter) {
    return null
  }

  return converter(value)
}

/**
 * Check if a unit conversion is available
 */
export function canConvertUnit(fromUnit: string, toUnit: string): boolean {
  if (fromUnit === toUnit) return true
  const conversions = CONVERSIONS[fromUnit]
  if (!conversions) return false
  return toUnit in conversions
}

/**
 * Get available target units for a source unit
 */
export function getAvailableConversions(fromUnit: string): string[] {
  const conversions = CONVERSIONS[fromUnit]
  if (!conversions) return []
  return [fromUnit, ...Object.keys(conversions)]
}

/**
 * Convert all measurement values when changing units
 * Handles null/empty values gracefully
 */
export function convertMeasurementValues(
  lowerNormal: string,
  upperNormal: string,
  lowerAlert: string | null | undefined,
  upperAlert: string | null | undefined,
  fromUnit: string,
  toUnit: string
): {
  lowerNormal: string
  upperNormal: string
  lowerAlert: string
  upperAlert: string
} {
  const convertValue = (valueStr: string, defaultStr = ''): string => {
    if (!valueStr) return defaultStr

    const value = parseFloat(valueStr)
    if (isNaN(value)) return defaultStr

    const converted = convertUnit(value, fromUnit, toUnit)
    if (converted === null) return defaultStr

    // Round to reasonable precision (8 decimal places)
    const rounded = Math.round(converted * 100000000) / 100000000
    return String(rounded)
  }

  return {
    lowerNormal: convertValue(lowerNormal),
    upperNormal: convertValue(upperNormal),
    lowerAlert: convertValue(lowerAlert || ''),
    upperAlert: convertValue(upperAlert || ''),
  }
}
