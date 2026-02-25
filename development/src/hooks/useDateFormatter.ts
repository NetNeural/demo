'use client'

import { useMemo } from 'react'
import { usePreferences } from '@/contexts/PreferencesContext'
import { createFormatter } from '@/lib/format-date'

/**
 * React hook that returns date/time formatting functions
 * pre-bound to the current user's Language & Region preferences.
 *
 * Usage:
 *   const { fmt } = useDateFormatter()
 *   <span>{fmt.dateTime(device.last_seen)}</span>
 *   <span>{fmt.timeAgo(alert.timestamp)}</span>
 */
export function useDateFormatter() {
  const { preferences } = usePreferences()

  const fmt = useMemo(() => createFormatter(preferences), [preferences])

  return { fmt, preferences }
}
