'use client'

import { useToast } from '@/hooks/use-toast'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg transition-all',
            'animate-in slide-in-from-top-full',
            toast.variant === 'destructive' &&
              'border-red-500 bg-red-50 text-red-900',
            toast.variant === 'success' &&
              'border-green-500 bg-green-50 text-green-900',
            toast.variant === 'default' &&
              'border-gray-200 bg-white text-gray-900'
          )}
        >
          <div className="flex-1 space-y-1">
            {toast.title && (
              <div className="text-sm font-semibold">{toast.title}</div>
            )}
            {toast.description && (
              <div className="text-sm opacity-90">{toast.description}</div>
            )}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="absolute right-2 top-2 rounded-md p-1.5 opacity-70 transition-opacity hover:bg-black/10 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
