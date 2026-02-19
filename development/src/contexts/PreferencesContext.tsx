'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────
export type DateFormatOption = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
export type TimeFormatOption = '12h' | '24h'
export type LanguageOption = 'en' | 'es' | 'fr' | 'de' | 'zh'

export interface UserPreferences {
  language: LanguageOption
  timezone: string
  dateFormat: DateFormatOption
  timeFormat: TimeFormatOption
  temperatureUnit: 'F' | 'C'
}

const DEFAULT_PREFERENCES: UserPreferences = {
  language: 'en',
  timezone: 'America/New_York',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  temperatureUnit: 'F',
}

interface PreferencesContextValue {
  preferences: UserPreferences
  loading: boolean
  updatePreferences: (updates: Partial<UserPreferences>) => void
}

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  loading: true,
  updatePreferences: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [loading, setLoading] = useState(true)

  // Load preferences on mount from Supabase user_metadata, fallback to localStorage
  useEffect(() => {
    const load = async () => {
      try {
        // Try localStorage first for instant apply
        const cached = localStorage.getItem('user_preferences')
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            setPreferences(prev => ({ ...prev, ...parsed }))
          } catch { /* ignore parse errors */ }
        }

        // Then fetch authoritative copy from Supabase
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.user_metadata?.preferences) {
          const prefs = user.user_metadata.preferences
          setPreferences(prev => ({
            ...prev,
            language: prefs.language || prev.language,
            timezone: prefs.timezone || prev.timezone,
            dateFormat: prefs.dateFormat || prev.dateFormat,
            timeFormat: prefs.timeFormat || prev.timeFormat,
            temperatureUnit: prefs.temperatureUnit || prev.temperatureUnit,
          }))
        }
      } catch (err) {
        console.error('[PreferencesContext] Failed to load preferences:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Local-only update (PreferencesTab saves to Supabase independently)
  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...updates }
      try {
        localStorage.setItem('user_preferences', JSON.stringify(next))
        if (updates.temperatureUnit) {
          localStorage.setItem('temperatureUnit', updates.temperatureUnit)
        }
      } catch { /* localStorage might be full */ }
      return next
    })
  }, [])

  return (
    <PreferencesContext.Provider value={{ preferences, loading, updatePreferences }}>
      {children}
    </PreferencesContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────
export function usePreferences() {
  return useContext(PreferencesContext)
}
