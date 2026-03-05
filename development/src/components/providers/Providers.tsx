'use client'

import { useEffect } from 'react'
import { QueryProvider } from '@/lib/query-client'

const PALETTE_THEMES = [
  'theme-slate',
  'theme-navy',
  'theme-emerald',
  'theme-neutral',
  'theme-high-contrast',
  'theme-twilight',
  'theme-crimson',
]

export function Providers({ children }: { children: React.ReactNode }) {
  // Initialize theme on mount — mirrors the inline script in layout.tsx
  // but also handles race conditions if the script didn't run
  useEffect(() => {
    const useOrgDefault = localStorage.getItem('useOrgDefaultTheme')
    const savedTheme =
      useOrgDefault === 'false'
        ? localStorage.getItem('theme') || 'system'
        : localStorage.getItem('theme') || 'system'
    const root = document.documentElement

    // Don't clobber if ThemeBranding already applied an org theme
    if (PALETTE_THEMES.some((t) => root.classList.contains(t))) return

    // Remove stale classes
    root.classList.remove('dark', 'light', ...PALETTE_THEMES)

    if (PALETTE_THEMES.includes(savedTheme)) {
      // Palette themes are dark — need both .dark and the theme class
      root.classList.add('dark', savedTheme)
    } else if (savedTheme === 'dark') {
      root.classList.add('dark')
    } else if (savedTheme === 'light') {
      root.classList.add('light')
    } else {
      // System/auto — respect OS preference
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches
      root.classList.add(prefersDark ? 'dark' : 'light')
    }
  }, [])

  return <QueryProvider>{children}</QueryProvider>
}
