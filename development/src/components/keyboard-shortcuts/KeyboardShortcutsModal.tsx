'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Keyboard, Command } from 'lucide-react'

interface ShortcutGroup {
  title: string
  shortcuts: Array<{
    keys: string[]
    description: string
  }>
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['/'], description: 'Focus search' },
      { keys: ['Ctrl', 'K'], description: 'Quick search (alternative)' },
      { keys: ['Esc'], description: 'Clear search / Close dialogs' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['Ctrl', 'E'], description: 'Export current view' },
      { keys: ['Ctrl', 'R'], description: 'Refresh page' },
    ],
  },
]

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleShow = () => setIsOpen(true)
    window.addEventListener('show-keyboard-shortcuts', handleShow)
    return () =>
      window.removeEventListener('show-keyboard-shortcuts', handleShow)
  }, [])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and interact with the platform
            faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <span
                          key={keyIndex}
                          className="flex items-center gap-1"
                        >
                          {keyIndex > 0 && (
                            <span className="text-xs text-muted-foreground">
                              +
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="px-2 py-0.5 font-mono text-xs"
                          >
                            {key === 'Ctrl' &&
                            navigator.platform.includes('Mac') ? (
                              <Command className="h-3 w-3" />
                            ) : (
                              key
                            )}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 text-xs text-muted-foreground">
          <p>
            <strong>Tip:</strong> Most shortcuts work from anywhere in the app.
            Press{' '}
            <Badge variant="outline" className="mx-1 font-mono text-xs">
              ?
            </Badge>{' '}
            anytime to see this help.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
