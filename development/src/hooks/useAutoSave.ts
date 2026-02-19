'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  /** The data to watch for changes */
  data: T;
  /** Async function that performs the save */
  onSave: (data: T) => Promise<void>;
  /** Debounce delay in ms (default: 1000) */
  delay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Auto-save hook with debounce. Watches `data` for changes and calls `onSave`
 * after the user stops changing values for `delay` ms.
 *
 * Returns a status string for showing a subtle indicator to the user.
 */
export function useAutoSave<T>({ data, onSave, delay = 1000, enabled = true }: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const latestData = useRef(data);
  const savingRef = useRef(false);

  // Keep latest data in a ref so the save callback always has the freshest values
  latestData.current = data;

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setStatus('saving');
    try {
      await onSave(latestData.current);
      setStatus('saved');
      // Reset back to idle after 2s
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000);
    } catch {
      setStatus('error');
      // Reset back to idle after 4s
      setTimeout(() => setStatus((s) => (s === 'error' ? 'idle' : s)), 4000);
    } finally {
      savingRef.current = false;
    }
  }, [onSave]);

  useEffect(() => {
    // Skip the initial render (data is just loading, not a user change)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled) return;

    // Clear any pending debounce
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      save();
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, delay, enabled, save]);

  return { status };
}
