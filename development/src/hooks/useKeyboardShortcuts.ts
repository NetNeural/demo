/**
 * Global keyboard shortcuts hook
 * Provides keyboard navigation and shortcuts throughout the app
 */

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export interface KeyboardShortcut {
  key: string
  description: string
  action: () => void
  modifier?: 'ctrl' | 'alt' | 'meta'
  preventDefault?: boolean
}

interface UseKeyboardShortcutsOptions {
  /**
   * Enable/disable shortcuts (default: true)
   */
  enabled?: boolean
  
  /**
   * Additional custom shortcuts
   */
  shortcuts?: KeyboardShortcut[]
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true, shortcuts = [] } = options
  const router = useRouter()

  const focusSearch = useCallback(() => {
    // Find any search input on the page
    const searchInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="text"][placeholder*="Search" i], input[type="search"]'
    )
    if (searchInputs.length > 0) {
      searchInputs[0].focus()
      searchInputs[0].select()
    }
  }, [])

  const clearSearch = useCallback(() => {
    // Clear any focused input
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
      activeElement.value = ''
      activeElement.blur()
      // Trigger input event to update React state
      activeElement.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }, [])

  const showHelp = useCallback(() => {
    // Dispatch custom event to show help modal
    window.dispatchEvent(new CustomEvent('show-keyboard-shortcuts'))
  }, [])

  const triggerExport = useCallback(() => {
    window.dispatchEvent(new CustomEvent('export-current-view'))
  }, [])

  const refreshPage = useCallback(() => {
    window.location.reload()
  }, [])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs (except for Escape)
      const isInputFocused = 
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement

      // Check custom shortcuts first
      for (const shortcut of shortcuts) {
        const modifierPressed = 
          !shortcut.modifier ||
          (shortcut.modifier === 'ctrl' && event.ctrlKey) ||
          (shortcut.modifier === 'alt' && event.altKey) ||
          (shortcut.modifier === 'meta' && event.metaKey)

        if (event.key === shortcut.key && modifierPressed) {
          if (shortcut.preventDefault) {
            event.preventDefault()
          }
          shortcut.action()
          return
        }
      }

      // Global shortcuts
      switch (event.key) {
        case '/':
          if (!isInputFocused) {
            event.preventDefault()
            focusSearch()
          }
          break

        case 'Escape':
          event.preventDefault()
          clearSearch()
          break

        case '?':
          if (!isInputFocused) {
            event.preventDefault()
            showHelp()
          }
          break

        case 'e':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            triggerExport()
          }
          break

        case 'r':
          if (event.ctrlKey || event.metaKey) {
            // Let default Ctrl+R/Cmd+R work for refresh
            // But we could customize it here if needed
          }
          break

        case 'k':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            focusSearch()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, shortcuts, focusSearch, clearSearch, showHelp, triggerExport, refreshPage, router])

  return {
    focusSearch,
    clearSearch,
    showHelp,
  }
}
