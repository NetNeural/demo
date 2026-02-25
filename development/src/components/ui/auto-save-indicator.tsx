'use client'

import { Check, Loader2, AlertCircle } from 'lucide-react'
import type { AutoSaveStatus } from '@/hooks/useAutoSave'

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus
}

/**
 * Subtle inline indicator that shows auto-save status.
 * Renders nothing when idle.
 */
export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground duration-200 animate-in fade-in">
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="h-3 w-3 text-green-600" />
          <span className="text-green-600">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
    </span>
  )
}
