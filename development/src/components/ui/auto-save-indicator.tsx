'use client';

import { Check, Loader2, AlertCircle } from 'lucide-react';
import type { AutoSaveStatus } from '@/hooks/useAutoSave';

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
}

/**
 * Subtle inline indicator that shows auto-save status.
 * Renders nothing when idle.
 */
export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  if (status === 'idle') return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground animate-in fade-in duration-200">
      {status === 'saving' && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Saving…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="w-3 h-3 text-green-600" />
          <span className="text-green-600">Saved</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="w-3 h-3 text-destructive" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
    </span>
  );
}
