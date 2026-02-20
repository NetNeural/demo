/**
 * Centralized date/time formatting utilities.
 *
 * All DISPLAY formatting should go through these helpers so that the user's
 * Language & Region preferences (timezone, dateFormat, timeFormat) are honoured.
 *
 * Internal / machine-readable formatting (CSV exports, filenames, chart bucketing)
 * should use the `format()` export from date-fns directly.
 */

import type {
  DateFormatOption,
  TimeFormatOption,
} from '@/contexts/PreferencesContext'

// ─── Intl option builders ─────────────────────────────────────────────

function getLocale(lang: string): string {
  const map: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    zh: 'zh-CN',
  }
  return map[lang] || 'en-US'
}

function hour12(timeFormat: TimeFormatOption): boolean {
  return timeFormat === '12h'
}

// ─── Core formatters ──────────────────────────────────────────────────

export interface FormatOptions {
  timezone?: string
  dateFormat?: DateFormatOption
  timeFormat?: TimeFormatOption
  language?: string
}

/**
 * Format a full date + time string according to user preferences.
 * e.g. "02/19/2026, 3:45 PM" or "19/02/2026, 15:45"
 */
export function formatDateTime(
  date: Date | string | number,
  opts: FormatOptions = {}
): string {
  const d = toDate(date)
  if (!d) return 'N/A'
  const {
    timezone,
    dateFormat = 'MM/DD/YYYY',
    timeFormat = '12h',
    language = 'en',
  } = opts
  const locale = getLocale(language)
  const options: Intl.DateTimeFormatOptions = {
    ...dateOptions(dateFormat),
    hour: '2-digit',
    minute: '2-digit',
    hour12: hour12(timeFormat),
    ...(timezone ? { timeZone: timezone } : {}),
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(d)
  } catch {
    return d.toLocaleString()
  }
}

/**
 * Format date only (no time).
 * e.g. "02/19/2026" or "19/02/2026" or "2026-02-19"
 */
export function formatDateOnly(
  date: Date | string | number,
  opts: FormatOptions = {}
): string {
  const d = toDate(date)
  if (!d) return 'N/A'
  const { timezone, dateFormat = 'MM/DD/YYYY', language = 'en' } = opts
  const locale = getLocale(language)
  const options: Intl.DateTimeFormatOptions = {
    ...dateOptions(dateFormat),
    ...(timezone ? { timeZone: timezone } : {}),
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

/**
 * Format time only (no date).
 * e.g. "3:45 PM" or "15:45"
 */
export function formatTimeOnly(
  date: Date | string | number,
  opts: FormatOptions = {}
): string {
  const d = toDate(date)
  if (!d) return 'N/A'
  const { timezone, timeFormat = '12h', language = 'en' } = opts
  const locale = getLocale(language)
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: hour12(timeFormat),
    ...(timezone ? { timeZone: timezone } : {}),
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(d)
  } catch {
    return d.toLocaleTimeString()
  }
}

/**
 * Format with seconds (for detailed views / reports).
 * e.g. "02/19/2026, 3:45:12 PM"
 */
export function formatDateTimeWithSeconds(
  date: Date | string | number,
  opts: FormatOptions = {}
): string {
  const d = toDate(date)
  if (!d) return 'N/A'
  const {
    timezone,
    dateFormat = 'MM/DD/YYYY',
    timeFormat = '12h',
    language = 'en',
  } = opts
  const locale = getLocale(language)
  const options: Intl.DateTimeFormatOptions = {
    ...dateOptions(dateFormat),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: hour12(timeFormat),
    ...(timezone ? { timeZone: timezone } : {}),
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(d)
  } catch {
    return d.toLocaleString()
  }
}

/**
 * Short date for compact views.
 * e.g. "Feb 19" or "19 Feb"
 */
export function formatShortDate(
  date: Date | string | number,
  opts: FormatOptions = {}
): string {
  const d = toDate(date)
  if (!d) return 'N/A'
  const { timezone, language = 'en' } = opts
  const locale = getLocale(language)
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

/**
 * Short date with time for compact views.
 * e.g. "Feb 19, 3:45 PM"
 */
export function formatShortDateTime(
  date: Date | string | number,
  opts: FormatOptions = {}
): string {
  const d = toDate(date)
  if (!d) return 'N/A'
  const { timezone, timeFormat = '12h', language = 'en' } = opts
  const locale = getLocale(language)
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: hour12(timeFormat),
    ...(timezone ? { timeZone: timezone } : {}),
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(d)
  } catch {
    return d.toLocaleString()
  }
}

/**
 * Long date for formal displays.
 * e.g. "February 19, 2026" or "19 febrero 2026"
 */
export function formatLongDate(
  date: Date | string | number,
  opts: FormatOptions = {}
): string {
  const d = toDate(date)
  if (!d) return 'N/A'
  const { timezone, language = 'en' } = opts
  const locale = getLocale(language)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  }
  try {
    return new Intl.DateTimeFormat(locale, options).format(d)
  } catch {
    return d.toLocaleDateString()
  }
}

// ─── Relative time ("time ago") ───────────────────────────────────────

/**
 * Single unified "time ago" formatter replacing 7+ duplicate implementations.
 * Returns: "just now" | "2m ago" | "3h ago" | "5d ago" | fallback to formatted date
 */
export function formatTimeAgo(
  date: Date | string | number | null | undefined,
  opts: FormatOptions = {}
): string {
  if (!date) return 'Never'
  const d = toDate(date)
  if (!d) return 'Never'

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 30) return `${diffDay}d ago`

  // Older than 30 days — show formatted date
  return formatDateOnly(d, opts)
}

/**
 * Duration formatter (not a timestamp).
 * e.g. 45 → "45m", 125 → "2.1h"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  return `${(minutes / 60).toFixed(1)}h`
}

// ─── React hook for convenience ───────────────────────────────────────

/**
 * Hook that returns formatting functions pre-bound to user preferences.
 * Usage:
 *   const { fmt } = useDateFormatter()
 *   fmt.dateTime(someDate)   // respects user timezone, format, language
 *   fmt.timeAgo(someDate)    // "2h ago"
 */
export function createFormatter(prefs: {
  timezone?: string
  dateFormat?: string
  timeFormat?: string
  language?: string
}) {
  const opts: FormatOptions = {
    timezone: prefs.timezone,
    dateFormat: (prefs.dateFormat as DateFormatOption) || 'MM/DD/YYYY',
    timeFormat: (prefs.timeFormat as TimeFormatOption) || '12h',
    language: prefs.language || 'en',
  }

  return {
    dateTime: (d: Date | string | number) => formatDateTime(d, opts),
    dateOnly: (d: Date | string | number) => formatDateOnly(d, opts),
    timeOnly: (d: Date | string | number) => formatTimeOnly(d, opts),
    dateTimeSeconds: (d: Date | string | number) =>
      formatDateTimeWithSeconds(d, opts),
    shortDate: (d: Date | string | number) => formatShortDate(d, opts),
    shortDateTime: (d: Date | string | number) => formatShortDateTime(d, opts),
    longDate: (d: Date | string | number) => formatLongDate(d, opts),
    timeAgo: (d: Date | string | number | null | undefined) =>
      formatTimeAgo(d, opts),
    duration: formatDuration,
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────

function toDate(input: Date | string | number | null | undefined): Date | null {
  if (!input) return null
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input
  const d = new Date(input)
  return isNaN(d.getTime()) ? null : d
}

function dateOptions(fmt: DateFormatOption): Intl.DateTimeFormatOptions {
  switch (fmt) {
    case 'YYYY-MM-DD':
      return { year: 'numeric', month: '2-digit', day: '2-digit' }
    case 'DD/MM/YYYY':
      return { year: 'numeric', month: '2-digit', day: '2-digit' }
    case 'MM/DD/YYYY':
    default:
      return { year: 'numeric', month: '2-digit', day: '2-digit' }
  }
}
