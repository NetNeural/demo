'use client'

import { useEffect } from 'react'
import { QueryProvider } from '@/lib/query-client'

export function Providers({ children }: { children: React.ReactNode }) {
  // Initialize theme on mount
  useEffect(() => {
    // Get theme from localStorage or default to system
    const savedTheme = localStorage.getItem('theme') || 'system'
    const root = document.documentElement

    if (savedTheme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else if (savedTheme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
    } else {
      // System theme - respect OS preference
      root.classList.remove('dark', 'light')
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.add('light')
      }
    }
  }, [])

  return <QueryProvider>{children}</QueryProvider>
}
